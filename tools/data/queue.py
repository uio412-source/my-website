"""수집 대기열(data/collect-queue.json) 만들기 — 외부 수집기(ChatGPT·Pickle·Claude 등)가 '다음에 무엇을 모을지' 고르는 목록.

  python tools/data/queue.py

- cards: 상품설명서(card-terms)를 정리할 카드. 인기·중요도 순(이미지·피킹률·프리미엄·일반 발급 카드 먼저).
- brandPrograms: 카드사 × 국제브랜드 × 등급별 '선택 서비스' 안내(호텔 발레·공항 라운지·공항 발레·공항 커피 등).
- eventSources: 이벤트를 모을 공식 목록(카드사·호텔 체인·항공사·면세점). lastCollected = 그 출처를 마지막으로 모은 날
  (수집 파일의 listUrls — 호텔은 이벤트 url — 에 그 출처의 공식 도메인이 있으면 그날 모은 것으로 봄).
각 항목의 key를 수집 파일의 queueKey(또는 이벤트 파일 이름)에 적으면, 다음 실행 때 이미 한 항목을 건너뛸 수 있습니다.
이미 data/inbox에 있는 key는 status를 done으로 표시합니다. 등급 뒤에 카드 구분을 붙인 key(예:
 hyundai-visa-infinite-the-black)는 대기열의 기본 key(hyundai-visa-infinite)도 done으로 봅니다.
파일 맨 위의 lastCollected(종류별 최근 수집일)·nextStart(종류별 다음 시작 key)로 어디서 이어서 모을지 알 수 있습니다.
카드 DB·hotels/valet.json·inbox가 바뀌면 다시 실행해 커밋하세요(main에서 수집 PR이 머지되면 automerge.py가 자동으로 다시 만들어 커밋합니다).
"""
import gzip, json, re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "paymorevent/data/catalog-snapshot.json"
VALET = ROOT / "hotels/valet.json"
INBOX = ROOT / "data/inbox"
OUT = ROOT / "data/collect-queue.json"
TODAY = (datetime.now(timezone.utc) + timedelta(hours=9)).strftime("%Y-%m-%d")
RESTRICTED = re.compile(r"교육청|공무원|도청|시청|군청|경찰|소방|국방|나라사랑|국민행복|바우처|복지카드|화물복지|법인|BIZ|비즈니스|사업자|학생증|ISIC|협회|연합회|조합원|다자녀|교육사랑", re.I)

# 카드사 × 브랜드 × 등급: 선택 서비스(호텔 발레·공항 라운지 등)가 붙는 프리미엄 등급
TIERS = {
    "Visa": ["Platinum", "Signature", "Infinite"],
    "Mastercard": ["Platinum", "Titanium", "World", "World Elite"],
    "American Express": ["Gold", "Platinum", "PLATINUM ELITE", "The Platinum"],
    "UnionPay": ["Diamond"],
}
BRAND_ISSUERS = {
    "신한카드": ["Visa", "Mastercard", "American Express", "UnionPay"], "KB국민카드": ["Visa", "Mastercard", "American Express", "UnionPay"],
    "삼성카드": ["Visa", "Mastercard", "American Express"], "현대카드": ["Visa", "Mastercard", "American Express"],
    "우리카드": ["Visa", "Mastercard", "UnionPay"], "하나카드": ["Visa", "Mastercard", "American Express", "UnionPay"],
    "롯데카드": ["Visa", "Mastercard", "American Express", "UnionPay"], "NH농협카드": ["Visa", "Mastercard", "UnionPay"],
    "BC카드": ["Visa", "Mastercard", "UnionPay"],
}
SLUG = {"신한카드": "shinhan", "KB국민카드": "kb", "삼성카드": "samsung", "현대카드": "hyundai", "우리카드": "woori", "하나카드": "hana",
        "롯데카드": "lotte", "NH농협카드": "nh", "BC카드": "bc"}
