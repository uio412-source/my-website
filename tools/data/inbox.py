#!/usr/bin/env python3
"""수집 데이터 받은편지함(data/inbox) 검사·합치기.

외부 수집기(ChatGPT 예약 작업 등)는 큰 DB 파일을 직접 고치지 않고
data/inbox/<종류>/YYYY-MM-DD-<출처>.json 파일만 새로 추가합니다(표준 양식: docs/data-update.md).

  python tools/data/inbox.py validate   # PR 검사: 양식이 틀리면 실패(종료 코드 1)
  python tools/data/inbox.py merge      # 배포 때: 받은편지함을 화면용 DB에 덮어씀(커밋하지 않음)

합치는 규칙
- card-events    → paymorevent/data/events.json  (같은 id 또는 같은 카드사+제목이면 새 것으로 교체, 없으면 추가)
- hotel-events   → hotels/events.json            (같은 id면 교체)
- travel-events  → travel/vendor-events.json     (항공사·면세점·여행사 자체 이벤트, 여행준비 화면이 읽음)
- brand-services → paymorevent/data/brand-services.json (국제브랜드·카드사 선택 서비스 전체)
                   + hotel_valet 서비스는 hotels/valet.json 프로그램으로 (서울 호텔 이름을 id로 연결, 못 찾은 호텔은 보고)
- card-terms     → paymorevent/data/card-terms.json (상품설명서 표준 정리본, 검토 후 카드 DB에 반영)
- card-products  → 검토 대기열(신상품·단종 알림). 사이트에는 자동 반영하지 않음
- 파일 이름 순(= 날짜 순)으로 적용하므로 나중에 수집한 값이 이깁니다.
"""
from __future__ import annotations

import html
import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
INBOX = ROOT / "data" / "inbox"
EVENTS = ROOT / "paymorevent" / "data" / "events.json"
HOTEL_EVENTS = ROOT / "hotels" / "events.json"
VALET = ROOT / "hotels" / "valet.json"
VENDOR_EVENTS = ROOT / "travel" / "vendor-events.json"
BRAND_OUT = ROOT / "paymorevent" / "data" / "brand-services.json"
TERMS_OUT = ROOT / "paymorevent" / "data" / "card-terms.json"
CATALOG = ROOT / "paymorevent" / "data" / "catalog-snapshot.json"

# 카드사 이름 → id 앞부분
ISSUERS = {
    "신한카드": "shinhan", "KB국민카드": "kb", "삼성카드": "samsung", "현대카드": "hyundai", "우리카드": "woori",
    "하나카드": "hana", "롯데카드": "lotte", "NH농협카드": "nh", "BC카드": "bc", "BC 바로카드": "bc", "IBK기업은행": "ibk",
    # 은행·기타 발급사 (카드 DB의 issuer 표기 그대로)
    "SC제일은행": "sc", "iM뱅크": "im", "경남은행": "kn", "광주은행": "kj", "부산은행": "busan", "수협은행": "suhyup",
    "신협": "cu", "우체국예금": "post", "전북은행": "jb", "카카오뱅크": "kakaobank", "케이뱅크": "kbank", "토스뱅크": "tossbank",
}
# 출처로 인정하는 도메인 (카드사 공식 + 발급 이벤트를 여는 플랫폼)
CARD_DOMAINS = (
    "shinhancard.com", "kbcard.com", "samsungcard.com", "hyundaicard.com", "wooricard.com", "hanacard.co.kr",
    "lottecard.co.kr", "nonghyup.com", "bccard.com", "paybooc.co.kr", "ibk.co.kr",
    "pay.naver.com", "kakaopay.com", "card-gorilla.com", "toss.im", "tossbank.com", "banksalad.com",
    "standardchartered.co.kr", "imbank.co.kr", "knbank.co.kr", "kjbank.com", "busanbank.co.kr", "suhyup-bank.com", "cu.co.kr",
    "epostbank.go.kr", "jbbank.co.kr", "kakaobank.com", "kbanknow.com",
)
HOTEL_DOMAINS = (
    "marriott.com", "hilton.com", "ihg.com", "accor.com", "hyatt.com", "hotelux.com",
    "josunhotel.com", "shillahotels.com", "lottehotel.com", "parnas.co.kr", "ambatel.com",
)
# 상품설명서·브랜드 서비스 안내는 카드사(발급사) 공식 도메인만 (발급 이벤트 모음 사이트 제외)
AGGREGATORS = ("pay.naver.com", "kakaopay.com", "card-gorilla.com", "toss.im", "banksalad.com")
OFFICIAL_CARD = tuple(d for d in CARD_DOMAINS if d not in AGGREGATORS)
# 국제브랜드(Visa·Mastercard·AMEX·UnionPay·JCB) 공식 안내
BRAND_DOMAINS = ("mastercard.com", "mastercard.co.kr", "visa.co.kr", "visa.com", "americanexpress.com", "unionpayintl.com", "jcb.co.kr", "jcbcard.co.kr")
# 항공사·면세점·여행사·공항 공식
TRAVEL_DOMAINS = (
    "koreanair.com", "flyasiana.com", "jejuair.net", "jinair.com", "twayair.com", "airbusan.com", "flyairseoul.com", "airpremia.com",
    "eastarjet.com", "lottedfs.com", "shilladfs.com", "ssgdfs.com", "hddfs.com", "airport.kr", "airport.co.kr",
    "trip.com", "agoda.com", "hotels.com", "expedia.co.kr", "booking.com", "skyscanner.co.kr", "interpark.com", "hanatour.com", "modetour.com", "yanolja.com", "goodchoice.kr",
)
SERVICE_CATS = {
    "hotel_valet": "호텔 발레파킹", "airport_valet": "공항 발레파킹", "airport_lounge": "공항 라운지", "airport_coffee": "공항 커피",
    "airport_limousine": "공항 리무진·철도", "airport_fasttrack": "공항 패스트트랙·입국", "airport_parking": "공항·KTX 주차",
    "hotel_benefit": "호텔 객실·F&B 할인", "dining": "레스토랑", "golf": "골프", "concierge": "컨시어지", "insurance": "여행자 보험",
    "travel_booking": "항공·여행 예약", "other": "기타",
}
QUOTA_SCOPES = ("per_hotel", "hotel_shared", "hotel_airport", "per_service", "shared_group")
VALUE_TYPES = ("할인", "적립", "캐시백", "무료", "면제", "제공")
CATEGORIES = ("응모형", "해외/여행", "포인트/캐시백", "국세 / 지방세", "통신사 등 제휴", "기타")
HOTEL_PROGRAMS = ("marriott", "hilton", "ihg", "accor", "hotelux", "other")
HOTEL_KINDS = ("포인트", "할인", "서울 패키지", "무료 숙박", "기타")
DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HANGUL = re.compile(r"[가-힣]")


