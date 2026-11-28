#!/usr/bin/env python3
"""상품설명서 정리본 → 피킹률 요율 모델 변환 (Mr. Cards).

`paymorevent/data/card-terms.json`(배포 때 `tools/data/inbox.py merge`가 만드는 파일)에는
카드사 상품설명서 혜택 표를 그대로 옮긴 줄이 있습니다. 이 스크립트는 그중 **기계적으로
옮겨도 틀릴 수 없는 줄만** 골라 `paymorevent/data/terms-rules.json.gz`(빌드 때 카드에 덮어쓰는
요율 모델)로 만듭니다.

    python3 tools/data/inbox.py merge                    # card-terms.json 만들기(배포와 같은 동작)
    python3 tools/data/terms_to_rules.py --dry-run        # 몇 장이 바뀌는지·값 미리보기
    python3 tools/data/terms_to_rules.py                  # data/terms-rules.json.gz 갱신

고르는 기준(하나라도 어긋나면 그 카드는 건너뜁니다 — 화면에는 지금처럼 '피킹률 확인 중'이 남습니다)
  · 카드 DB(catalog-snapshot.json)에 있는 카드이고 아직 요율 모델(rewardRates)이 없다
  · 현금성 청구할인/캐시백 한 줄만 있고 값이 `12%`처럼 단순한 비율이다
  · 단건 조건·택1·중복 여부 등 현 계산기로 안전하게 판정할 수 없는 문구가 없어야 한다
    (`최대 2만원`·`0.5~1.0%`·`1.5마일`·`리터당 60원` 같은 혼합 표기는 건너뜀)
  · 통합 한도(shared)·건당/횟수 제한(limits)이 없다 — 영역별 한도를 따로 더하면 부풀려지기 때문
  · 한도 주기가 월(또는 없음)이다 (연·일·건 한도는 이 모델로 표현할 수 없음)
  · 실적 구간(tiers)이 있으면 **최저 구간 한도**를 씀 (화면의 '최저 실적 기준'과 같음)
  · 한도 없이 5%를 넘는 비율은 건너뜀 (한도가 없으면 계산이 무한정 커짐)

화면 계산은 `pickingOptions()`(lib/catalog-model.ts) 그대로이고, 이 파일도 같은 계산
(`tools/data/picking_audit.py`)으로 피킹률이 실제로 나오는 카드만 남깁니다.
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
import sys
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "paymorevent" / "data"
PCT = re.compile(r"^(\d+(?:\.\d+)?)\s*%$")
MONEY_TYPES = {"할인", "캐시백"}
# These details require a modeled rule, not a note attached to a percentage.
UNMODELED = re.compile(
    r"포인트|마일|코인|적립|(?:^|[^A-Za-z])(?:point|mile|M\s*포인트)"
    r"|건당|단건|거래당|승인당|결제당|1회\s*(?:승인|결제)|단일|최소\s*(?:결제|이용)"
    r"|이상\s*(?:결제|구매)|(?:결제|구매)\s*(?:시|금액).{0,14}이상"
    r"|[0-9][\d,.]*\s*(?:만\s*)?원?\s*이상\s*(?:시|인|부터)"
    r"|중복|택\s*1|즉시\s*결제|자동\s*납부|자동\s*이체|별도\s*실적|반올림|이월|선착순"
    r"|(?<![A-Za-z])(?:USD|JPY|EUR|KRW|CNY)\s*\d"
    r"|(?:일|주|연|월)\s*\d+\s*회|(?:결제|주유|이용)\s*(?:건|금액).{0,12}(?:한하여|까지 인정)"
    r"|가입\s*동의|특정\s*회원|수수료\s*면제",
    re.I,
)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from picking_audit import apply_verified_rules, best, picking_options  # noqa: E402


def load_terms() -> dict:
    return json.loads((DATA / "card-terms.json").read_text(encoding="utf-8"))


def cap_at_min_tier(benefit: dict, minimum_spend: int):
    tier_caps = [t for t in benefit.get("tiers") or [] if isinstance(t.get("cap"), (int, float))]
    if benefit.get("cap") is not None:
        return int(benefit["cap"])
    if not tier_caps:
        return None
    tier_caps.sort(key=lambda t: t.get("spend") or 0)
    reached = [t for t in tier_caps if (t.get("spend") or 0) <= minimum_spend]
    return int(reached[-1]["cap"]) if reached else None


def conversion_rates(card: dict):
    """카드 하나의 상품설명서 정리본 → 요율 목록. 못 옮기면 (None, 이유)."""
    if card.get("minimumSpend") is None:
        return None, "전월실적 없음(미확인)"
    benefits = card.get("benefits") or []
    # Collected terms do not encode how two benefit rows interact. Treating
    # them as alternatives hides supported stacking and overstates other cards.
    if len(benefits) != 1:
        return None, "복수 혜택 관계 미확인" if benefits else "혜택 줄 없음"
    # Single-benefit cards whose discounted purchases are expressly excluded
    # need the discounted spend counted on top of the qualifying amount.
    benefit_spend_excluded = any(re.search(
        r"서비스\(할인\)\s*받은\s*매출|할인\s*(?:혜택\s*)?(?:적용\s*)?받은\s*(?:전체\s*)?(?:거래|결제|매출|이용)",
        text,
    ) for text in card.get("spendExclusions") or [])
    rates = []
    for benefit in benefits:
        label = (benefit.get("label") or benefit.get("group") or "").strip()
        value = str(benefit.get("value") or "").strip()
        if not label:
            return None, "구분 없는 혜택 줄"
        if benefit.get("valueType") not in MONEY_TYPES:
            return None, f"금전 혜택 아님({benefit.get('valueType')})"
        if benefit.get("shared"):
            return None, "통합 한도"
        if benefit.get("limits"):
            return None, "건당·횟수 제한"
        text = " ".join(str(x) for x in [
            benefit.get("label"), benefit.get("group"), benefit.get("place"), *(benefit.get("conditions") or []),
        ] if x)
        if UNMODELED.search(text):
            return None, "요율 단위·거래 조건 수동 검수 필요"
        if benefit.get("capScope") not in (None, "월"):
            return None, f"한도 주기 {benefit.get('capScope')}"
        match = PCT.match(value)
        if not match:
            return None, f"값 표기 {value[:12] or '없음'}"
        percent = float(match.group(1))
        if percent <= 0 or percent > 100:
            return None, f"비율 범위 {value}"
        minimum_spend = benefit.get("minimumSpend")
        if minimum_spend is None:
            minimum_spend = card.get("minimumSpend")
        minimum_spend = int(minimum_spend)
        if minimum_spend < 0:
            return None, "전월실적 범위 오류"
        if benefit.get("tiers") and not any(
                isinstance(t.get("spend"), (int, float)) and t["spend"] <= minimum_spend
                for t in benefit["tiers"]):
            return None, "최저 실적에서 열리는 구간 없음"
        cap = cap_at_min_tier(benefit, minimum_spend)
        if cap is None and percent > 5:
            return None, "한도 없는 5% 초과"
        if cap is not None and cap <= 0:
            return None, "한도 0"
        note_parts = [p for p in (benefit.get("group"), benefit.get("place")) if p]
        note = "상품설명서 표: " + " | ".join(note_parts + [value])
        if cap is not None:
            note += f" | 월 한도 {cap:,}원"
        conditions = [c for c in (benefit.get("conditions") or []) if c][:2]
        if conditions:
            note += " · " + " / ".join(conditions)
        rates.append({
            "label": label,
            "spendUnit": 100,
            "rewardUnits": percent,
            "rewardUnit": "원",
            "unitValue": 1,
            "minimumSpend": minimum_spend,
            "monthlyCapValue": cap,
            **({"spendExcluded": True} if benefit_spend_excluded else {}),
            "sourceUrl": card.get("termsUrl") or card.get("url"),
            "note": note[:400],
            "verified": True,
        })
    return (rates or None), ("혜택 줄 없음" if not rates else "")


def loose_name(name: str) -> str:
    """카드사명·괄호·'카드'·'체크'·기호를 뺀 이름 (scripts/card-terms.mjs looseName 과 같은 규칙)"""
    prefix = re.compile(
        r"^(?:신한카드|신한은행|신한|kb국민카드|kb국민|kb|nh농협카드|nh농협|nh|농협|하나카드|하나|롯데카드|롯데|삼성카드|삼성|"
        r"현대카드|현대|우리카드|우리|bc\s*바로카드|bc\s*바로|bc카드|bc|sc제일은행|sc제일|광주은행|mg새마을금고)\s*")
    text = unicodedata.normalize("NFKC", str(name or "")).lower()
    text = re.sub(r"\([^)]*\)|\[[^\]]*\]", " ", text)
    text = prefix.sub("", text)
    text = re.sub(r"bc\s*바로", "", text)
    text = re.sub(r"카드|체크|신용", "", text)
    return re.sub(r"[^0-9a-z가-힣]", "", text)


def same_card(terms: dict, card: dict) -> bool:
    if terms.get("cardType") != card.get("type"):
        return False
    a, b = loose_name(terms.get("name")), loose_name(card.get("name"))
    return a == b if a == b else (len(a) >= 2 and len(b) >= 2 and (a in b or b in a))


def build(dry_run: bool):
    terms = load_terms()
    snapshot = json.loads((DATA / "catalog-snapshot.json").read_text(encoding="utf-8"))
    # Never feed yesterday's generated rules back into today's input. Build
    # an empty patch map so updated and deleted source rows both take effect.
    built = {c["id"]: c for c in apply_verified_rules(snapshot["cards"], include_generated=False)}
    patches = {}

    added, skipped, values, rejected = [], {}, [], {}
    for card in terms.get("cards") or []:
        cid = card.get("cardId")
        if not cid or cid not in built:
            continue
        db_card = built[cid]
        if any(db_card.get(field) for field in ("rewardRates", "spendingPlans", "pickingScenarios")):
            continue  # 이미 손으로 검수한 요율 모델이 있음
        if not same_card(card, db_card):
            rejected[cid] = "카드 이름·신용/체크 불일치"
            continue
        rates, reason = conversion_rates(card)
        if not rates:
            skipped[reason] = skipped.get(reason, 0) + 1
            continue
        candidate = {**db_card, "rewardRates": rates, "rewardModelComplete": True,
                     "rewardCoveragePending": False}
        options = picking_options(candidate)
        if not options:
            skipped["계산해도 피킹률이 안 나옴"] = skipped.get("계산해도 피킹률이 안 나옴", 0) + 1
            continue
        top = best(options)
        if top["value"] > 15:
            skipped["피킹률 15% 초과(한도 확인 필요)"] = skipped.get("피킹률 15% 초과(한도 확인 필요)", 0) + 1
            continue
        patches[cid] = {
            "rewardRates": rates,
            "rewardModelComplete": True,
            "rewardCoveragePending": False,
            "rewardCoverageNote": ("상품설명서 정리본 혜택 표에서 기계 변환한 요율 모델(최저 실적 구간 기준). "
                                   "통합 한도·건당 제한이 있는 카드는 넣지 않았습니다."),
        }
        added.append(cid)
        values.append((cid, db_card.get("name") or card.get("name"), [o["label"] for o in options], top["value"]))

    print(f"요율 모델 생성 {len(added)}장 · 카드 DB와 이름이 달라 건너뜀 {len(rejected)}장")
    for reason, n in sorted(skipped.items(), key=lambda x: -x[1]):
        print(f"  건너뜀 {reason}: {n}장")
    for cid, name, labels, value in sorted(values, key=lambda x: -x[3])[:15]:
        print(f"  {cid:26s} {name[:22]:24s} 최고 {value:5.2f}%  ({', '.join(labels[:3])})")
    if dry_run:
        return 0
    out = {
        "built": datetime.now(timezone(timedelta(hours=9))).date().isoformat(),
        "about": ("상품설명서 정리본(data/card-terms.json)에서 기계 변환한 요율 모델. 빌드 때 카드 DB의 "
                  "rewardRates 가 비어 있는 카드에만 덮어씁니다(scripts/verified-card-rules.mjs). "
                  "손 검수 수정은 data/verified-card-rules.json.gz·picking-review.json 에 적으세요."),
        "source": "data/inbox/card-terms (tools/data/inbox.py merge)",
        "converter": "tools/data/terms_to_rules.py",
        "patches": dict(sorted(patches.items())),
    }
    (DATA / "terms-rules.json.gz").write_bytes(gzip.compress(
        json.dumps(out, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), 9, mtime=0))
    print(f"paymorevent/data/terms-rules.json.gz 저장 ({len(out['patches'])}장)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="상품설명서 정리본 → 피킹률 요율 모델 변환")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    return build(args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
