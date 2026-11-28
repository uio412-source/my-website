#!/usr/bin/env python3
"""Mr. Cards 발급 이벤트(네이버페이 · 카카오페이 · 아정당 · 뽐뿌) 수집기.

    python3 tools/data/fetch_issuance_events.py            # 4개 출처를 모두 다시 받아 갱신
    python3 tools/data/fetch_issuance_events.py --only naver,kakaopay
    python3 tools/data/fetch_issuance_events.py --dry-run  # 파일을 쓰지 않고 결과만 확인

결과는 `paymorevent/data/issuance-events.json` 한 파일에 담고, 화면(Mr. Cards 발급이벤트)이
그 파일만 읽어 표를 그립니다. 이벤트마다 무실적 요구 개월(noPaymentMonths) · 이벤트 수령
제한 개월(noRewardMonths) · 기존 카드 보유자 참여 가능 여부(allowExistingHolder) ·
탈회 제한 개월(excludeCanceledMonths) · 원문 조건(eligibilityRuleText)을 담습니다.

출처별 사정
- 네이버페이: 목록·상세 페이지에 Next.js `__NEXT_DATA__`가 그대로 실려 있어 HTML만 읽습니다.
- 카카오페이: 목록은 HTML, 상세는 RSC 헤더(`RSC: 1`)로 받은 flight 데이터를 풀어 읽습니다.
- 아정당: 목록·상세 페이지의 `data-mfe-state` JSON을 읽습니다.
- 뽐뿌: 봇 차단(403)이 잦습니다. `--ppomppu-file`에 브라우저로 읽어 저장한 목록 JSON
  (`[{"title":…, "url":…, "date":…}, …]`)을 주면 그 값을 씁니다. 없으면 지난 수집의
  뽐뿌 항목을 그대로 남깁니다.
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "paymorevent" / "data" / "issuance-events.json"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")
TODAY = dt.date.today()

SOURCES = {
    "naver": {"name": "네이버페이", "url": "https://card.pay.naver.com/home/promotion/event"},
    "kakaopay": {"name": "카카오페이", "url": "https://card-hub.kakaopay.com/events"},
    "ajd": {"name": "아정당", "url": "https://www.ajd.co.kr/card/event/list"},
    "ppomppu": {"name": "뽐뿌", "url": "https://www.ppomppu.co.kr/zboard/zboard.php?id=card_market"},
}

ISSUERS = {
    "CCLG": "신한카드", "CCDI": "현대카드", "CCLO": "롯데카드", "CCKM": "KB국민카드",
    "CCSS": "삼성카드", "CCHN": "하나카드", "CCNH": "NH농협카드", "CCBC": "BC카드",
    "CCWO": "우리카드", "CCIB": "IBK기업은행", "CCSC": "SC제일은행",
    "SHINHAN": "신한카드", "HYUNDAI": "현대카드", "LOTTE": "롯데카드", "KB": "KB국민카드",
    "SAMSUNG": "삼성카드", "HANA": "하나카드", "NH": "NH농협카드", "BC": "BC카드",
    "WOORI": "우리카드", "IBK": "IBK기업은행",
}
ISSUER_WORDS = [
    ("KB국민", "KB국민카드"), ("국민", "KB국민카드"), ("신한", "신한카드"), ("삼성", "삼성카드"),
    ("현대", "현대카드"), ("롯데", "롯데카드"), ("우리", "우리카드"), ("하나", "하나카드"),
    ("농협", "NH농협카드"), ("NH", "NH농협카드"), ("비씨", "BC카드"), ("BC", "BC카드"),
    ("기업은행", "IBK기업은행"), ("IBK", "IBK기업은행"), ("기업", "IBK기업은행"),
]


# ---------------------------------------------------------------- 공통
def get(url: str, headers: dict | None = None, timeout: int = 25) -> str:
    h = {"User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9"}
    h.update(headers or {})
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
    for enc in ("utf-8", "euc-kr", "cp949"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "ignore")


def decode_flight(s: str) -> str:
    """RSC flight 데이터의 \\uXXXX·\\n 이스케이프를 풀고 JSON 구두점을 걷어 낸다"""
    s = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), s)
    s = s.replace("\\n", "\n").replace('\\"', '"').replace("\\/", "/")
    s = re.sub(r'\[\s*"(?:\$|\d)', " ", s)
    s = s.replace('","', " ").replace('"],"', " ").replace('"', "")
    return s


def collect_text(obj) -> str:
    out: list[str] = []
    if isinstance(obj, str):
        out.append(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            out.append(collect_text(v))
    elif isinstance(obj, list):
        for v in obj:
            out.append(collect_text(v))
    return "\n".join(x for x in out if x)


def strip_tags(s: str) -> str:
    s = re.sub(r"<br\s*/?>", "\n", s or "", flags=re.I)
    s = re.sub(r"</(?:p|div|li|h\d)>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"[ \t\u00a0]+", " ", s)


def flat(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()


def ymd(s: str | None) -> str | None:
    if not s:
        return None
    m = re.search(r"(\d{2,4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})", s)
    if not m:
        return None
    y = int(m.group(1))
    if y < 100:
        y += 2000
    return f"{y:04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"


def won(text: str) -> int | None:
    """'최대 31만원' · '104만원' · '17.5만원' → 원 단위 정수"""
    if not text:
        return None
    best = None
    for m in re.finditer(r"(\d+(?:\.\d+)?)\s*(만)?\s*원", text):
        n = float(m.group(1)) * (10000 if m.group(2) else 1)
        if best is None or n > best:
            best = int(n)
    return best


def months_between(a: dt.date, b: dt.date) -> int:
    return (b.year - a.year) * 12 + (b.month - a.month) + (1 if b.day >= a.day else 0)


def clean(s: str, limit: int = 220) -> str:
    s = flat(strip_tags(s))
    s = re.sub(r"^[\s·•\-*.\u3000\d)\(]+(?=\s|[가-힣])", "", s)
    s = re.sub(r"^(?:\d{1,3})\s*[).]\s*", "", s)
    return s.strip()[:limit]


# ---------------------------------------------------------------- 조건 해석
NO_PAY = [
    r"(?:직전|최근|행사\s*직전|이벤트\s*직전)\s*(\d{1,2})\s*개월[^.\n]{0,90}?(?:이용|결제|사용)[^.\n]{0,20}?(?:이력|실적|내역)",
    r"(\d{1,2})\s*개월[^.\n]{0,60}?(?:이용|결제)[^.\n]{0,30}?(?:이력|실적)[^.\n]{0,15}?없",
    r"(\d{1,2})\s*개월\s*이내[^.\n]{0,60}?(?:이용|결제)\s*이력",
    r"직전\s*(\d{1,2})\s*개월\s*간[^.\n]{0,80}?결제\s*이력이\s*없",
]
NO_REWARD = [
    r"(?:직전|최근)\s*(\d{1,2})\s*개월[^.\n]{0,70}?(?:이벤트|프로모션)[^.\n]{0,30}?혜택[^.\n]{0,25}?(?:받|수령|제공)",
    r"(?:이벤트|프로모션)\s*혜택[^.\n]{0,40}?(?:받은|수령한)\s*이력[^.\n]{0,40}?(\d{1,2})\s*개월",
    r"(\d{1,2})\s*개월[^.\n]{0,40}?(?:이벤트|프로모션)[^.\n]{0,20}?혜택[^.\n]{0,20}?(?:받|수령|제공)",
]
CANCEL = [
    r"탈회[^.\n]{0,30}?(\d{1,2})\s*개월[^.\n]{0,20}?(?:이력|없|이내)",
    r"(\d{1,2})\s*개월[^.\n]{0,25}?탈회\s*이력",
    r"탈회\s*이력[^.\n]{0,25}?(\d{1,2})\s*개월",
]


def first_month(text: str, patterns: list[str]) -> int | None:
    for p in patterns:
        m = re.search(p, text)
        if m:
            try:
                n = int(m.group(1))
            except (TypeError, ValueError):
                continue
            if 1 <= n <= 36:
                return n
    return None


def reward_months(text: str) -> int | None:
    n = first_month(text, NO_REWARD)
    if n:
        return n
    if re.search(r"(?:이벤트|프로모션)\s*혜택[^.\n]{0,30}?(?:받은|수령한)\s*이력", text):
        if re.search(r"직전\s*1\s*년|최근\s*1\s*년|1년\s*(?:간|이내)[^.\n]{0,30}?혜택", text):
            return 12
    return None


def holder_rule(text: str, has_payment_rule: bool) -> bool | str | None:
    """false = 신규/미보유만, 'target_card_only' = 대상 카드만 이력 없으면 됨, true = 보유자도 가능"""
    for s in sentences(text):
        if (re.search(r"대상\s*카드", s) and re.search(r"(?:이용|결제|사용)\s*(?:이력|내역)", s)
                and not re.search(r"모든|전체", s)):
            return "target_card_only"
    if re.search(r"대상\s*카드[^.]{0,20}?(?:이용|결제|사용)\s*(?:이력|내역)", text) and not re.search(r"모든|전체", text):
        return "target_card_only"
    if re.search(r"(?:대상\s*카드|카드)를?\s*보유하지\s*않은\s*회원|신규\s*발급\s*회원만", text):
        return False
    if re.search(r"기존\s*(?:회원|보유자)[^.\n]{0,30}?(?:가능|대상|혜택)|보유한\s*회원도\s*대상", text):
        return True
    return True if has_payment_rule else None


def spend_condition(text: str) -> str | None:
    """'25만원 이상 결제' 가운데 가장 작은 금액(기본 조건). 추가 구간(300만원…)은 뒤로 밀림"""
    found = []
    for m in re.finditer(r"(\d[\d,]*)\s*만\s*원\s*이상[^.\n]{0,24}?(?:결제|이용|사용)", text):
        found.append((int(m.group(1).replace(",", "")), flat(m.group(0))))
    if not found:
        return None
    # 500만원을 넘는 금액은 대개 추가 구간(예: 3,000만원 이상 추가 결제)이라 기본 조건으로 쓰지 않는다
    base = [x for x in found if 10 <= x[0] <= 500] or [x for x in found if x[0] <= 500]
    return min(base, key=lambda x: x[0])[1] if base else None


def rule_sentence(text: str) -> str | None:
    """원문에서 무실적·대상 조건 문장만 골라 보여 준다"""
    t = flat(strip_tags(text))
    for p in NO_PAY:
        m = re.search(p, t)
        if m:
            start = max(t.rfind(".", 0, m.start()), t.rfind("·", 0, m.start()), 0)
            end = min([x for x in (t.find(".", m.end()), t.find("·", m.end())) if x > 0] or [len(t)])
            return clean(t[start:end + 1], 200)
    for s in sentences(strip_tags(text)):
        if re.search(r"(이력|실적)", s) and ("결제" in s or "이용" in s) and ("없" in s or "제외" in s):
            return clean(s, 200)
    for p in (r"(?:^|[·.\n])\s*대상\s*:[^.\n]{8,180}", r"(?:^|[·.\n])\s*대상\s*카드[^.\n]{8,180}"):
        m = re.search(p, t)
        if m:
            return clean(m.group(0), 200)
    return None


def sentences(text: str) -> list[str]:
    """'-'·'·'·줄바꿈으로 나뉜 안내 문장"""
    parts = re.split(r"\s*[\n\r]+\s*|\s*[-·•ㆍ]\s*|(?<=[.!?])\s+", text)
    return [p.strip() for p in parts if len(p.strip()) > 8]


def months_in(s: str) -> int | None:
    m = re.search(r"(\d{1,2})\s*개월", s)
    if m:
        n = int(m.group(1))
        return n if 1 <= n <= 36 else None
    m = re.search(r"(\d)\s*년", s)
    if m and re.search(r"(?:직전|최근|이전|이내|간)", s):
        return int(m.group(1)) * 12
    return None


def scan(text: str) -> dict:
    """문장마다 무실적·탈회·이벤트 수령 제한을 찾는다 (청구·환수 문장은 뺼)"""
    no_pay = no_reward = cancel = None
    for s in sentences(text):
        claw = ("청구" in s or "출금" in s or "환수" in s or "환산" in s)
        n = months_in(s)
        if not n:
            continue
        if (no_pay is None and not claw and re.search(r"(결제|이용|사용)", s)
                and re.search(r"(이력|실적|내역)", s)
                and ("없" in s or ("제외" in s and "있" in s))
                and not ("탈회" in s and "이력" not in s)):
            no_pay = n
        if cancel is None and "탈회" in s and not claw and ("이력" in s or "없" in s or "제외" in s):
            cancel = n
        if (no_reward is None and not claw and "이벤트" in s and "혜택" in s
                and re.search(r"(받|수령|제공)", s) and "이력" in s):
            no_reward = n
    return {"noPaymentMonths": no_pay, "noRewardMonths": no_reward, "excludeCanceledMonths": cancel}


def eligibility(text: str) -> dict:
    t = flat(strip_tags(text))
    found = scan(t)
    no_pay = found["noPaymentMonths"] or first_month(t, NO_PAY)
    no_reward = found["noRewardMonths"] or reward_months(t)
    cancel = found["excludeCanceledMonths"] or first_month(t, CANCEL)
    if no_pay and no_pay > 24:  # 36개월 할부 같은 문장은 무실적 조건이 아니다
        no_pay = None
    if no_reward not in (None, 6, 12, 18, 24, 36):
        no_reward = None
    if cancel not in (None, 6, 12, 24):
        cancel = None
    holder = holder_rule(t, bool(no_pay))
    summary = []
    if no_pay:
        summary.append(f"직전 {no_pay}개월 {holder == 'target_card_only' and '대상 카드 ' or ''}결제 이력 없음")
    if cancel:
        summary.append(f"탈회 {cancel}개월 이내 불가")
    if no_reward:
        summary.append(f"{no_reward}개월 내 이벤트 혜택 수령 불가")
    if holder is False:
        summary.append("신규 발급만")
    elif holder == "target_card_only":
        summary.append("대상 카드만 이력 없으면 가능")
    return {
        "noPaymentMonths": no_pay,
        "noRewardMonths": no_reward,
        "excludeCanceledMonths": cancel,
        "allowExistingHolder": holder,
        "eligibilitySummary": " · ".join(summary) if summary else None,
        "eligibilityRuleText": rule_sentence(text),
    }


def make_id(source: str, raw: str) -> str:
    return f"{source}-{re.sub(r'[^a-z0-9]+', '-', raw.lower()).strip('-')}"[:80]


def event(source: str, eid: str, issuer: str, card: str, title: str, benefit_text: str,
          text: str, starts: str | None, ends: str | None, url: str, **extra) -> dict:
    cond = eligibility(text)
    item = {
        "id": make_id(source, eid),
        "source": SOURCES[source]["name"],
        "sourceId": source,
        "issuer": issuer,
        "cardName": flat(card) or None,
        "title": clean(title, 120),
        "benefitText": clean(benefit_text, 60) if benefit_text else None,
        "benefitAmount": won(benefit_text or title),
        "spendCondition": spend_condition(text),
        "period": f"{starts} ~ {ends}" if starts and ends else None,
        "startsAt": starts,
        "endsAt": ends,
        "url": url,
        **cond,
    }
    item.update({k: v for k, v in extra.items() if v not in (None, "", [])})
    return item


# ---------------------------------------------------------------- 네이버페이
def fetch_naver(limit: int | None) -> list[dict]:
    base = "https://card.pay.naver.com"
    page = get(SOURCES["naver"]["url"])
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', page, re.S)
    if not m:
        raise RuntimeError("__NEXT_DATA__ 없음")
    state = json.loads(m.group(1))["props"]["pageProps"]["dehydratedState"]["queries"]
    promos: list[dict] = []
    for q in state:
        data = q.get("state", {}).get("data")
        if isinstance(data, dict) and isinstance(data.get("result"), list):
            promos = data["result"]
    if not promos:
        raise RuntimeError("프로모션 목록 비어 있음")
    out = []
    for p in promos[: limit or None]:
        pid = p.get("promotionId")
        if not pid:
            continue
        url = f"{base}/home/promotion?cardCompanyId={p.get('cardCompanyId','')}&promotionId={pid}"
        try:
            detail_page = get(url)
            dm = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', detail_page, re.S)
            d = json.loads(dm.group(1))["props"]["pageProps"]["dehydratedState"]["queries"][0]["state"]["data"]["result"]
        except Exception as exc:  # 한 건이 실패해도 나머지는 담는다
            print(f"  · 네이버 {pid} 상세 실패: {exc}", file=sys.stderr)
            d = {}
        text = "\n".join(str(d.get(k) or "") for k in ("applyingQualification", "note", "warningLabel", "lateFee"))
        text += "\n" + collect_text(d.get("benefits"))
        text = strip_tags(text)
        offer = d.get("promotionOffer") or p.get("promotionOffer") or ""
        issuer = ISSUERS.get(p.get("cardCompanyId", ""), "")
        card = p.get("cardProductName") or ""
        out.append(event(
            "naver", pid, issuer, card,
            title=f"{card} {offer}".strip(),
            benefit_text=offer, text=text,
            starts=ymd(d.get("eventStart")), ends=ymd(d.get("eventEnd")),
            url=url,
            cardName=card,
        ))
        time.sleep(0.2)
    return out


# ---------------------------------------------------------------- 카카오페이
CORP = {"KB": "KB국민카드", "SHINHAN": "신한카드", "WOORI": "우리카드", "HANA": "하나카드",
        "SAMSUNG": "삼성카드", "NH": "NH농협카드", "IBK": "IBK기업은행", "BC": "BC카드",
        "LOTTE": "롯데카드", "HYUNDAI": "현대카드"}


def fetch_kakaopay(limit: int | None) -> list[dict]:
    base = "https://card-hub.kakaopay.com"
    listing = get(f"{base}/events/current/credit")
    rows: list[tuple[str, str, str]] = []
    seen_link = set()
    for m in re.finditer(r'<a[^>]+href="(/events/current/credit/detail/([0-9a-f]{24})\?cardCorp=([A-Z]+)[^"]*)"[^>]*>(.*?)</a>', listing, re.S):
        href, eid, corp, inner = m.groups()
        label = flat(strip_tags(inner))
        if label and eid not in seen_link:
            seen_link.add(eid)
            rows.append((eid, corp, label))
    seen = set()
    out = []
    for eid, corp, label in rows[: limit or None]:
        if eid in seen:
            continue
        seen.add(eid)
        url = f"{base}/events/current/credit/detail/{eid}?cardCorp={corp}"
        try:
            stream = get(url, headers={"RSC": "1", "Accept": "text/x-component"})
            text = strip_tags(decode_flight(stream))
        except Exception as exc:
            print(f"  · 카카오 {eid} 상세 실패: {exc}", file=sys.stderr)
            text = ""
        offer = re.search(r"(?:최대\s*)?[\d.]+\s*만\s*원|연회비\s*캐시백", label)
        card = re.split(r"\s*쓰고\s*", label)[0]
        card = re.sub(r"^(?:최대\s*)?[\d.]+\s*만\s*원.*", "", card).strip()
        period = re.search(r"(\d{2})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?[^\d~]{0,10}~\s*(\d{2})\.\s*(\d{1,2})\.\s*(\d{1,2})", text)
        starts = ymd(".".join(period.group(1, 2, 3))) if period else None
        ends = ymd(".".join(period.group(4, 5, 6))) if period else None
        out.append(event(
            "kakaopay", eid, CORP.get(corp, ""), card,
            title=f"{card} {offer.group(0) if offer else ''}".strip() or label,
            benefit_text=offer.group(0) if offer else "",
            text=text, starts=starts, ends=ends, url=url,
        ))
        time.sleep(0.2)
    return out


# ---------------------------------------------------------------- 아정당
def fetch_ajd(limit: int | None) -> list[dict]:
    page = get(SOURCES["ajd"]["url"])
    m = re.search(r'<script type="application/json" data-mfe-state>(.*?)</script>', page, re.S)
    if not m:
        raise RuntimeError("data-mfe-state 없음")
    events = json.loads(m.group(1)).get("events", [])
    out = []
    for ev in events[: limit or None]:
        sn = ev.get("sn")
        url = f"https://www.ajd.co.kr/card/event/detail/{sn}"
        text, card, benefit = "", "", ev.get("shortTitle") or ""
        try:
            d = json.loads(re.search(r'<script type="application/json" data-mfe-state>(.*?)</script>', get(url), re.S).group(1))
            full = d.get("fullEvent") or {}
            chunks, names = [], []
            for sec in full.get("sections", []):
                if sec.get("title"):
                    chunks.append(sec["title"])
                if sec.get("body"):
                    chunks.append(sec["body"])
                for it in sec.get("items") or []:
                    if it.get("type") == "card" and it.get("cardName"):
                        names.append(it["cardName"])
                        if it.get("benefitText"):
                            chunks.append(it["benefitText"])
                    elif it.get("text"):
                        chunks.append(it["text"])
            text = collect_text(full)
            card = ", ".join(dict.fromkeys(names[:3]))
            benefit = full.get("shortTitle") or benefit
        except Exception as exc:
            print(f"  · 아정당 {sn} 상세 실패: {exc}", file=sys.stderr)
        out.append(event(
            "ajd", str(sn), ev.get("issuer", ""), card or ev.get("title", ""),
            title=ev.get("title") or benefit,
            benefit_text=benefit, text=text,
            starts=ev.get("startDate"), ends=ev.get("endDate"), url=url,
            benefitValue=ev.get("benefitValue"),
        ))
        time.sleep(0.15)
    return out


# ---------------------------------------------------------------- 뽐뿌
def fetch_ppomppu(limit: int | None, file: str | None) -> list[dict]:
    rows: list[dict] = []
    if file:
        rows = json.loads(Path(file).read_text(encoding="utf-8"))
    else:
        try:
            page = get(SOURCES["ppomppu"]["url"])
            for m in re.finditer(r'<a[^>]+href="([^"]*view\.php\?id=card_market[^"]*)"[^>]*>(.*?)</a>', page, re.S):
                label = flat(strip_tags(m.group(2)))
                if len(label) > 8:
                    rows.append({"title": label, "url": html.unescape(m.group(1))})
        except Exception as exc:
            print(f"  · 뽐뿌 차단/실패({exc}) — 지난 항목을 유지합니다.", file=sys.stderr)
            return []
    out, seen = [], set()
    for r in rows:
        title = flat(r.get("title") or "")
        if len(title) < 5:
            continue
        compact = re.sub(r"\s+", "", title)
        issuer = next((name for word, name in ISSUER_WORDS if word in compact), "")
        url = r.get("url") or SOURCES["ppomppu"]["url"]
        key = (issuer, title[:40])
        if key in seen:
            continue
        seen.add(key)
        row = event(
            "ppomppu", re.sub(r"\D", "", url)[-12:] or title[:20], issuer, "",
            title=title, benefit_text=r.get("benefitText") or "",
            text=(r.get("body") or ""), starts=None, ends=None, url=url,
            note=r.get("note") or "업체 문의(금액·조건은 게시글 이미지·쪽지 안내)",
        )
        row["benefitAmount"] = won(title) if re.search(r"\d\s*만\s*원", title) else r.get("benefitAmount")
        out.append(row)
        if limit and len(out) >= limit:
            break
    return out


# ---------------------------------------------------------------- 합치기
def load_previous() -> list[dict]:
    if not OUT.exists():
        return []
    try:
        return json.loads(OUT.read_text(encoding="utf-8")).get("events", [])
    except Exception:
        return []


def main() -> int:
    ap = argparse.ArgumentParser(description="Mr. Cards 발급 이벤트 수집")
    ap.add_argument("--only", default="", help="쉼표로 출처 고르기 (naver,kakaopay,ajd,ppomppu)")
    ap.add_argument("--limit", type=int, default=0, help="출처마다 최대 건수")
    ap.add_argument("--ppomppu-file", default="", help="브라우저로 저장한 뽐뿌 목록 JSON")
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    wanted = [s.strip() for s in args.only.split(",") if s.strip()] or list(SOURCES)
    limit = args.limit or None
    previous = load_previous()
    result, failed = [], []

    for src in wanted:
        try:
            if src == "naver":
                got = fetch_naver(limit)
            elif src == "kakaopay":
                got = fetch_kakaopay(limit)
            elif src == "ajd":
                got = fetch_ajd(limit)
            elif src == "ppomppu":
                got = fetch_ppomppu(limit, args.ppomppu_file)
            else:
                print(f"모르는 출처: {src}", file=sys.stderr)
                continue
        except Exception as exc:
            print(f"[{src}] 실패: {exc}", file=sys.stderr)
            failed.append(src)
            got = []
        if got:
            result.extend(got)
            print(f"[{src}] {len(got)}건")
        else:
            keep = [e for e in previous if e.get("sourceId") == src]
            if keep:
                print(f"[{src}] 실패·빈 응답 — 지난 {len(keep)}건 유지")
                result.extend(keep)

    # 지난 수집에서만 있던 출처(이번에 돌리지 않은 것)는 그대로 둔다
    done = {src for src in wanted} - set(failed)
    for e in previous:
        if e.get("sourceId") not in wanted and e.get("sourceId") not in done:
            result.append(e)

    # 오늘 끝난 이벤트는 뺀다 (기간을 아는 것만)
    keep = []
    for e in result:
        end = e.get("endsAt")
        if end and end < TODAY.isoformat():
            continue
        keep.append(e)
    keep.sort(key=lambda e: (e.get("sourceId", ""), -(e.get("benefitAmount") or 0)))

    counts: dict[str, int] = {}
    for e in keep:
        counts[e["source"]] = counts.get(e["source"], 0) + 1
    data = {
        "updatedAt": TODAY.isoformat(),
        "sources": [{"id": k, "name": v["name"], "url": v["url"]} for k, v in SOURCES.items()],
        "counts": counts,
        "events": keep,
    }
    print("출처별:", ", ".join(f"{k} {v}" for k, v in counts.items()))
    if visited_failed := failed:
        print("실패한 출처:", ", ".join(visited_failed), file=sys.stderr)
    if args.dry_run:
        print(json.dumps(data, ensure_ascii=False)[:1500])
        return 0
    Path(args.out).write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"저장: {args.out} ({len(keep)}건)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