class Problems(list):
    def add(self, where: str, msg: str):
        self.append(f"{where}: {msg}")


def _day(v) -> bool:
    if not isinstance(v, str) or not DAY.match(v):
        return False
    try:
        date.fromisoformat(v)
        return True
    except ValueError:
        return False


def _url(v, domains) -> bool:
    if not isinstance(v, str):
        return False
    u = urlparse(v)
    host = (u.hostname or "").lower()
    return u.scheme == "https" and any(host == d or host.endswith("." + d) for d in domains)


def _text(v, lo: int, hi: int) -> bool:
    return isinstance(v, str) and lo <= len(v.strip()) <= hi and v == v.strip()


# 화면에 그대로 보이면 깨지는 HTML 엔티티(&lt;BR&gt;·&lsquo; 등)와 태그
ENTITY = re.compile(r"&(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#[xX][0-9a-fA-F]{1,6});")
TAG = re.compile(r"<\s*/?\s*(?:br|p|div|span|b|i|strong|em|u)\s*/?\s*>", re.I)


def clean_text(value):
    """문자열 필드의 HTML 엔티티를 풀고 <BR> 같은 태그는 공백으로 바꿈. 엔티티가 없으면 그대로."""
    if not isinstance(value, str) or not ENTITY.search(value):
        return value
    text = html.unescape(html.unescape(value))
    text = TAG.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_end(value, today=None):
    """오늘+2년을 넘는 가짜 종료일(9999-12-31 등)은 끝이 없는 상시(null)로 바꿈."""
    if not isinstance(value, str) or not DAY.match(value):
        return value
    try:
        end = date.fromisoformat(value)
    except ValueError:
        return value
    return None if end > (today or date.today()) + timedelta(days=730) else value


def _keys(p: Problems, where: str, obj: dict, required: set, optional: set):
    if not isinstance(obj, dict):
        p.add(where, "객체({})여야 합니다")
        return False
    for k in required - obj.keys():
        p.add(where, f"필수 항목 '{k}'이 없습니다")
    for k in obj.keys() - required - optional:
        p.add(where, f"모르는 항목 '{k}' (오타인지 확인, 양식: docs/data-update.md)")
    return True


# ---------------- 양식 검사 ----------------
def check_card_events(doc: dict, where: str, p: Problems):
    if not _keys(p, where, doc, {"type", "issuer", "collectedAt", "collector", "listUrls", "events"}, set()):
        return
    issuer = doc.get("issuer")
    if issuer not in ISSUERS:
        p.add(where, f"issuer는 {', '.join(ISSUERS)} 중 하나여야 합니다")
    got = doc.get("collectedAt")
    if not _day(got):
        p.add(where, "collectedAt은 YYYY-MM-DD")
    if not isinstance(doc.get("listUrls"), list) or not doc["listUrls"] or not all(_url(u, CARD_DOMAINS) for u in doc["listUrls"]):
        p.add(where, "listUrls는 실제로 확인한 공식 목록 주소(https) 배열")
    events = doc.get("events")
    if not isinstance(events, list):
        p.add(where, "events는 배열")
        return
    seen = set()
    prefix = ISSUERS.get(issuer, "")
    for i, e in enumerate(events):
        w = f"{where} events[{i}]"
        if not _keys(p, w, e, {"id", "kind", "title", "summary", "category", "startsAt", "endsAt", "entryRequired", "cards", "conditions", "url"},
                     {"cashbackAmount", "cashbackIsMaximum", "channel"}):
            continue
        eid = e.get("id")
        if not isinstance(eid, str) or not ID.match(eid) or len(eid) > 64 or (prefix and not eid.startswith(prefix + "-")):
            p.add(w, f"id는 '{prefix}-' 로 시작하는 영문 소문자·숫자·하이픈 64자 이내")
        elif eid in seen:
            p.add(w, f"id '{eid}'가 파일 안에서 겹칩니다")
        seen.add(eid)
        if e.get("kind") not in ("card", "cashback"):
            p.add(w, "kind는 card(카드사 이벤트) 또는 cashback(신규 발급 이벤트)")
        if not _text(e.get("title"), 2, 60) or not HANGUL.search(e.get("title") or ""):
            p.add(w, "title은 2~60자 한국어 제목")
        if not _text(e.get("summary"), 2, 60) or e.get("summary") == e.get("title"):
            p.add(w, "summary는 2~60자 혜택 한 줄(제목과 달라야 함). 예: '최대 15만원 캐시백'")
        if e.get("category") not in CATEGORIES:
            p.add(w, f"category는 {', '.join(CATEGORIES)} 중 하나")
        s, t = e.get("startsAt"), e.get("endsAt")
        if s is not None and not _day(s):
            p.add(w, "startsAt은 YYYY-MM-DD 또는 null")
        if not _day(t):
            p.add(w, "endsAt은 YYYY-MM-DD (상시 이벤트는 넣지 않음)")
        elif _day(got) and t < got:
            p.add(w, "이미 끝난 이벤트(endsAt < collectedAt)는 넣지 않습니다")
        if _day(s) and _day(t) and s > t:
            p.add(w, "startsAt이 endsAt보다 늦습니다")
        if not isinstance(e.get("entryRequired"), bool):
            p.add(w, "entryRequired는 true/false (응모·참여 신청이 필요하면 true)")
        if not isinstance(e.get("cards"), list) or not all(_text(c, 1, 60) for c in e.get("cards") or []):
            p.add(w, "cards는 대상 카드 이름 배열(카드사 전체 대상이면 [])")
        cond = e.get("conditions")
        if not isinstance(cond, list) or len(cond) > 6 or not all(_text(c, 2, 100) for c in cond or []):
            p.add(w, "conditions는 0~6개, 각 100자 이내 문장 배열")
        if not _url(e.get("url"), CARD_DOMAINS):
            p.add(w, "url은 이벤트 상세(또는 목록) 공식 주소 https")
        amt = e.get("cashbackAmount")
        if amt is not None and (not isinstance(amt, int) or isinstance(amt, bool) or amt < 0 or amt > 5_000_000):
            p.add(w, "cashbackAmount는 원 단위 정수 또는 null")
        if "cashbackIsMaximum" in e and not isinstance(e["cashbackIsMaximum"], bool):
            p.add(w, "cashbackIsMaximum은 true/false")
        if "channel" in e and not _text(e["channel"], 2, 20):
            p.add(w, "channel은 2~20자 (예: 카드사 공식, 네이버페이, 카카오페이, 페이북)")