# 브랜드 서비스 안내를 찾는 곳 (상품설명서·카드 상세의 '국제브랜드 서비스' 탭, 카드사 자료실)
BRAND_HINTS = {
    "신한카드": "카드 상세 > 상품설명서 PDF(www.shinhancard.com/pconts/download/card/…) 또는 'Visa/Mastercard 서비스 안내' PDF",
    "KB국민카드": "카드 상세(card.kbcard.com/CXPRICAC0076.cms?…) > 상세혜택 > 티타늄/Visa 서비스 탭",
    "삼성카드": "static11.samsungcard.com/wcms/personal/files/ 의 *_MASTER_*·*_AMEX_*·*_VISA_* PDF (2026년 파일명 우선)",
    "현대카드": "카드 상세 > 상품설명서 · 'Visa/Mastercard/AMEX 프리미엄 서비스' 안내",
    "우리카드": "pc.wooricard.com 카드 상세 > 상품설명서 · 이벤트(prgevnt) 페이지",
    "하나카드": "m.hanacard.co.kr/leaflet/ 의 브랜드 공통서비스 PDF(예: MW003_2026….pdf = Mastercard World)",
    "롯데카드": "image.lottecard.co.kr/webapp/file/ 의 브랜드 서비스 안내 PDF",
    "NH농협카드": "card.nonghyup.com 카드 상세 > 채움특별서비스(해외브랜드) · 상품설명서",
    "BC카드": "www.bccard.com 카드 상세 > 상품설명서(/down/individual/…pdf)",
}
EVENT_SOURCES = [
    ("card-events", "신한카드", "https://www.shinhancard.com/mob/MOBFW11011N/MOBFW11011C02.shc"),
    ("card-events", "KB국민카드", "https://card.kbcard.com/BON/DVIEW/HBBMCXCRVNEC0001"),
    ("card-events", "삼성카드", "https://www.samsungcard.com/personal/event/ing/UHPPBE1403M0.jsp"),
    ("card-events", "현대카드", "https://www.hyundaicard.com/cpb/ev/CPBEV0101_06.hc"),
    ("card-events", "우리카드", "https://pc.wooricard.com/dcpc/yh1/bnf/bnf01/H1BNF201S00.do"),
    ("card-events", "하나카드", "https://m.hanacard.co.kr/MPAEVT100M.web"),
    ("card-events", "롯데카드", "https://www.lottecard.co.kr/app/LPBNFDA_V100.lc"),
    ("card-events", "NH농협카드", "https://card.nonghyup.com/servlet/IpCb0005M.act"),
    ("card-events", "BC카드", "https://bccard.com/app/card/EvntBnftSubMainActn.do"),
    ("card-events", "발급 캐시백(네이버페이)", "https://card.pay.naver.com/home/promotion"),
    ("card-events", "발급 캐시백(카카오페이)", "https://card-hub.kakaopay.com"),
    ("card-events", "발급 캐시백(페이북)", "https://web.paybooc.co.kr"),
    ("hotel-events", "Marriott", "https://www.marriott.com/ko/offers.mi"),
    ("hotel-events", "Hilton", "https://www.hilton.com/en/offers/"),
    ("hotel-events", "IHG", "https://www.ihg.com/content/kr/ko/offers"),
    ("hotel-events", "Accor", "https://all.accor.com/a/ko/deals-corner.html"),
    ("hotel-events", "Hyatt", "https://world.hyatt.com/content/gp/ko/offers.html"),
    ("travel-events", "대한항공", "https://www.koreanair.com"),
    ("travel-events", "아시아나항공", "https://flyasiana.com"),
    ("travel-events", "제주항공", "https://www.jejuair.net"),
    ("travel-events", "진에어", "https://www.jinair.com"),
    ("travel-events", "티웨이항공", "https://www.twayair.com"),
    ("travel-events", "에어부산", "https://www.airbusan.com"),
    ("travel-events", "에어서울", "https://flyairseoul.com"),
    ("travel-events", "에어프레미아", "https://www.airpremia.com"),
    ("travel-events", "롯데면세점", "https://kor.lottedfs.com"),
    ("travel-events", "신라면세점", "https://www.shilladfs.com"),
    ("travel-events", "신세계면세점", "https://www.ssgdfs.com"),
    ("travel-events", "현대면세점", "https://www.hddfs.com"),
    ("travel-events", "인천공항", "https://www.airport.kr"),
]


