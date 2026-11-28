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
  · 혜택 줄이 모두 금전 혜택(할인·적립·캐시백)이고 값이 `12%`처럼 단순한 비율이다
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
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "paymorevent" / "data"
PCT = re.compile(r"^(\d+(?:\.\d+)?)\s*%$")
MONEY_TYPES = {"할인", "적립", "캐시백"}

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
    return int((reached[-1] if reached else tier_caps[0])["cap"])


def conversion_rates(card: dict):
    """카드 하나의 상품설명서 정리본 → 요율 목록. 못 옮기면 (None, 이유)."""
    if card.get("minimumSpend") is None:
        return None, "전월실적 없음(미확인)"
    rates = []
    for benefit in card.get("benefits") or []:
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
        if benefit.get("capScope") not in (None, "월"):
            return None, f"한도 주기 {benefit.get('capScope')}"
        match = PCT.match(value)
        if not match:
            return None, f"값 표기 {value[:12] or '없음'}"
        percent = float(match.group(1))
        if percent <= 0 or percent > 100:
            return None, f"비율 범위 {value}"
        minimum_spend = benefit.get("minimumSpend")
        if minimum_spend is None or minimum_spend <= 0:
            minimum_spend = card.get("minimumSpend")
        minimum_spend = int(minimum_spend)
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


def build(dry_run: bool, limit: int | None):
    terms = load_terms()
    snapshot = json.loads((DATA / "catalog-snapshot.json").read_text(encoding="utf-8"))
    built = {c["id"]: c for c in apply_verified_rules(snapshot["cards"])}
    try:
        previous = json.loads(gzip.decompress((DATA / "terms-rules.json.gz").read_bytes()).decode())
        patches = dict(previous.get("patches") or {})
    except FileNotFoundError:
        patches = {}

    added, skipped, values, rejected = [], {}, [], {}
    for card in terms.get("cards") or []:
        cid = card.get("cardId")
        if not cid or cid not in built:
            continue
        db_card = built[cid]
        if db_card.get("rewardRates"):
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

    print(f"요율 모델 추가 {len(added)}장 · 카드 DB와 이름이 달라 건너뜀 {len(rejected)}장")
    for reason, n in sorted(skipped.items(), key=lambda x: -x[1]):
        print(f"  건너뜀 {reason}: {n}장")
    for cid, name, labels, value in sorted(values, key=lambda x: -x[3])[:15]:
        print(f"  {cid:26s} {name[:22]:24s} 최고 {value:5.2f}%  ({', '.join(labels[:3])})")
    if dry_run:
        return 0
    out = {
        "built": "2026-11-28",
        "about": ("상품설명서 정리본(data/card-terms.json)에서 기계 변환한 요율 모델. 빌드 때 카드 DB의 "
                  "rewardRates 가 비어 있는 카드에만 덮어씁니다(scripts/verified-card-rules.mjs). "
                  "손 검수 수정은 data/verified-card-rules.json.gz·picking-review.json 에 적으세요."),
        "source": "data/inbox/card-terms (tools/data/inbox.py merge)",
        "converter": "tools/data/terms_to_rules.py",
        "patches": dict(sorted(patches.items())),
    }
    (DATA / "terms-rules.json.gz").write_bytes(gzip.compress(
        json.dumps(out, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), 9))
    print(f"paymorevent/data/terms-rules.json.gz 저장 ({len(out['patches'])}장)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="상품설명서 정리본 → 피킹률 요율 모델 변환")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    return build(args.dry_run, None)


if __name__ == "__main__":
    raise SystemExit(main())