def check_hotel_events(doc: dict, where: str, p: Problems):
    if not _keys(p, where, doc, {"type", "collectedAt", "collector", "events"}, set()):
        return
    got = doc.get("collectedAt")
    if not _day(got):
        p.add(where, "collectedAt은 YYYY-MM-DD")
    events = doc.get("events")
    if not isinstance(events, list):
        p.add(where, "events는 배열")
        return
    for i, e in enumerate(events):
        w = f"{where} events[{i}]"
        if not _keys(p, w, e, {"id", "program", "brand", "title", "benefit", "kind", "register", "stayFrom", "stayTo", "endsAt", "region", "points", "url"}, set()):
            continue
        if not isinstance(e.get("id"), str) or not ID.match(e["id"]) or len(e["id"]) > 64:
            p.add(w, "id는 영문 소문자·숫자·하이픈 64자 이내")
        if e.get("program") not in HOTEL_PROGRAMS:
            p.add(w, f"program은 {', '.join(HOTEL_PROGRAMS)} 중 하나 (하얏트·독립 호텔은 other)")
        if not _text(e.get("brand"), 2, 30):
            p.add(w, "brand는 2~30자 (예: Marriott Bonvoy)")
        if not _text(e.get("title"), 2, 40) or not HANGUL.search(e.get("title") or ""):
            p.add(w, "title은 2~40자 한국어")
        if not _text(e.get("benefit"), 2, 60):
            p.add(w, "benefit은 2~60자 혜택 한 줄")
        if e.get("kind") not in HOTEL_KINDS:
            p.add(w, f"kind는 {', '.join(HOTEL_KINDS)} 중 하나")
        if not isinstance(e.get("register"), bool):
            p.add(w, "register는 true/false (사전 등록 필요 여부)")
        for k in ("stayFrom", "stayTo"):
            if e.get(k) is not None and not _day(e.get(k)):
                p.add(w, f"{k}는 YYYY-MM-DD 또는 null")
        if not _day(e.get("endsAt")):
            p.add(w, "endsAt은 YYYY-MM-DD (마지막 투숙일 또는 예약 마감 중 늦은 날)")
        elif _day(got) and e["endsAt"] < got:
            p.add(w, "이미 끝난 프로모션은 넣지 않습니다")
        if not _text(e.get("region"), 2, 30):
            p.add(w, "region은 2~30자 (예: 전 세계, 아시아태평양, 서울)")
        pts = e.get("points")
        if not isinstance(pts, list) or not 1 <= len(pts) <= 5 or not all(_text(x, 2, 80) for x in pts):
            p.add(w, "points는 1~5개, 각 80자 이내")
        if not _url(e.get("url"), HOTEL_DOMAINS):
            p.add(w, "url은 호텔 체인 공식 프로모션 주소 https")


def check_card_products(doc: dict, where: str, p: Problems):
    if not _keys(p, where, doc, {"type", "issuer", "collectedAt", "collector", "changes"}, set()):
        return
    if doc.get("issuer") not in ISSUERS:
        p.add(where, f"issuer는 {', '.join(ISSUERS)} 중 하나")
    if not _day(doc.get("collectedAt")):
        p.add(where, "collectedAt은 YYYY-MM-DD")
    changes = doc.get("changes")
    if not isinstance(changes, list):
        p.add(where, "changes는 배열")
        return
    for i, c in enumerate(changes):
        w = f"{where} changes[{i}]"
        if not _keys(p, w, c, {"change", "name", "cardType", "url"}, {"cardId", "annualFee", "minimumSpend", "benefits", "note"}):
            continue
        if c.get("change") not in ("new", "changed", "discontinued"):
            p.add(w, "change는 new(신상품)·changed(혜택·연회비 변경)·discontinued(발급 중단)")
        if c.get("change") in ("changed", "discontinued") and not isinstance(c.get("cardId"), str):
            p.add(w, "changed·discontinued는 기존 cardId 필요 (paymorevent/data/catalog-snapshot.json의 id)")
        if not _text(c.get("name"), 2, 60):
            p.add(w, "name은 카드사 표기 그대로 2~60자")
        if c.get("cardType") not in ("credit", "debit"):
            p.add(w, "cardType은 credit 또는 debit")
        if not _url(c.get("url"), CARD_DOMAINS):
            p.add(w, "url은 카드사 공식 상품 페이지 https")
        if "minimumSpend" in c and c["minimumSpend"] is not None and (not isinstance(c["minimumSpend"], int) or c["minimumSpend"] < 0):
            p.add(w, "minimumSpend는 원 단위 정수 또는 null")
        for j, b in enumerate(c.get("benefits") or []):
            bw = f"{w} benefits[{j}]"
            if _keys(p, bw, b, {"title", "detail"}, {"rate", "cap", "minimumSpend"}):
                if not _text(b.get("title"), 2, 40) or not _text(b.get("detail"), 2, 200):
                    p.add(bw, "title 2~40자, detail 2~200자")


def _int_or_none(v, lo=0, hi=100_000_000):
    return v is None or (isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi)