def inbox_docs():
    """data/inbox/<종류>/*.json 을 (종류, 내용)으로. 깨진 파일은 건너뜀(양식 검사는 inbox.py 담당)."""
    docs = []
    for path in sorted(INBOX.glob("*/*.json")):
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if isinstance(doc, dict):
            docs.append((path.parent.name, doc))
    return docs


def item_keys(item: dict) -> list:
    """수집 항목이 밝히는 대기열 key: queueKey 우선, cardId·id도 함께(둘 다 대기열 key일 수 있음)."""
    return [v for v in (item.get("queueKey"), item.get("cardId"), item.get("id")) if isinstance(v, str) and v]


def done_keys(brand_keys: set) -> set:
    """이미 수집한 key. 등급 뒤에 카드 구분을 붙인 자세한 key는 대기열의 기본 key도 done으로 봄.

    예: hyundai-visa-infinite-the-black(수집함) → 대기열 key hyundai-visa-infinite도 done.
    대기열에 있는 key와 정확히 같을 때만 그대로 쓰고, 카드 id는 접두사로 넓히지 않습니다(kb-09310 ↔ kb-0931 오인 방지).
    """
    done = set()
    for _folder, doc in inbox_docs():
        for item in (doc.get("cards") or []) + (doc.get("programs") or []):
            if isinstance(item, dict):
                done.update(item_keys(item))
    extra = set()
    for key in done:
        if key in brand_keys:
            continue
        parts = key.split("-")
        for i in range(len(parts) - 1, 1, -1):  # 가장 긴 기본 key부터
            base = "-".join(parts[:i])
            if base in brand_keys:
                extra.add(base)
                break
    return done | extra


def last_collected() -> dict:
    """종류별 최근 수집일(collectedAt의 최댓값)."""
    out = {}
    for folder, doc in inbox_docs():
        got = doc.get("collectedAt")
        if isinstance(got, str) and len(got) == 10:
            out[folder] = max(out.get(folder, ""), got)
    return out


def base_domain(url: str) -> str:
    """https://m.hanacard.co.kr/… → hanacard.co.kr, https://card.pay.naver.com/… → naver.com"""
    labels = (urlparse(url).hostname or "").lower().split(".")
    n = 3 if len(labels) >= 3 and labels[-1] == "kr" and labels[-2] in ("co", "go", "or", "ne", "ac") else 2
    return ".".join(labels[-n:])


def source_days() -> dict:
    """(종류, 공식 도메인)별 최근 수집일. 목록 주소(listUrls)를 보고, 목록 주소가 없는 종류(호텔)는 이벤트 url을 봅니다."""
    out = {}
    for folder, doc in inbox_docs():
        got = doc.get("collectedAt")
        if not (isinstance(got, str) and len(got) == 10):
            continue
        urls = doc.get("listUrls") if "listUrls" in doc else [e.get("url") for e in doc.get("events") or [] if isinstance(e, dict)]
        for u in urls or []:
            if isinstance(u, str) and u.startswith("http"):
                key = (folder, base_domain(u))
                out[key] = max(out.get(key, ""), got)
    return out


