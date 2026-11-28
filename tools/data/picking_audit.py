#!/usr/bin/env python3
"""피킹률·혜택 데이터 전수 검수 (Mr. Cards).

`paymorevent/lib/catalog-model.ts`의 `pickingOptions()`와 같은 계산을 파이썬으로 옮겨,
카드 DB 전체를 훑으면서 화면에 나올 피킹률과 데이터 누락·오계산 위험을 한 번에 뽑습니다.
Node 없이 돌릴 수 있게 두었으니, 배포 전 검수나 에이전트 상호 검수에서 그대로 쓰세요.

    python3 tools/data/picking_audit.py                 # 요약 + 문제 목록
    python3 tools/data/picking_audit.py --md docs/picking-audit.md
    python3 tools/data/picking_audit.py --card nh-90010544 --detail

검사 항목
  A. 헷갈리는 피킹률 계산
     A1 해외 결제 수수료 면제(feeWaiver)가 적립률에 더해져 부풀려 보이는 카드
     A2 전월실적 조건 영역과 혜택 영역이 다른데(예: 국내 실적 → 해외 우대) 같은 영역에
        그 금액을 쓴 것으로 계산되는 카드
     A3 계산된 피킹률이 5%를 넘는 카드
     A4 rewardRates 일부만 있고 rewardModelComplete가 없어 피킹률이 비는 카드
     A5 혜택·실적 표기와 요율 모델이 어긋난 카드(요율 없음·요율 1건)
  B. 누락된 혜택·피킹률
     B1 상품설명서 정리본(card-terms.json)은 있는데 카드 DB 요율 모델이 없는 카드
     B2 카드 DB 혜택 표와 정리본 혜택 표의 줄 수가 크게 다른 카드(정리본이 더 자세함)
  C. 화면 표시·결제 판정 (2026-11-28 추가)
     C1 혜택 줄이 추상 문구만 있는 카드('선택 옵션 대상 업종', '… 자세히보기' 등 — 대상 업종·가맹점이 없음)
     C2 혜택은 인정인데 전월실적이 '?'(unknown)로 남은 칸 — 무실적 카드면 판정 규칙이 안 먹은 것

혜택 표 라벨이 "당 스카이패스"처럼 깨지는지는 실제 화면 코드로만 알 수 있어
`node paymorevent/scripts/label-audit.mjs`가 따로 검사합니다(라벨 깨짐·적용처 문장·추상 문구·`?` 남은 카드).

주의: 이 스크립트는 화면 계산의 사본입니다. `catalog-model.ts`를 고치면 여기도 같이 고치세요
(같은 날 배포되는 `docs/picking-audit.md`가 서로 다른 답을 내면 안 됩니다).
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

KST = timezone(timedelta(hours=9))

ROOT = Path(__file__).resolve().parents[2]
CARD_DATA = ROOT / "paymorevent" / "data"

# --- catalog-model.ts 와 같은 상수 -------------------------------------------------
NICHE_PICKING = re.compile(
    r"놀이공원|테마파크|에버랜드|롯데월드|서울랜드|워터파크|캐리비안|아쿠아리움|동물원|입장권|경기\s*관람|"
    r"야구|축구|농구|배구|구단|(?<![A-Z])FC(?![A-Z])|메가스토어|골프|스키장|리프트|공연|뮤지컬|박물관|미술관|"
    r"아카데미|문화센터|호텔스닷컴|익스피디아|아고다|심야|동시\s*충족"
)
SUBSCRIPTION = re.compile(
    r"멤버십|MEMBERSHIP|OTT|스트리밍|디지털\s*(?:구독|콘텐츠)|넷플릭스|유튜브|유료앱|티빙|웨이브", re.I
)
SUBSCRIPTION_SPEND = 30000
REFERENCE_SPEND = 300000

# 전월실적을 다른 영역에서 채우는 카드인지 찾는 단서 (A2)
OTHER_AREA_SPEND = re.compile(
    r"국내\s*(?:전월\s*)?실적|전월실적\s*조건|실적\s*조건|국내\s*이용\s*실적|국내\s*가맹점"
)
FOREIGN_AREA = re.compile(r"해외|외화|해외겸용|해외\s*이용")

# C1 혜택 줄이 추상 문구만 있는 경우 (대상 업종·가맹점이 없어 화면에서 뜻이 없음)
ABSTRACT_ONLY = re.compile(r"^(?:선택\s*)?(?:옵션\s*)?(?:대상\s*)?(?:업종|가맹점)(?:\s*(?:및|·|/)\s*(?:업종|가맹점))?\s*(?:안내|제공)?$")
SEE_MORE = re.compile(r"(?:자세히|상세)\s*보기$")


def abstract_only(text: str) -> bool:
    """'선택 옵션 대상 업종'처럼 업종·가맹점 없이 '자세히보기'만 붙은 줄인지"""
    raw = (text or "").strip()
    if not raw:
        return False  # 빈 칸은 상세 화면이 '원문 참고'로 비워 둠
    t = SEE_MORE.sub("", raw).strip()
    if not t:
        return True
    if ABSTRACT_ONLY.match(t):
        return True
    return bool(SEE_MORE.search(raw)) and len(t) <= 25 and not re.search(r"[,·/]", t)
# C2 결제 판정에서 '전월실적' 칸이 ?로 남는 결제 항목(화면 PAYMENT_CHECKS의 저장 판정 4개)
ELIGIBILITY_KEYS = ("상품권 가능", "관리비", "국세", "지방세")

def spends_positive(card: dict) -> bool:
    """카드·혜택·요율·배분 어디에도 양수 전월실적이 있는지 (없으면 무실적 카드)"""
    values = [card.get("minimumSpend")]
    values += [b.get("minimumSpend") for b in card.get("benefits") or []]
    values += [r.get("minimumSpend") for r in card.get("rewardRates") or []]
    values += [p.get("minimumSpend") for p in card.get("spendingPlans") or []]
    return any(isinstance(v, (int, float)) and v > 0 for v in values)


def load(name: str):
    path = CARD_DATA / name
    if path.suffix == ".gz":
        return json.loads(gzip.decompress(path.read_bytes()).decode("utf-8"))
    return json.loads(path.read_text(encoding="utf-8"))


# --- 빌드 때 덮어쓰는 손 검수 규칙 (scripts/verified-card-rules.mjs · picking-review.mjs) ---
# 화면은 catalog-snapshot.json 원본이 아니라 verified-card-rules.json.gz → terms-rules → picking-review 를
# 차례로 덮은 값을 보여 줍니다. 전수 검사도 같은 순서로 만든 카드로 해야 화면과 같은 답이 나옵니다.
def apply_verified_rules(cards: list[dict], *, include_generated: bool = True) -> list[dict]:
    patches = load("verified-card-rules.json.gz").get("patches", {})
    out = [{**card, **patches[card["id"]]} if card["id"] in patches else card for card in cards]
    if include_generated:
        try:
            terms = load("terms-rules.json.gz").get("patches", {})
        except FileNotFoundError:
            terms = {}
        out = [{**card, **terms[card["id"]]} if card["id"] in terms and not card.get("rewardRates") else card
               for card in out]
    review = load("picking-review.json")
    by_id = {card["id"]: i for i, card in enumerate(out)}
    for cid in review.get("benefitSpendExcluded", {}).get("cards", []):
        if cid in by_id:
            out[by_id[cid]] = {**out[by_id[cid]], "benefitSpendExcluded": True}
    for fix in review.get("rules", []):
        pattern = re.compile(fix["label"])
        for cid in fix["cards"]:
            if cid not in by_id:
                continue
            card = out[by_id[cid]]
            rates = [{**r, **fix["set"]} if pattern.search(r.get("label", "")) else r
                     for r in (card.get("rewardRates") or [])]
            out[by_id[cid]] = {**card, "rewardRates": rates}
    for fix in review.get("plans", []):
        cid = fix["card"]
        if cid not in by_id:
            continue
        card = out[by_id[cid]]
        plans = []
        for plan in card.get("spendingPlans") or []:
            if plan.get("label") != fix["plan"]:
                plans.append(plan)
                continue
            rules = [{**r, **(fix.get("rules", {}).get(r["id"]) or {})} for r in plan["rules"]]
            groups = [g for g in plan.get("groups") or [] if g["id"] not in {n["id"] for n in fix.get("groups", [])}]
            plans.append({**plan, "groups": groups + (fix.get("groups") or []), "rules": rules + (fix.get("add") or [])})
        out[by_id[cid]] = {**card, "spendingPlans": plans}
    return out


# --- reward-valuation.ts ----------------------------------------------------------
VALUATIONS = json.loads((CARD_DATA / "reward-valuations.json").read_text(encoding="utf-8"))


def reward_program(unit: str, context: str = "") -> str | None:
    u = (unit or "").strip()
    t = (u + " " + context) if re.fullmatch(r"포인트|points?|점|마일(?:리지)?|miles?", u, re.I) else u
    if re.fullmatch(r"원|KRW|현금|캐시백", u):
        return "cash"
    if re.search(
        r"현금성\s*포인트|NH\s*(?:포인트|머니)|마이신한포인트|우리WON꿀머니|페이북\s*머니|IBK\s*포인트|"
        r"트래블포인트|TOP\s*포인트|하나머니|KB\s*포인트리|포인트리|L\.POINT|엘포인트|OK캐쉬백|GS.*포인트",
        u,
        re.I,
    ):
        return "cash"
    if re.search(r"유니마일|UNI[ -]?MILE", t, re.I):
        return "unimile"
    if re.search(r"대한항공|스카이패스|SKYPASS", t, re.I) and re.search(r"마일|mile|포인트", u, re.I):
        return "skypass"
    if re.search(r"힐튼|Hilton|Honors", t, re.I) and re.search(r"포인트|point|점", u, re.I):
        return "hilton"
    if re.search(r"매리어트|메리어트|Marriott|Bonvoy|본보이", t, re.I) and re.search(r"포인트|point|점", u, re.I):
        return "marriott"
    if re.search(r"아코르|Accor|ALL\s*(?:리워드|Reward|우리)", t, re.I) and re.search(r"포인트|point|점", u, re.I):
        return "accor"
    if re.search(r"마일|mile|크리스플라이어|KrisFlyer", u, re.I):
        return "other-airline"
    return None


def apply_rate_valuation(rate: dict, context: str) -> dict:
    pid = reward_program(rate.get("rewardUnit", ""), context + " " + rate.get("label", ""))
    program = next((p for p in VALUATIONS["programs"] if p["id"] == pid), None)
    if not program:
        return rate
    out = dict(rate)
    out["unitValue"] = program["value"]
    if rate.get("monthlyCapUnits") is not None:
        out["monthlyCapValue"] = rate["monthlyCapUnits"] * program["value"]
    if rate.get("additionalMonthlyCapUnits") is not None:
        out["additionalMonthlyCapValue"] = rate["additionalMonthlyCapUnits"] * program["value"]
    return out


def apply_valuations(card: dict) -> dict:
    out = dict(card)
    out["rewardRates"] = [apply_rate_valuation(r, card.get("name", "")) for r in (card.get("rewardRates") or [])]
    return out


# --- reward-calculation.ts --------------------------------------------------------
def reward_at_spend(r: dict, spend: float):
    if not r.get("verified") or spend <= 0 or r.get("spendUnit", 0) <= 0 or r.get("unitValue", 0) <= 0:
        return None
    rate = r["rewardUnits"] * r["unitValue"] / r["spendUnit"]
    fallback = (r.get("fallbackRewardUnits") or 0) * r["unitValue"] / r["spendUnit"]
    additional = spend * max(0.0, rate - fallback)
    additional_cap = (
        r["additionalMonthlyCapUnits"] * r["unitValue"]
        if r.get("additionalMonthlyCapUnits") is not None
        else (r["additionalMonthlyCapValue"] if r.get("additionalMonthlyCapValue") is not None else float("inf"))
    )
    earning = spend * fallback + min(additional, additional_cap)
    if r.get("specialRewardCapUnits") is not None and r["rewardUnits"] > 0:
        eligible = min(spend, r["specialRewardCapUnits"] / r["rewardUnits"] * r["spendUnit"])
        earning = eligible * rate + (spend - eligible) * fallback
    total_cap = (
        r["monthlyCapUnits"] * r["unitValue"] if r.get("monthlyCapUnits") is not None else r.get("monthlyCapValue")
    )
    if total_cap is not None:
        earning = min(earning, total_cap)
    f = r.get("feeWaiver") or {}
    fee_rate = (
        f["rate"] / 100
        if f.get("verified") and f.get("rate") is not None and f.get("minimumSpend") is not None
        and f["minimumSpend"] <= r["minimumSpend"]
        else 0
    )
    fee = spend * fee_rate
    benefit = earning + fee
    return {"spend": spend, "earning": earning, "fee": fee, "benefit": benefit, "percentage": benefit / spend * 100}


# --- spending-allocation.ts -------------------------------------------------------
def allocate_spending(plan: dict):
    if (
        not plan.get("verified") or not plan.get("exclusiveStreamsVerified")
        or not plan.get("budget") or plan["budget"] <= 0 or plan.get("minimumSpend", 0) <= 0
        or not plan.get("rules")
    ):
        return None
    groups = plan.get("groups") or []
    rules = plan.get("rules") or []
    if any((not isinstance(g.get("cap"), (int, float)) or g["cap"] < 0) for g in groups):
        return None
    for r in rules:
        if not isinstance(r.get("ratePercent"), (int, float)) or not (0 <= r["ratePercent"] <= 100):
            return None
        if r.get("monthlyCap") is not None and (not isinstance(r["monthlyCap"], (int, float)) or r["monthlyCap"] < 0):
            return None
        if any(not any(g["id"] == gid for g in groups) for gid in (r.get("groupIds") or [])):
            return None
    caps = {g["id"]: g["cap"] for g in groups}
    remaining = plan["budget"]
    extra = 0.0
    allocations = []
    for r in sorted(rules, key=lambda r: (-r["ratePercent"], r["id"])):
        if not r["ratePercent"]:
            continue
        rate = r["ratePercent"] / 100
        cap = min([r["monthlyCap"] if r["monthlyCap"] is not None else float("inf")]
                  + [caps[gid] for gid in (r.get("groupIds") or [])])
        max_spend = r.get("maxSpend") if r.get("maxSpend") is not None else float("inf")
        ceiling = min(cap / rate if rate else float("inf"), max_spend)
        outside = bool(r.get("spendExcluded")) and ceiling != float("inf")
        if not outside and remaining <= 0:
            continue
        spend = min(float("inf") if outside else remaining, ceiling)
        benefit = spend * rate
        if spend <= 0:
            continue
        if outside:
            extra += spend
        else:
            remaining -= spend
        for gid in r.get("groupIds") or []:
            caps[gid] -= benefit
        allocations.append({"label": r["label"], "spend": spend, "benefit": benefit, "rate": r["ratePercent"],
                            "cap": r.get("monthlyCap"), "outside": outside})
    benefit = sum(a["benefit"] for a in allocations)
    total = plan["budget"] + extra
    return {"budget": plan["budget"], "benefit": benefit, "percentage": benefit / total * 100,
            "remaining": remaining, "extraSpend": extra, "totalSpend": total, "allocations": allocations}


# --- catalog-model.ts pickingOptions ---------------------------------------------
def is_niche(*texts) -> bool:
    return bool(NICHE_PICKING.search(" ".join(t for t in texts if t)))


def rate_cap(r: dict):
    if r.get("monthlyCapUnits") is not None:
        return r["monthlyCapUnits"] * r["unitValue"]
    return r.get("monthlyCapValue")


def picking(scenario: dict):
    if not scenario.get("verified") or not scenario.get("maximumVerified"):
        return None
    if scenario.get("calculation") == "unit-rate":
        v = scenario.get("grossBenefitRate")
        return v if isinstance(v, (int, float)) and v >= 0 else None
    if (
        scenario.get("calculation") != "tier-cap" or scenario.get("basis") != "minimum-tier"
        or not scenario.get("minimumEligibleSpend") or scenario.get("monthlyBenefit") is None
        or scenario["monthlyBenefit"] < 0
    ):
        return None
    return scenario["monthlyBenefit"] / scenario["minimumEligibleSpend"] * 100


def picking_options(card: dict):
    card = apply_valuations(card)
    if card.get("sourceReviewPending") or card.get("rewardCoveragePending"):
        return []
    fee_waivers = card.get("feeWaivers")
    if (
        (fee_waivers is not None and any(not f.get("verified") for f in fee_waivers))
        or (fee_waivers is None and card.get("rewardComponentsPending"))
        or any((r.get("feeWaiver") and not r["feeWaiver"].get("verified")) for r in (card.get("rewardRates") or []))
    ):
        return []

    options: list[dict] = []
    for s in card.get("pickingScenarios") or []:
        if is_niche(s.get("label")):
            continue
        value = picking(s)
        if value is not None:
            options.append({"value": value, "label": s.get("label"), "calculation": s.get("calculation"),
                            "spend": s.get("totalSpend") or s.get("minimumEligibleSpend"), "kind": "scenario"})

    for plan in card.get("spendingPlans") or []:
        rules = [dict(r, spendExcluded=r.get("spendExcluded", card.get("benefitSpendExcluded")),
                      maxSpend=r.get("maxSpend", SUBSCRIPTION_SPEND if SUBSCRIPTION.search(r.get("label", "")) else None))
                 for r in plan.get("rules") or [] if not is_niche(r.get("label"))]
        if not rules:
            continue
        result = allocate_spending(dict(plan, rules=rules))
        if not result or result["benefit"] <= 0:
            continue
        options.append({"value": result["percentage"], "label": plan.get("label"), "calculation": "tier-cap",
                        "spend": result["totalSpend"], "benefit": result["benefit"], "kind": "plan"})

    rates = [r for r in (card.get("rewardRates") or [])
             if r.get("verified") and r.get("spendUnit", 0) > 0 and r.get("unitValue", 0) > 0
             and r.get("rewardUnits", 0) >= 0 and not is_niche(r.get("label"), r.get("serviceTitle"))]
    if not card.get("rewardModelComplete") and any(
        (r.get("minimumSpend") or 0) > 0 and r.get("monthlyCapValue") is not None
        and r["monthlyCapValue"] < (r.get("minimumSpend") or 0) * r["rewardUnits"] * r["unitValue"] / r["spendUnit"]
        for r in rates
    ):
        return options

    if card.get("rewardModelComplete") or any((r.get("minimumSpend") or 0) == 0 for r in rates):
        for r in rates:
            rate = r["rewardUnits"] * r["unitValue"] / r["spendUnit"]
            cap = rate_cap(r)
            fixed = rate >= 1
            sub = bool(SUBSCRIPTION.search(r.get("label", "")))
            excluded = r.get("spendExcluded", card.get("benefitSpendExcluded")) or False
            # 전월실적을 다른 영역(예: 국내)에서 채우는 요율 — 같은 금액을 이 영역에도 쓴 경우
            if (r.get("minimumSpend") or 0) > 0 and r.get("minimumSpendArea"):
                result = reward_at_spend(r, r["minimumSpend"])
                if not result:
                    continue
                base_rate = (r.get("minimumSpendAreaRewardUnits") or 0) * r["unitValue"] / r["spendUnit"]
                base = r["minimumSpend"] * base_rate
                points = min(base + result["earning"], cap if cap is not None else float("inf"))
                total = r["minimumSpend"] * 2
                benefit = points + result["fee"]
                options.append({"value": benefit / total * 100, "label": r.get("label"), "calculation": "tier-cap",
                                "spend": total, "benefit": benefit, "kind": "rate", "otherArea": r.get("minimumSpendArea")})
                continue
            if (r.get("minimumSpend") or 0) > 0 and (
                card.get("rewardModelComplete") or r.get("additionalMonthlyCapValue") is not None or fixed
            ):
                if fixed and cap is None:
                    continue
                fill = float("inf") if cap is None else cap / rate
                spend = cap if fixed else r["minimumSpend"]
                if sub:
                    spend = min(spend, SUBSCRIPTION_SPEND)
                outside = excluded and fill != float("inf")
                if outside:
                    spend = min(fill, SUBSCRIPTION_SPEND if sub else float("inf"))
                result = reward_at_spend(r, spend)
                if not result:
                    continue
                total = r["minimumSpend"] + spend if outside else r["minimumSpend"]
                options.append({"value": result["benefit"] / total * 100, "label": r.get("label"),
                                "calculation": "tier-cap", "spend": total, "benefit": result["benefit"],
                                "kind": "rate", "outside": outside})
                continue
            earning = rate * 100
            waiver = (r.get("feeWaiver")
                      if r.get("feeWaiver", {}).get("verified") and r["feeWaiver"].get("rate") is not None
                      and r["feeWaiver"].get("minimumSpend") is not None
                      and r["feeWaiver"]["minimumSpend"] <= r["minimumSpend"] else None)
            if (r.get("minimumSpend") or 0) > 0 and cap is not None and cap < r["minimumSpend"] * earning / 100:
                continue
            if (r.get("minimumSpend") or 0) == 0 and cap is not None and cap / rate < REFERENCE_SPEND:
                result = reward_at_spend(r, REFERENCE_SPEND)
                if not result:
                    continue
                options.append({"value": result["percentage"], "label": r.get("label"), "calculation": "tier-cap",
                                "spend": REFERENCE_SPEND, "benefit": result["benefit"], "kind": "rate",
                                "referenceSpend": True})
                continue
            value = earning + (waiver.get("rate") or 0 if waiver else 0)
            options.append({"value": value, "label": r.get("label"), "calculation": "unit-rate",
                            "spend": None, "kind": "rate", "waiver": (waiver or {}).get("rate")})
    return options


def best(options):
    return max(options, key=lambda o: o["value"]) if options else None


# --- 검수 -------------------------------------------------------------------------
def audit(cards: list[dict], terms: dict, detail: bool):
    term_by_id = {c.get("cardId"): c for c in terms.get("cards", [])}
    findings = {k: [] for k in ("A1", "A2", "A3", "A4", "A5", "B1", "B2", "C1", "C2")}
    stats = {"cards": len(cards), "withPicking": 0, "withRates": 0, "withTerms": 0, "pending": 0}

    for card in cards:
        cid = card["id"]
        rates = card.get("rewardRates") or []
        if rates:
            stats["withRates"] += 1
        options = picking_options(card)
        if options:
            stats["withPicking"] += 1
        if card.get("rewardCoveragePending"):
            stats["pending"] += 1
        if cid in term_by_id:
            stats["withTerms"] += 1

        # A1 수수료 면제가 적립률에 더해짐
        for r in rates:
            f = r.get("feeWaiver")
            if not f:
                continue
            option = next((o for o in options if o.get("label") == r.get("label")), None)
            findings["A1"].append({
                "id": cid, "name": card["name"], "rate": r.get("label"),
                "value": round(option["value"], 2) if option else None,
                "waiver": f.get("rate"), "waiverMinimumSpend": f.get("minimumSpend"),
                "rateMinimumSpend": r.get("minimumSpend"),
                "note": "면제 %가 같은 적립률에 더해져 표시" if f.get("rate") and (f.get("minimumSpend") or 0) <= (r.get("minimumSpend") or 0) else "면제 조건 미충족으로 미포함",
            })

        # A2 실적 조건 영역 ≠ 혜택 영역 (minimumSpendArea 로 고치지 않은 것만)
        for r in rates:
            if (r.get("minimumSpend") or 0) <= 0 or r.get("minimumSpendArea"):
                continue
            text = " ".join(filter(None, [(r.get("label") or ""), (r.get("note") or "")[:160]]))
            benefit_area = bool(FOREIGN_AREA.search(text))
            other_area = bool(OTHER_AREA_SPEND.search(text))
            if benefit_area and other_area:
                option = next((o for o in options if o.get("label") == r.get("label")), None)
                findings["A2"].append({
                    "id": cid, "name": card["name"], "rate": r.get("label"),
                    "minimumSpend": r.get("minimumSpend"), "value": round(option["value"], 2) if option else None,
                    "spend": option.get("spend") if option else None,
                    "note": (r.get("note") or "")[:120],
                })

        # A3 5% 초과 (한도 없는 요율은 고쳐야 함)
        for o in options:
            if o["value"] > 5:
                rate = next((r for r in rates if r.get("label") == o.get("label")), None)
                rated_cap = rate_cap(rate) if rate else None
                findings["A3"].append({"id": cid, "name": card["name"], "label": o.get("label"),
                                       "value": round(o["value"], 2), "spend": o.get("spend"),
                                       "kind": o.get("kind"), "cap": rated_cap})

        # A4 요율 일부만 있고 모델 미완성
        if rates and not card.get("rewardModelComplete") and not card.get("rewardCoveragePending"):
            findings["A4"].append({"id": cid, "name": card["name"], "rates": len(rates),
                                   "picking": round(best(options)["value"], 2) if options else None,
                                   "benefits": len(card.get("benefits") or [])})

        # A5 혜택·실적 표기와 요율 모델 불일치
        benefits = card.get("benefits") or []
        if benefits and rates:
            positive = [b.get("minimumSpend") for b in benefits if (b.get("minimumSpend") or 0) > 0]
            rate_min = [r.get("minimumSpend") or 0 for r in rates]
            if positive and rate_min and min(rate_min) > min(positive):
                findings["A5"].append({"id": cid, "name": card["name"],
                                       "benefitMinSpend": min(positive), "rateMinSpend": min(rate_min),
                                       "rates": len(rates)})
            elif len(rates) == 1 and len([b for b in benefits if b.get("rate")]) > 2:
                findings["A5"].append({"id": cid, "name": card["name"], "benefitMinSpend": min(positive) if positive else 0,
                                       "rateMinSpend": min(rate_min), "rates": 1,
                                       "benefitLines": len([b for b in benefits if b.get("rate")])})

        # B1 정리본은 있는데 요율 모델 없음
        if cid in term_by_id and not options:
            t = term_by_id[cid]
            findings["B1"].append({"id": cid, "name": card["name"], "issuer": card.get("issuer"),
                                   "termBenefits": len(t.get("benefits") or []),
                                   "minimumSpend": t.get("minimumSpend"), "rates": len(rates),
                                   "pending": bool(card.get("rewardCoveragePending")),
                                   "benefits": len(benefits)})

        # B2 정리본 혜택 표가 더 자세함
        if cid in term_by_id:
            t = term_by_id[cid]
            tb = len(t.get("benefits") or [])
            if tb and len(benefits) and tb > len(benefits) * 1.5:
                findings["B2"].append({"id": cid, "name": card["name"], "cardBenefits": len(benefits),
                                       "termBenefits": tb})

        # C1 혜택 줄이 추상 문구만 있음 (제목 또는 첫 줄이 '선택 옵션 대상 업종'·'… 자세히보기')
        for b in benefits:
            title = (b.get("title") or "").strip()
            first = re.split(r"\s*/\s*|\n", (b.get("detail") or "").strip())[0].strip()
            if abstract_only(title) or abstract_only(first):
                findings["C1"].append({"id": cid, "name": card["name"], "title": title or first,
                                       "detail": (b.get("detail") or "")[:60]})
                break

        # C2 혜택 인정인데 전월실적이 ? — 카드 값이 0인 무실적 카드는 화면 규칙(spendFreeCard)이 ✓로 채우므로 뺌
        pe = card.get("paymentEligibility") or {}
        unknown = [k for k in ELIGIBILITY_KEYS
                   if (pe.get(k) or {}).get("benefit") == "allowed" and (pe.get(k) or {}).get("spend") == "unknown"]
        if unknown and not (card.get("minimumSpend") == 0 and not spends_positive(card)):
            findings["C2"].append({"id": cid, "name": card["name"], "items": unknown,
                                   "minimumSpend": card.get("minimumSpend"),
                                   "무실적": not spends_positive(card)})
    return findings, stats


def summarize(findings, stats, detail: bool) -> str:
    lines = []
    lines.append("# Mr. Cards 피킹률·혜택 전수 검사")
    lines.append("")
    lines.append("> `python3 tools/data/picking_audit.py --md docs/picking-audit.md`가 만든 검사 결과입니다. 손으로 고치지 말고 다시 생성하세요.")
    lines.append("> 화면과 같은 순서(`catalog-snapshot.json` → `verified-card-rules.json.gz` → `terms-rules.json.gz` → `picking-review.json`)로 계산하고, `pickingOptions()`(lib/catalog-model.ts)를 그대로 옮겨 쓴 사본입니다.")
    lines.append("")
    lines.append(f"- 검사일 {datetime.now(KST).strftime('%Y-%m-%d %H:%M')} · "
                 f"카드 {stats['cards']:,}장 · 요율 모델 있음 {stats['withRates']:,}장 · "
                 f"피킹률 계산됨 {stats['withPicking']:,}장 · 상품설명서 정리본 {stats['withTerms']:,}장 · "
                 f"요율 확인 대기(rewardCoveragePending) {stats['pending']:,}장")
    titles = {
        "A1": "A1 수수료 면제를 요율에 더한 카드(가정과 원문 확인)",
        "A2": "A2 전월실적 조건 영역과 혜택 영역이 다른 카드",
        "A3": "A3 피킹률 5% 초과(한도·근거 확인)",
        "A4": "A4 요율 일부만 있고 모델 완성 표시가 없는 카드",
        "A5": "A5 (참고) 혜택별 실적이 달라 요율 모델이 일부 영역만 덮는 카드",
        "B1": "B1 상품설명서 정리본은 있는데 피킹률이 비는 카드",
        "B2": "B2 정리본 혜택 표가 카드 DB보다 자세한 카드",
        "C1": "C1 혜택 줄이 추상 문구만 있는 카드(대상 업종·가맹점 없음)",
        "C2": "C2 혜택은 인정인데 전월실적이 ?로 남은 칸",
    }
    for key in titles:
        items = findings[key]
        lines.append("")
        lines.append(f"## {titles[key]} — {len(items)}건")
        if not items:
            lines.append("")
            lines.append("없음.")
            continue
        lines.append("")
        if detail:
            lines.append("| 카드 | id | 내용 |")
            lines.append("|---|---|---|")
            for it in items:
                rest = {k: v for k, v in it.items() if k not in ("id", "name")}
                lines.append(f"| {it['name']} | `{it['id']}` | {json.dumps(rest, ensure_ascii=False)} |")
        else:
            for it in items[:60]:
                rest = {k: v for k, v in it.items() if k not in ("id", "name")}
                lines.append(f"- {it['name']} (`{it['id']}`) {json.dumps(rest, ensure_ascii=False)}")
            if len(items) > 60:
                lines.append(f"- … 외 {len(items) - 60}건 (--detail 로 전체 표)")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="Mr. Cards 피킹률·혜택 전수 검수")
    ap.add_argument("--md", help="결과를 마크다운 파일로 저장")
    ap.add_argument("--card", help="이 카드 하나만 계산 결과를 보여 줌")
    ap.add_argument("--detail", action="store_true", help="문제 목록을 표로 전부 출력")
    args = ap.parse_args()

    cards = apply_verified_rules(load("catalog-snapshot.json")["cards"])
    try:
        terms = load("card-terms.json")
    except FileNotFoundError:
        terms = {"cards": []}  # 배포 때 inbox.py merge가 만드는 파일(저장소에 없음)

    if args.card:
        card = next((c for c in cards if c["id"] == args.card), None)
        if not card:
            print(f"카드 없음: {args.card}", file=sys.stderr)
            return 2
        print(json.dumps({"id": card["id"], "name": card["name"],
                          "rewardModelComplete": card.get("rewardModelComplete"),
                          "rewardCoveragePending": card.get("rewardCoveragePending"),
                          "rates": card.get("rewardRates"), "options": picking_options(card)},
                         ensure_ascii=False, indent=1))
        return 0

    findings, stats = audit(cards, terms, args.detail)
    report = summarize(findings, stats, args.detail)
    if args.md:
        Path(args.md).write_text(report, encoding="utf-8")
        print(f"{args.md} 저장 · 카드 {stats['cards']:,}장 · 피킹률 {stats['withPicking']:,}장")
    else:
        print(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