def check_travel_events(doc: dict, where: str, p: Problems):
    if not _keys(p, where, doc, {"type", "vendorType", "vendor", "collectedAt", "collector", "listUrls", "events"}, set()):
        return
    if doc.get("vendorType") not in ("airline", "dutyfree", "ota", "airport"):
        p.add(where, "vendorType은 airline(항공사)·dutyfree(면세점)·ota(여행 예약 사이트)·airport(공항) 중 하나")
    if not _text(doc.get("vendor"), 2, 20):
        p.add(where, "vendor는 회사 이름 (예: 대한항공, 신라면세점)")
    got = doc.get("collectedAt")
    if not _day(got):
        p.add(where, "collectedAt은 YYYY-MM-DD")
    if not isinstance(doc.get("listUrls"), list) or not doc["listUrls"] or not all(_url(u, TRAVEL_DOMAINS) for u in doc["listUrls"]):
        p.add(where, "listUrls는 실제로 확인한 공식 이벤트 목록 주소(https) 배열")
    events = doc.get("events")
    if not isinstance(events, list):
        p.add(where, "events는 배열")
        return
    seen = set()
    for i, e in enumerate(events):
        w = f"{where} events[{i}]"
        if not _keys(p, w, e, {"id", "title", "summary", "startsAt", "endsAt", "conditions", "url"}, {"cardIssuers", "promoCode"}):
            continue
        if not isinstance(e.get("id"), str) or not ID.match(e["id"]) or len(e["id"]) > 64 or e["id"] in seen:
            p.add(w, "id는 영문 소문자·숫자·하이픈 64자 이내, 파일 안에서 겹치면 안 됨")
        seen.add(e.get("id"))
        if not _text(e.get("title"), 2, 60):
            p.add(w, "title은 2~60자")
        if not _text(e.get("summary"), 2, 60) or e.get("summary") == e.get("title"):
            p.add(w, "summary는 2~60자 혜택 한 줄(제목과 달라야 함)")
        if e.get("startsAt") is not None and not _day(e.get("startsAt")):
            p.add(w, "startsAt은 YYYY-MM-DD 또는 null")
        if not _day(e.get("endsAt")):
            p.add(w, "endsAt은 YYYY-MM-DD (상시는 넣지 않음)")
        elif _day(got) and e["endsAt"] < got:
            p.add(w, "이미 끝난 이벤트는 넣지 않습니다")
        cond = e.get("conditions")
        if not isinstance(cond, list) or len(cond) > 6 or not all(_text(c, 2, 100) for c in cond or []):
            p.add(w, "conditions는 0~6개, 각 100자 이내")
        if not _url(e.get("url"), TRAVEL_DOMAINS + CARD_DOMAINS):
            p.add(w, "url은 공식 주소 https")
        if "cardIssuers" in e and (not isinstance(e["cardIssuers"], list) or any(x not in ISSUERS for x in e["cardIssuers"])):
            p.add(w, f"cardIssuers는 카드사 제휴일 때만: {', '.join(ISSUERS)}")
        if "promoCode" in e and not _text(e["promoCode"], 2, 30):
            p.add(w, "promoCode는 2~30자")


def check_service(s: dict, w: str, p: Problems):
    if not _keys(p, w, s, {"category", "title"}, {"minimumSpend", "grace", "dailyLimit", "monthlyLimit", "annualLimit", "quotaScope", "sharedWith",
                                                  "guestCount", "holderOnly", "freeHours", "coverage", "hotels", "hotelRules", "conditions", "useRequired"}):
        return
    cat = s.get("category")
    if cat not in SERVICE_CATS:
        p.add(w, "category는 " + ", ".join(SERVICE_CATS) + " 중 하나")
    if not _text(s.get("title"), 2, 40):
        p.add(w, "title은 2~40자 (안내문 표기 그대로)")
    for k in ("minimumSpend",):
        if not _int_or_none(s.get(k)):
            p.add(w, f"{k}는 원 단위 정수 또는 null (실적 무관이면 0)")
    for k in ("dailyLimit", "monthlyLimit", "annualLimit", "guestCount"):
        if not _int_or_none(s.get(k), 0, 999):
            p.add(w, f"{k}는 정수 또는 null (제한 없음은 null, 안내에 '제한 없이'면 conditions에 적기)")
    if "freeHours" in s and not (s["freeHours"] is None or isinstance(s["freeHours"], (int, float))):
        p.add(w, "freeHours는 무료 주차 시간(숫자) 또는 null")
    if "quotaScope" in s and s["quotaScope"] not in QUOTA_SCOPES:
        p.add(w, "quotaScope는 " + ", ".join(QUOTA_SCOPES) + " 중 하나")
    for k in ("grace", "sharedWith", "coverage"):
        if k in s and s[k] is not None and not _text(s[k], 2, 80):
            p.add(w, f"{k}는 2~80자 문장 또는 null")
    if "holderOnly" in s and not isinstance(s["holderOnly"], bool):
        p.add(w, "holderOnly는 true(본인만)/false")
    if "useRequired" in s and not isinstance(s["useRequired"], bool):
        p.add(w, "useRequired는 true(당일 투숙·식음료 이용해야 무료)/false(안내문에 호텔 이용 없이 무료라고 적힌 경우만)")
    hotels = s.get("hotels")
    if cat == "hotel_valet":
        if not isinstance(hotels, list) or not hotels:
            p.add(w, "hotel_valet은 hotels(대상 호텔 전체 목록)가 필수")
    if hotels is not None:
        if not isinstance(hotels, list) or not all(isinstance(h, dict) and _text(h.get("name"), 2, 60) and _text(h.get("city"), 2, 10) and set(h) <= {"name", "city"} for h in hotels):
            p.add(w, "hotels는 [{name: 안내문 표기 그대로, city: '서울'·'부산'…}] 배열")
    rules = s.get("hotelRules")
    if rules is not None and (not isinstance(rules, list) or not all(isinstance(r, dict) and _text(r.get("name"), 2, 60) and set(r) <= {"name", "receiptMin", "monthlyLimit", "note"}
                                                                       and _int_or_none(r.get("receiptMin")) and _int_or_none(r.get("monthlyLimit"), 0, 99) for r in rules)):
        p.add(w, "hotelRules는 [{name, receiptMin(원), monthlyLimit, note}] 배열 (호텔별 예외만)")
    cond = s.get("conditions")
    if cond is not None and (not isinstance(cond, list) or len(cond) > 8 or not all(_text(c, 2, 100) for c in cond)):
        p.add(w, "conditions는 0~8개, 각 100자 이내")