def main():
    all_brand = set()
    for issuer, brands in BRAND_ISSUERS.items():
        for b in brands:
            for t in TIERS[b]:
                all_brand.add(f"{SLUG[issuer]}-{re.sub(r'[^a-z0-9]+', '-', (b + ' ' + t).lower()).strip('-')}")
    done = done_keys(all_brand)
    cards = json.loads(CATALOG.read_text(encoding="utf-8"))["cards"]
    seen, rows = set(), []
    for c in cards:
        fam = (c["issuer"], c.get("familyName") or c["name"])
        if fam in seen:
            continue
        seen.add(fam)
        score = 0
        score += 30 if c.get("imageUrl") else 0
        score += 25 if c.get("pickingScenarios") else 0
        score += 20 if c.get("issuanceStatus") == "confirmed" else 0
        score += 15 if (c.get("annualFeeMin") or 0) >= 100000 else 0  # 프리미엄: 브랜드 선택 서비스가 많음
        score += 10 if c.get("type") == "credit" else 0
        score += 0 if c.get("termsUrl") else 10                         # 상품설명서 주소가 없으면 먼저
        score -= 60 if RESTRICTED.search(c["name"]) else 0
        rows.append({
            "key": c["id"], "issuer": c["issuer"], "name": fam[1], "type": c.get("type"), "url": c.get("sourceUrl"), "termsUrl": c.get("termsUrl"),
            "lastVerified": (c.get("verifiedAt") or "")[:10], "priority": score, "status": "done" if c["id"] in done else "todo",
        })
    rows.sort(key=lambda r: (-r["priority"], r["issuer"], r["name"]))

    valet = json.loads(VALET.read_text(encoding="utf-8"))
    have = {(p["issuer"], p["brand"].lower(), p["tier"].lower()) for p in valet["programs"]}
    progs = []
    for issuer, brands in BRAND_ISSUERS.items():
        for b in brands:
            for t in TIERS[b]:
                key = f"{SLUG[issuer]}-{re.sub(r'[^a-z0-9]+', '-', (b + ' ' + t).lower()).strip('-')}"
                status = "done" if key in done else "valet-only" if (issuer, b.lower(), t.lower()) in have else "todo"
                progs.append({"key": key, "issuer": issuer, "brand": b, "tier": t, "where": BRAND_HINTS[issuer], "status": status})

    collected = last_collected()
    days = source_days()
    sources = [{"key": f"{t}:{n}", "type": t, "name": n, "url": u, "lastCollected": days.get((t, base_domain(u)))} for t, n, u in EVENT_SOURCES]
    kinds =("card-terms", "brand-services", "card-events", "hotel-events", "travel-events", "card-products")
    out = {
        "built": TODAY,
        "how": "status가 todo인 것부터 위에서 아래로. 시작 전에 이 파일·data/inbox/·열린 PR(gh pr list --state open)을 함께 보고 겹치지 않는 항목만 고릅니다(docs/data-update.md 9장 조율 규칙). 수집 파일에 queueKey로 key를 적으면 다음에 done이 됩니다(이 파일은 python tools/data/queue.py로 다시 만듦).",
        "lastCollected": {k: collected.get(k) for k in kinds},
        "nextStart": {
            "cards": next((r["key"] for r in rows if r["status"] == "todo"), None),
            "brandPrograms": next((p["key"] for p in progs if p["status"] == "todo"), None),
        },
        "counts": {
            "cards": {"done": sum(r["status"] == "done" for r in rows), "todo": sum(r["status"] == "todo" for r in rows), "total": len(rows)},
            "brandPrograms": {"done": sum(p["status"] == "done" for p in progs), "valetOnly": sum(p["status"] == "valet-only" for p in progs),
                              "todo": sum(p["status"] == "todo" for p in progs), "total": len(progs)},
            "eventSources": {"collected": sum(bool(s["lastCollected"]) for s in sources), "total": len(sources)},
        },
        "eventSources": sources,
        "brandPrograms": progs,
        "cards": rows,
    }
    try:  # 내용이 그대로면 built 날짜도 그대로 둡니다(날마다 빈 커밋이 생기지 않게)
        old = json.loads(OUT.read_text(encoding="utf-8"))
        if {k: v for k, v in old.items() if k != "built"} == {k: v for k, v in out.items() if k != "built"}:
            out["built"] = old.get("built") or TODAY
    except (OSError, json.JSONDecodeError):
        pass
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    todo = sum(r["status"] == "todo" for r in rows)
    bt = sum(p["status"] == "todo" for p in progs)
    print(f"수집 대기열: 카드 {len(rows)}종(남은 {todo}) · 브랜드 프로그램 {len(progs)}개(남은 {bt}) · 이벤트 출처 {len(EVENT_SOURCES)}곳")


if __name__ == "__main__":
    main()
