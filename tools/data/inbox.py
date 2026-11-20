#!/usr/bin/env python3
"""수집 데이터 받은편지함(data/inbox) 검사·합치기.

외부 수집기(ChatGPT 예약 작업 등)는 큰 DB 파일을 직접 고치지 않고
data/inbox/<종류>/YYYY-MM-DD-<출처>.json 파일만 새로 추가합니다(표준 양식: docs/data-update.md).

  python tools/data/inbox.py validate   # PR 검사: 양식이 틀리면 실패(종료 코드 1)
  python tools/data/inbox.py merge      # 배포 때: 받은편지함을 화면용 DB에 덮어씀(커밋하지 않음)

합치는 규칙
- card-events → paymorevent/data/events.json  (같은 id 또는 같은 카드사+제목이면 새 것으로 교체, 없으면 추가)
- hotel-events → hotels/events.json            (같은 id면 교체)
- card-products → 검토 대기열. 사이트에는 자동 반영하지 않음(카드 DB는 계산 필드가 많아 사람이/AI가 검토 후 반영)
- 파일 이름 순(= 날짜 순)으로 적용하므로 나중에 수집한 값이 이깁니다.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
INBOX = ROOT / "data" / "inbox"
EVENTS = ROOT / "paymorevent" / "data" / "events.json"
HOTEL_EVENTS = ROOT / "hotels" / "events.json"
CATALOG = ROOT / "paymorevent" / "public" / "catalog-snapshot.json"

# 카드사 이름 → id 앞부분
ISSUERS = {
    "신한카드": "shinhan", "KB국민카드": "kb", "삼성카드": "samsung", "현대카드": "hyundai", "우리카드": "woori",
    "하나카드": "hana", "롯데카드": "lotte", "NH농협카드": "nh", "BC카드": "bc", "IBK기업은행": "ibk",
}
# 출처로 인정하는 도메인 (카드사 공식 + 발급 이벤트를 여는 플랫폼)
CARD_DOMAINS = (
    "shinhancard.com", "kbcard.com", "samsungcard.com", "hyundaicard.com", "wooricard.com", "hanacard.co.kr",
    "lottecard.co.kr", "nonghyup.com", "bccard.com", "paybooc.co.kr", "ibk.co.kr",
    "pay.naver.com", "kakaopay.com", "card-gorilla.com", "toss.im", "tossbank.com", "banksalad.com",
)
HOTEL_DOMAINS = (
    "marriott.com", "hilton.com", "ihg.com", "accor.com", "hyatt.com", "hotelux.com",
    "josunhotel.com", "shillahotels.com", "lottehotel.com", "parnas.co.kr", "ambatel.com",
)
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
            p.add(w, "changed·discontinued는 기존 cardId 필요 (paymorevent/public/catalog-snapshot.json의 id)")
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


CHECKS = {"card-events": check_card_events, "hotel-events": check_hotel_events, "card-products": check_card_products}


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
        "title": e["title"], "description": e["summary"], "benefitText": e["summary"], "tags": tags,
        "channel": e.get("channel") or "카드사 공식",
        "startsAt": starts, "endsAt": e["endsAt"], "bookingEndsAt": None, "stayEndsAt": None,
        "requirements": e["conditions"], "participation": e["conditions"],
        "sourceUrl": e["url"], "sourceDetailUrl": e["url"] if detail else None, "imageUrl": None,
        "status": "upcoming" if starts and starts > today else "active",
        "verificationLevel": "official_detail" if detail else "official_list",
        "verifiedAt": doc["collectedAt"],
        "verificationNote": f"{doc['collector']} 수집 · 공식 {'상세' if detail else '목록'} 페이지 기준",
        "cardIds": ids, "cardNames": e["cards"],
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
    by_id = {o["id"]: i for i, o in enumerate(events)}
    by_title = {(o["issuer"], norm(o["title"])): i for i, o in enumerate(events)}
    by_url = {o["sourceDetailUrl"]: i for i, o in enumerate(events) if o.get("sourceDetailUrl")}
    hotel = json.loads(HOTEL_EVENTS.read_text(encoding="utf-8"))
    h_by_id = {o["id"]: i for i, o in enumerate(hotel["events"])}
    added = replaced = h_added = h_replaced = queued = 0

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
        else:
            queued += len(doc["changes"])

    EVENTS.write_text(json.dumps(events, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    HOTEL_EVENTS.write_text(json.dumps(hotel, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"카드 이벤트: 추가 {added} · 교체 {replaced} / 호텔 이벤트: 추가 {h_added} · 교체 {h_replaced} / 카드 상품 검토 대기 {queued}")


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