def check_brand_services(doc: dict, where: str, p: Problems):
    if not _keys(p, where, doc, {"type", "issuer", "collectedAt", "collector", "programs"}, set()):
        return
    issuer = doc.get("issuer")
    if issuer not in ISSUERS:
        p.add(where, f"issuer는 {', '.join(ISSUERS)} 중 하나")
    if not _day(doc.get("collectedAt")):
        p.add(where, "collectedAt은 YYYY-MM-DD")
    progs = doc.get("programs")
    if not isinstance(progs, list) or not progs:
        p.add(where, "programs는 1개 이상 배열")
        return
    prefix = ISSUERS.get(issuer, "")
    seen = set()
    for i, g in enumerate(progs):
        w = f"{where} programs[{i}]"
        if not _keys(p, w, g, {"id", "brand", "tier", "provider", "docTitle", "url", "docDate", "cards", "services"}, {"queueKey", "validThrough"}):
            continue
        if not isinstance(g.get("id"), str) or not ID.match(g["id"]) or not g["id"].startswith(prefix + "-") or g["id"] in seen:
            p.add(w, f"id는 '{prefix}-<브랜드>-<등급>[-구분]' 소문자·하이픈, 파일 안에서 고유 (예: {prefix}-mastercard-world)")
        seen.add(g.get("id"))
        if g.get("brand") not in ("Visa", "Mastercard", "American Express", "UnionPay", "JCB", "국내전용"):
            p.add(w, "brand는 Visa·Mastercard·American Express·UnionPay·JCB·국내전용 중 하나")
        if not _text(g.get("tier"), 2, 30):
            p.add(w, "tier는 등급 표기 (예: Platinum, Signature, Infinite, Titanium, World, World Elite, PLATINUM ELITE)")
        if g.get("provider") not in ("issuer_selection", "international_network"):
            p.add(w, "provider는 issuer_selection(카드사 선택 서비스)·international_network(브랜드 기본 서비스)")
        if not _text(g.get("docTitle"), 2, 80):
            p.add(w, "docTitle은 안내문 제목")
        if not _url(g.get("url"), OFFICIAL_CARD + BRAND_DOMAINS):
            p.add(w, "url은 카드사·국제브랜드 공식 안내(PDF 포함) https")
        if not _day(g.get("docDate")):
            p.add(w, "docDate는 안내문 기준일(심의필 날짜 등) YYYY-MM-DD")
        if "validThrough" in g and not _day(g["validThrough"]):
            p.add(w, "validThrough는 YYYY-MM-DD (보통 그해 12-31)")
        if not isinstance(g.get("cards"), list) or not g["cards"] or not all(_text(c, 2, 60) for c in g["cards"]):
            p.add(w, "cards는 안내문에 적힌 대상 카드 이름 배열(1개 이상)")
        svc = g.get("services")
        if not isinstance(svc, list) or not svc:
            p.add(w, "services는 1개 이상 배열")
            continue
        for j, s in enumerate(svc):
            check_service(s, f"{w} services[{j}]", p)


def check_card_terms(doc: dict, where: str, p: Problems):
    if not _keys(p, where, doc, {"type", "issuer", "collectedAt", "collector", "cards"}, set()):
        return
    if doc.get("issuer") not in ISSUERS:
        p.add(where, f"issuer는 {', '.join(ISSUERS)} 중 하나")
    if not _day(doc.get("collectedAt")):
        p.add(where, "collectedAt은 YYYY-MM-DD")
    cards = doc.get("cards")
    if not isinstance(cards, list) or not cards:
        p.add(where, "cards는 1개 이상 배열")
        return
    for i, c in enumerate(cards):
        w = f"{where} cards[{i}]"
        if not _keys(p, w, c, {"name", "cardType", "url", "termsUrl", "docDate", "annualFee", "brands", "minimumSpend", "spendExclusions", "benefitExclusions", "benefits"},
                     {"cardId", "queueKey", "spendBasis", "grace", "brandPrograms", "status"}):
            continue
        if "cardId" in c and c["cardId"] is not None and not (isinstance(c["cardId"], str) and ID.match(c["cardId"])):
            p.add(w, "cardId는 catalog-snapshot의 id 또는 null")
        if not _text(c.get("name"), 2, 60):
            p.add(w, "name은 카드사 표기 그대로")
        if c.get("cardType") not in ("credit", "debit"):
            p.add(w, "cardType은 credit 또는 debit")
        if not _url(c.get("url"), OFFICIAL_CARD):
            p.add(w, "url은 카드사 상품 페이지 https")
        if c.get("termsUrl") is not None and not _url(c.get("termsUrl"), OFFICIAL_CARD):
            p.add(w, "termsUrl은 상품설명서 PDF https 또는 null")
        if not _day(c.get("docDate")):
            p.add(w, "docDate는 상품설명서 기준일(심의필 날짜) YYYY-MM-DD")
        if "status" in c and c["status"] not in ("active", "discontinued"):
            p.add(w, "status는 active 또는 discontinued")
        fee = c.get("annualFee")
        if not isinstance(fee, list) or not fee or not all(isinstance(f, dict) and set(f) == {"brand", "amount"} and _text(f["brand"], 2, 20) and _int_or_none(f["amount"]) for f in fee):
            p.add(w, "annualFee는 [{brand: 'Visa'·'국내전용'…, amount: 원 단위 정수}] 배열")
        if not isinstance(c.get("brands"), list) or not all(_text(b, 2, 20) for b in c.get("brands") or []):
            p.add(w, "brands는 발급 브랜드 배열")
        if not _int_or_none(c.get("minimumSpend")):
            p.add(w, "minimumSpend는 기본 전월실적(원) 또는 null, 실적 무관이면 0")
        for k in ("spendExclusions", "benefitExclusions"):
            v = c.get(k)
            if not isinstance(v, list) or len(v) > 40 or not all(_text(x, 2, 60) for x in v):
                p.add(w, f"{k}는 항목 단위로 나눈 배열(각 60자 이내, 최대 40개). 예: '아파트 관리비', '상품권 구매'")
        for k in ("spendBasis", "grace"):
            if k in c and c[k] is not None and not _text(c[k], 2, 100):
                p.add(w, f"{k}는 100자 이내 문장 또는 null")
        if "brandPrograms" in c and (not isinstance(c["brandPrograms"], list) or not all(isinstance(x, str) and ID.match(x) for x in c["brandPrograms"])):
            p.add(w, "brandPrograms는 brand-services 프로그램 id 배열")
        bens = c.get("benefits")
        if not isinstance(bens, list) or not bens:
            p.add(w, "benefits는 1개 이상 배열")
            continue
        for j, b in enumerate(bens):
            bw = f"{w} benefits[{j}]"
            if not _keys(p, bw, b, {"label", "place", "value", "valueType"}, {"group", "minimumSpend", "tiers", "cap", "capScope", "shared", "limits", "conditions"}):
                continue
            if not _text(b.get("label"), 1, 20):
                p.add(bw, "label은 구분 칸(20자 이내, 예: 커피·대중교통·해외)")
            if not _text(b.get("place"), 1, 120):
                p.add(bw, "place는 적용처(가맹점·업종) 120자 이내")
            if not _text(b.get("value"), 1, 20):
                p.add(bw, "value는 혜택 크기 (예: 10%, 1,000원, 리터당 60원, 1.5마일)")
            if b.get("valueType") not in VALUE_TYPES:
                p.add(bw, "valueType은 " + "·".join(VALUE_TYPES) + " 중 하나")
            if "group" in b and b["group"] is not None and not _text(b["group"], 1, 20):
                p.add(bw, "group은 묶음 이름(예: 일상, Global) 또는 null")
            if not _int_or_none(b.get("minimumSpend")):
                p.add(bw, "minimumSpend는 이 혜택의 전월실적(원) 또는 null")
            tiers = b.get("tiers")
            if tiers is not None and (not isinstance(tiers, list) or not all(isinstance(t, dict) and set(t) <= {"spend", "cap"} and _int_or_none(t.get("spend")) and _int_or_none(t.get("cap")) for t in tiers)):
                p.add(bw, "tiers는 실적 구간별 한도 [{spend: 30만원 이상이면 300000, cap: 원}] 배열")
            if not _int_or_none(b.get("cap")):
                p.add(bw, "cap은 한도 금액(원) 또는 null")
            if "capScope" in b and b["capScope"] not in ("일", "월", "연", "건", None):
                p.add(bw, "capScope는 일·월·연·건 또는 null")
            for k in ("shared", "limits"):
                if k in b and b[k] is not None and not _text(b[k], 1, 40):
                    p.add(bw, f"{k}는 40자 이내 (shared: 통합 한도 묶음 이름, limits: '월 1회' 등)")
            cond = b.get("conditions")
            if cond is not None and (not isinstance(cond, list) or len(cond) > 6 or not all(_text(x, 2, 100) for x in cond)):
                p.add(bw, "conditions는 0~6개, 각 100자 이내")


CHECKS = {"card-events": check_card_events, "hotel-events": check_hotel_events, "card-products": check_card_products,
          "travel-events": check_travel_events, "brand-services": check_brand_services, "card-terms": check_card_terms}


def load_inbox(p: Problems):
    docs = []
    for path in sorted(INBOX.glob("*/*.json")):
        rel = path.relative_to(ROOT).as_posix()
        folder = path.parent.name
        if folder not in CHECKS:
            p.add(rel, f"폴더는 {', '.join(CHECKS)} 중 하나여야 합니다")
            continue
        if not re.match(r"^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.json$", path.name):
            p.add(rel, "파일 이름은 YYYY-MM-DD-<영문 출처>.json (예: 2026-11-21-hana.json)")
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as err:
            p.add(rel, f"JSON 문법 오류: {err}")
            continue
        if not isinstance(doc, dict) or doc.get("type") != folder:
            p.add(rel, f"type은 폴더 이름과 같은 '{folder}'여야 합니다")
            continue
        CHECKS[folder](doc, rel, p)
        docs.append((folder, path, doc))
    return docs


# ---------------- 합치기 ----------------
norm = lambda s: re.sub(r"[\s·,()\[\]【】<>「」'\"!~-]", "", s or "").lower()


def to_offer(e: dict, doc: dict, card_ids: dict) -> dict:
    today = date.today().isoformat()
    starts = e.get("startsAt")
    ids = sorted({i for n in e["cards"] for i in card_ids.get((doc["issuer"], norm(n)), [])})
    detail = e["url"] not in doc["listUrls"]
    tags = [e["category"]] + (["발급 캐시백"] if e["kind"] == "cashback" else [])
    offer = {
        "id": e["id"], "kind": e["kind"], "category": e["category"], "issuer": doc["issuer"], "chain": None,
        "title": clean_text(e["title"]), "description": clean_text(e["summary"]), "benefitText": clean_text(e["summary"]), "tags": tags,
        "channel": clean_text(e.get("channel") or "카드사 공식"),
        "startsAt": starts, "endsAt": normalize_end(e["endsAt"]), "bookingEndsAt": None, "stayEndsAt": None,
        "requirements": [clean_text(c) for c in e["conditions"]], "participation": [clean_text(c) for c in e["conditions"]],
        "sourceUrl": e["url"], "sourceDetailUrl": e["url"] if detail else None, "imageUrl": None,
        "status": "upcoming" if starts and starts > today else "active",
        "verificationLevel": "official_detail" if detail else "official_list",
        "verifiedAt": doc["collectedAt"],
        "verificationNote": f"{doc['collector']} 수집 · 공식 {'상세' if detail else '목록'} 페이지 기준",
        "cardIds": ids, "cardNames": [clean_text(n) for n in e["cards"]],
        "cashbackAmount": e.get("cashbackAmount"), "cashbackIsMaximum": bool(e.get("cashbackIsMaximum", False)),
        "annualFeeOnly": False, "entryRequired": e["entryRequired"],
    }
    if not detail:
        del offer["sourceDetailUrl"]
    return offer


def merge(docs) -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))["cards"]
    card_ids: dict = {}
    for c in catalog:
        for n in {c["name"], c.get("familyName") or c["name"]}:
            card_ids.setdefault((c["issuer"], norm(n)), []).append(c["id"])

    events = json.loads(EVENTS.read_text(encoding="utf-8"))
    # 이미 저장된 이벤트도 배포 때 한 번 정리: 엔티티를 풀고, 오늘+2년을 넘는 가짜 종료일은 상시(null)로
    today_date = date.today()
    for o in events:
        o["endsAt"] = normalize_end(o.get("endsAt"), today_date)
        for key in ("title", "description", "benefitText", "channel"):
            if isinstance(o.get(key), str):
                o[key] = clean_text(o[key])
        for key in ("requirements", "participation", "cardNames"):
            if isinstance(o.get(key), list):
                o[key] = [clean_text(v) for v in o[key]]
    by_id = {o["id"]: i for i, o in enumerate(events)}
    by_title = {(o["issuer"], norm(o["title"])): i for i, o in enumerate(events)}
    by_url = {o["sourceDetailUrl"]: i for i, o in enumerate(events) if o.get("sourceDetailUrl")}
    hotel = json.loads(HOTEL_EVENTS.read_text(encoding="utf-8"))
    h_by_id = {o["id"]: i for i, o in enumerate(hotel["events"])}
    added = replaced = h_added = h_replaced = queued = 0
    vendor, brand, terms = {}, {}, {}
    if VENDOR_EVENTS.exists():
        vendor = {e["id"]: e for e in json.loads(VENDOR_EVENTS.read_text(encoding="utf-8")).get("events", [])}

    for folder, path, doc in docs:
        if folder == "card-events":
            for e in doc["events"]:
                offer = to_offer(e, doc, card_ids)
                key = (doc["issuer"], norm(e["title"]))
                i = by_id.get(e["id"])
                if i is None:
                    i = by_title.get(key)
                if i is None and offer.get("sourceDetailUrl"):
                    i = by_url.get(offer["sourceDetailUrl"])
                if i is None:
                    i = len(events)
                    events.append(offer)
                    added += 1
                else:
                    events[i] = offer
                    replaced += 1
                by_id[e["id"]] = by_title[key] = i
                if offer.get("sourceDetailUrl"):
                    by_url[offer["sourceDetailUrl"]] = i
        elif folder == "hotel-events":
            for e in doc["events"]:
                if e["id"] in h_by_id:
                    hotel["events"][h_by_id[e["id"]]] = e
                    h_replaced += 1
                else:
                    h_by_id[e["id"]] = len(hotel["events"])
                    hotel["events"].append(e)
                    h_added += 1
            hotel["updated"] = max(hotel.get("updated") or "", doc["collectedAt"])
        elif folder == "travel-events":
            for e in doc["events"]:
                vendor[e["id"]] = {"id": e["id"], "vendorType": doc["vendorType"], "vendor": doc["vendor"], "title": e["title"], "text": e["summary"],
                                   "start": e.get("startsAt"), "end": e["endsAt"], "url": e["url"], "conditions": e["conditions"],
                                   "cardIssuers": e.get("cardIssuers") or [], "promoCode": e.get("promoCode"), "checkedAt": doc["collectedAt"]}
        elif folder == "brand-services":
            for g in doc["programs"]:
                ids = sorted({i for n in g["cards"] for i in card_ids.get((doc["issuer"], norm(n)), [])})
                brand[g["id"]] = {**g, "issuer": doc["issuer"], "collectedAt": doc["collectedAt"], "collector": doc["collector"], "catalogIds": ids}
        elif folder == "card-terms":
            for c in doc["cards"]:
                cid = c.get("cardId") or next(iter(card_ids.get((doc["issuer"], norm(c["name"])), [])), None)
                terms[(doc["issuer"], norm(c["name"]))] = {**c, "cardId": cid, "issuer": doc["issuer"], "collectedAt": doc["collectedAt"], "collector": doc["collector"]}
        else:
            queued += len(doc["changes"])

    today = date.today().isoformat()
    vend = sorted((v for v in vendor.values() if v["end"] >= today), key=lambda v: (v["end"], v["vendor"]))
    VENDOR_EVENTS.write_text(json.dumps({"built": today, "events": vend}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    BRAND_OUT.write_text(json.dumps({"built": today, "programs": list(brand.values())}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    TERMS_OUT.write_text(json.dumps({"built": today, "cards": list(terms.values())}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    valet_added, valet_replaced, unmapped, lost = merge_valet(brand.values(), card_ids)

    EVENTS.write_text(json.dumps(events, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    HOTEL_EVENTS.write_text(json.dumps(hotel, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"카드 이벤트: 추가 {added} · 교체 {replaced} / 호텔 이벤트: 추가 {h_added} · 교체 {h_replaced} / 여행 이벤트 {len(vend)}")
    print(f"브랜드·선택 서비스 프로그램 {len(brand)} (발레파킹 추가 {valet_added} · 교체 {valet_replaced}) / 상품설명서 정리 {len(terms)}종 / 카드 상품 알림 {queued}")
    if unmapped:
        print("발레파킹: 서울 호텔 이름을 hotels/valet.json에서 못 찾음 (hotels에 추가하거나 aliases에 넣어 주세요):")
        for name in sorted(unmapped):
            print("  -", name)
    if lost:
        print("발레파킹: 안내문 카드 이름이 valet.json 프로그램에서 빠짐 (확인해 주세요):")
        for name in lost:
            print("  -", name)


def valet_slot(p: dict) -> tuple:
    """같은 프로그램으로 볼 카드사·브랜드·등급. 등급 끝의 안내문 번호('Mastercard World 02')는 같은 등급으로 봅니다."""
    tier = re.sub(r"\s*\d+$", "", str(p.get("tier") or "").strip().lower())
    return (p.get("issuer"), str(p.get("brand") or "").strip().lower(), tier)


def valet_offer(p: dict) -> tuple:
    """대상 호텔과 이용 조건(실적·횟수·이용 방식)이 모두 같은지 비교하는 값.

    카드사·브랜드·등급이 같아도 카드 묶음마다 안내문이 달라 대상 호텔이 다를 수 있습니다(예: KB Mastercard World의
    BeV III 39곳·HERITAGE Classic 13곳). 호텔·조건이 똑같을 때만 같은 안내문(같은 자리)으로 보고 한 프로그램으로 합칩니다.
    """
    overrides = tuple(sorted((k, v.get("monthlyLimit"), v.get("minReceipt")) for k, v in (p.get("hotelOverrides") or {}).items()))
    return (tuple(sorted(p.get("hotelIds") or [])), p.get("minimumSpend"), p.get("monthlyLimit"), p.get("quotaScope"),
            p.get("useRequired"), p.get("freeHours"), p.get("validThrough"), overrides)


def valet_cards(*groups) -> list:
    """프로그램을 합칠 때 카드 목록을 이름 기준으로 합치고 key(c0·c1…)를 다시 매깁니다(화면 카드 참조가 겹치지 않게)."""
    out, seen = [], set()
    for cards in groups:
        for c in cards or []:
            name = (c or {}).get("name")
            if not name or name in seen:
                continue
            seen.add(name)
            out.append({"key": f"c{len(out)}", "name": name, "catalogId": c.get("catalogId")})
    return out


def merge_valet(programs, card_ids):
    """brand-services의 hotel_valet(서울 호텔)을 발레파킹 화면 프로그램으로 바꿔 hotels/valet.json에 넣음(배포본만)."""
    data = json.loads(VALET.read_text(encoding="utf-8"))
    index = {}
    for h in data["hotels"]:
        for n in [h["name"], *(h.get("aliases") or [])]:
            index[norm(n)] = h["id"]

    def find(name):
        k = norm(name)
        if k in index:
            return index[k]
        hits = {v for n, v in index.items() if len(n) >= 4 and (n in k or k in n)}
        return hits.pop() if len(hits) == 1 else None

    added = replaced = 0
    unmapped, collected = set(), set()
    for g in programs:
        for svc in g["services"]:
            if svc["category"] != "hotel_valet":
                continue
            seoul = [h["name"] for h in svc.get("hotels") or [] if h["city"] == "서울"]
            ids = []
            for n in seoul:
                hid = find(n)
                (ids.append(hid) if hid else unmapped.add(n))
            ids = list(dict.fromkeys(ids))  # 별칭이 겹쳐 같은 호텔이 두 번 들어가지 않게
            if not ids:
                continue
            overrides = {}
            for r in svc.get("hotelRules") or []:
                hid = find(r["name"])
                if not hid:
                    continue
                note = " ".join(x for x in [f"당일 호텔 영업장 {r['receiptMin']:,}원 이상 영수증이 있어야 무료예요." if r.get("receiptMin") else "", r.get("note") or ""] if x)
                overrides[hid] = {"monthlyLimit": r.get("monthlyLimit") or svc.get("monthlyLimit"), "note": note or "호텔별 조건이 있어요."}
                if r.get("receiptMin"):
                    overrides[hid]["minReceipt"] = r["receiptMin"]  # 화면의 '조건 없이 무료' 판정(valet-rules.js valetExtra)
            hours = svc.get("freeHours")
            prog = {
                "id": g["id"], "issuer": g["issuer"], "provider": g["provider"], "brand": g["brand"], "tier": g["tier"],
                "minimumSpend": svc.get("minimumSpend") or 0, "spendScope": "전월 이용실적", "spendExclusions": "",
                "monthlyLimit": svc.get("monthlyLimit"), "quotaScope": svc.get("quotaScope") or "hotel_shared", "familyQuota": False,
                "grace": svc.get("grace") or "", "parking": f"일 {hours:g}시간 무료 · 초과 유료" if hours else "무료 주차 시간은 호텔별",
                # 안내문에 '호텔 이용과 관계없이' 등으로 적힌 경우(useRequired false)만 조건 없이 무료로 봄. 모르면 이용 필요
                "visit": "호텔 이용 없이 무료(안내문 기준)" if svc.get("useRequired") is False else
                         next((c for c in svc.get("conditions") or [] if re.search("객실|투숙|식음|업장|레스토랑", c)), "객실·식음료 매장 이용(연회장 제외)"),
                "useRequired": svc.get("useRequired") is not False,
                "proof": "대상 카드·주차권 제시" if svc.get("useRequired") is False else "대상 카드·주차권·당일 호텔 이용 영수증 제시",
                "notes": ([svc["sharedWith"]] if svc.get("sharedWith") else []) + (svc.get("conditions") or [])[:3],
                "source": g["url"], "checkedAt": g["docDate"], "hotelIds": ids, "hotelOverrides": overrides,
                "cards": [{"key": f"c{i}", "name": n, "catalogId": next(iter(card_ids.get((g["issuer"], norm(n)), [])), None)} for i, n in enumerate(g["cards"])],
            }
            if g.get("validThrough"):
                prog["validThrough"] = g["validThrough"]
            collected.update(c["name"] for c in prog["cards"])
            # 같은 자리(같은 id, 또는 카드사·브랜드·등급과 대상 호텔·조건이 모두 같은 안내문)만 하나로 합칩니다.
            # 같은 등급이라도 대상 호텔이 다른 카드 묶음은 각각 남겨 카드마다 맞는 호텔 수를 보여 줍니다.
            slot, offer = valet_slot(prog), valet_offer(prog)
            same = [i for i, x in enumerate(data["programs"])
                    if x.get("id") == prog["id"] or (valet_slot(x) == slot and valet_offer(x) == offer)]
            if same:
                i, old = same[0], data["programs"][same[0]]
                # 대상 호텔이 더 많은(더 포괄적인) 안내가 남습니다. 같으면 카드가 더 많은 안내. 예전에는 파일 순서상 나중에 온 좁은 안내가 넓은 안내를 덮었습니다.
                keep_new = (len(prog["hotelIds"]), len(prog["cards"])) > (len(old["hotelIds"]), len(old["cards"]))
                base = prog if keep_new else old
                base["cards"] = valet_cards(base.get("cards"), *[data["programs"][j].get("cards") for j in same[1:]],
                                            (old if keep_new else prog).get("cards"))
                data["programs"][i] = base
                for j in sorted(same[1:], reverse=True):
                    data["programs"].pop(j)
                replaced += 1
            else:
                data["programs"].append(prog)
                added += 1
            data["updatedAt"] = max(data.get("updatedAt") or "", g["collectedAt"])
    VALET.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    lost = sorted(collected - {c["name"] for p in data["programs"] for c in p.get("cards") or []})
    return added, replaced, unmapped, lost


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "validate"
    p = Problems()
    docs = load_inbox(p)
    if p:
        print(f"받은편지함 양식 오류 {len(p)}건 (양식: docs/data-update.md)")
        for line in p:
            print(" -", line)
        if cmd == "validate":
            return 1
        # 배포 때는 틀린 파일만 빼고 계속
        bad = {line.split(":")[0].split(" ")[0] for line in p}
        docs = [d for d in docs if d[1].relative_to(ROOT).as_posix() not in bad]
    if cmd == "merge":
        merge(docs)
    else:
        print(f"받은편지함 {len(docs)}개 파일 양식 통과")
    return 0


if __name__ == "__main__":
    sys.exit(main())
