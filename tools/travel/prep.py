"""Mr. Travel '여행준비' 데이터: 항공권 · 호텔예약 · 이동수단 · 면세점 · 라운지.

  python tools/travel/prep.py

- 입력: paymorevent/data/events.json (카드사 이벤트, 배포 때 data/inbox가 합쳐진 뒤),
        paymorevent/data/cards.json.gz (카드 상품), hotels/events.json (호텔 체인 프로모션)
- 출력: travel/prep.json
배포 때 tools/travel/benefits.py 다음에 실행됩니다. 분류 키워드는 아래 RX에서 고칩니다.
"""
import gzip, html, json, re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from ads import is_ad

ROOT = Path(__file__).resolve().parents[2]
EVENTS = ROOT / "paymorevent/data/events.json"
CARDS = ROOT / "paymorevent/data/cards.json.gz"
HOTEL_EVENTS = ROOT / "hotels/events.json"
OUT = ROOT / "travel/prep.json"
# 배포 때 tools/data/inbox.py merge가 만드는 파일(없으면 건너뜀)
VENDOR = ROOT / "travel/vendor-events.json"
BRAND = ROOT / "paymorevent/data/brand-services.json"
TODAY = (datetime.now(timezone.utc) + timedelta(hours=9)).strftime("%Y-%m-%d")

RX = {
    "air": re.compile(r"항공권|항공사|국제선|대한항공|아시아나|진에어|제주항공|티웨이|에어부산|에어서울|이스타|에어프레미아|LCC|스카이스캐너|땡처리", re.I),
    "hotel": re.compile(r"호텔|숙박|리조트|아고다|agoda|익스피디아|호텔스닷컴|트립닷컴|부킹닷컴|booking\.com|메리어트|힐튼|하얏트|IHG|아코르|accor", re.I),
    "move": re.compile(r"공항.{0,8}(주차|발레|리무진|픽업|철도|이동)|주차대행|공항버스|리무진|렌터카|hertz|avis|택시|그랩|grab|우버|uber|디디|didi|MOVV|AREX|공항철도", re.I),
    "dutyfree": re.compile(r"면세"),
    "lounge": re.compile(r"라운지"),
}
# 국내 호텔 식사권·패키지처럼 해외여행 준비와 먼 행사는 호텔 칸에서 뺌
HOTEL_SKIP = re.compile(r"식사권|뷔페|다이닝|애프터눈|웨딩|돌잔치|케이크|휘닉스파크|소노|휴양림|하이원|국내 ?호텔")
AIRPORT_LOUNGE = re.compile(r"공항|PP\b|PP카드|priority ?pass|프라이어리티|라운지 ?키|lounge ?key|마티나|스카이허브|드래곤 ?패스|dragon ?pass|인천|김포|라운지", re.I)
NOT_AIRPORT = re.compile(r"호텔 ?라운지|클럽 ?라운지|이그제큐티브|executive|VIP ?라운지(?!.*공항)|백화점|골프", re.I)
# 해외 공항(귀국편 출국 때)까지 되는 라운지: PP·라운지키·드래곤패스·전 세계
OVERSEAS = re.compile(r"전 ?세계|해외 ?공항|국내외|PP|priority ?pass|프라이어리티|라운지 ?키|lounge ?key|드래곤 ?패스|dragon ?pass|\d{3,4}\s*개", re.I)
DOMESTIC = re.compile(r"인천|김포|국내 ?공항|마티나|스카이허브|제주공항|김해")
ARRIVAL = re.compile(r"입국|도착|arrival|패스트 ?트랙|fast ?track|미트 ?앤 ?그리트|meet", re.I)
AIRLINES = [
    ("대한항공", "https://www.koreanair.com"),
    ("아시아나항공", "https://flyasiana.com"),
    ("제주항공", "https://www.jejuair.net"),
    ("진에어", "https://www.jinair.com"),
    ("티웨이항공", "https://www.twayair.com"),
    ("에어부산", "https://www.airbusan.com"),
    ("에어서울", "https://flyairseoul.com"),
    ("에어프레미아", "https://www.airpremia.com"),
]
DUTY_FREE = [
    ("롯데면세점", "https://kor.lottedfs.com"),
    ("신라면세점", "https://www.shilladfs.com"),
    ("신세계면세점", "https://www.ssgdfs.com"),
    ("현대면세점", "https://www.hddfs.com"),
]


def clean(s):
    s = html.unescape(html.unescape(str(s or "")))
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def short(s, n):
    s = clean(s)
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


# 라운지 문장을 자를 경계: 문장 부호 뒤 공백, 가운데점(·)과 슬래시(/)로 나뉜 항목
LOUNGE_SPLIT = re.compile(r"(?<=[.!?。])\s+|\s*[·•]\s*|\s*[/|;；]\s*|\s+▶\s*")


def lounge_sentence(text, limit=130):
    """'라운지'가 들어간 항목 하나를 문장··// 경계에서 잘라 냄.

    예전에는 '라운지' 앞 40자를 아무 데서나 잘라 'ite 서비스'처럼 단어 중간에서 시작했습니다.
    """
    for part in LOUNGE_SPLIT.split(clean(text)):
        p = part.strip(" -—–·•,;:")
        if "라운지" not in p or len(p) < 4:
            continue
        if len(p) <= limit:
            return p
        # 조각이 길면 라운지 앞쪽에서 시작하되 단어 경계로 맞추고, 끝도 단어 중간이면 버림
        at = p.index("라운지")
        start = max(0, at - 40)
        if start:
            space = p.rfind(" ", 0, start)
            start = space + 1 if space >= 0 else start
        cut = p[start:start + limit]
        if start + limit < len(p):
            space = cut.rfind(" ")
            if space >= limit // 2:
                cut = cut[:space]
        return cut.strip(" -—–·•,;:") + "…"
    return ""


def card_events():
    out, seen = {k: [] for k in RX}, set()
    for e in json.loads(EVENTS.read_text(encoding="utf-8")):
        if is_ad(e.get("title", "")):  # 광고성 이벤트는 Mr. Cards와 같이 뺌(tools/travel/ads.py)
            continue
        if e.get("status") not in ("active", "upcoming", "needs_review"):
            continue
        if (e.get("endsAt") or "9999") < TODAY:
            continue
        title = clean(e.get("title"))
        text = clean(e.get("benefitText") or e.get("description"))
        if (e.get("issuer"), title) in seen:
            continue
        seen.add((e.get("issuer"), title))
        if re.search(r"공식 진행 이벤트|상세 혜택 및 참여|확인 필요$", text):
            text = ""
        hay = f"{title} {text}"
        item = {
            "id": e["id"], "issuer": e.get("issuer") or "", "title": title,
            "text": "" if text == title or text in title else short(text, 90),
            "end": e.get("endsAt"), "url": e.get("sourceDetailUrl") or e.get("sourceUrl"),
            "kind": e.get("kind"), "amount": e.get("cashbackAmount"),
        }
        for k, rx in RX.items():
            if not rx.search(hay):
                continue
            if k == "hotel" and HOTEL_SKIP.search(hay):
                continue
            out[k].append(item)
    for k in out:
        out[k].sort(key=lambda x: (x["end"] or "9999", x["issuer"]))
    return out


def rate_num(r):
    nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", str(r or ""))]
    return max(nums) if nums else 0


def cards_index():
    raw = json.loads(gzip.decompress(CARDS.read_bytes()))
    cards = raw if isinstance(raw, list) else raw["cards"]
    lounge, dutyfree, valet, seen = [], [], [], set()
    for c in cards:
        family = c.get("familyName") or c["name"]
        key = (c["issuer"], family)
        if key in seen:
            continue
        seen.add(key)
        base = {"id": c["id"], "issuer": c["issuer"], "name": family, "type": {"credit": "신용", "prepaid": "선불"}.get(c.get("type"), "체크"),
                "fee": c.get("annualFeeMin")}
        # 라운지: 국제브랜드 서비스 + 카드 혜택 원문
        items = []
        for s in c.get("networkServices") or []:
            if s.get("category") == "airport_lounge":
                cond = " · ".join(s.get("conditions") or [])
                items.append({"title": clean(s.get("title")), "text": short(s.get("coverageText") or cond, 110),
                              "arrival": bool(ARRIVAL.search(f"{s.get('title')} {cond}"))})
        for b in c.get("benefits") or []:
            t, d = clean(b.get("title")), clean(b.get("detail"))
            if "라운지" not in t + d or NOT_AIRPORT.search(t) or not AIRPORT_LOUNGE.search(t + " " + d[:200]):
                continue
            # 라운지 문장만 문장··// 경계에 맞춰 잘라서 보여 줌(단어 중간에서 시작하지 않게)
            items.append({"title": t, "text": short(lounge_sentence(d) or d, 110), "arrival": bool(ARRIVAL.search(t + " " + d))})
        if items:
            text = " ".join(i["title"] + " " + i["text"] for i in items)
            lounge.append({**base, "items": items[:4], "arrival": any(i["arrival"] for i in items),
                           "overseas": bool(OVERSEAS.search(text)), "domestic": bool(DOMESTIC.search(text)) or not OVERSEAS.search(text)})
        # 면세점 할인·적립
        for b in c.get("benefits") or []:
            t = clean(b.get("title"))
            if "면세" in t:
                n = rate_num(b.get("rate") or t)
                if n > 50 or "바우처" in t:  # 바우처·연 한도 청구할인은 면세점 할인율이 아님
                    continue
                dutyfree.append({**base, "title": short(t, 60), "rate": clean(b.get("rate")) or "", "n": n})
                break
        # 공항 발레·주차
        for s in c.get("networkServices") or []:
            if s.get("category") == "airport_valet":
                valet.append({**base, "title": clean(s.get("title")) or "공항 발레파킹"})
                break
        else:
            for b in c.get("benefits") or []:
                t, d = clean(b.get("title")), clean(b.get("detail"))
                if re.search(r"공항.{0,6}(발레|주차)|주차대행", t + " " + d[:300]):
                    valet.append({**base, "title": short(t, 50)})
                    break
    lounge.sort(key=lambda x: (not x["overseas"], x["issuer"], x["name"]))
    dutyfree.sort(key=lambda x: (-x["n"], x["issuer"]))
    valet.sort(key=lambda x: (x["issuer"], x["name"]))
    for x in dutyfree:
        del x["n"]
    return lounge, dutyfree, valet


def hotel_chain_events():
    data = json.loads(HOTEL_EVENTS.read_text(encoding="utf-8"))
    out = [{"id": e["id"], "brand": e["brand"], "title": e["title"], "text": e.get("benefit") or "", "end": e.get("endsAt"),
            "url": e.get("url"), "register": bool(e.get("register"))}
           for e in data.get("events", []) if (e.get("endsAt") or "9999") >= TODAY]
    out.sort(key=lambda x: x["end"] or "9999")
    return out


def vendor_events():
    """항공사·면세점·여행사 자체 이벤트 (data/inbox/travel-events)"""
    if not VENDOR.exists():
        return {}
    out = {}
    for e in json.loads(VENDOR.read_text(encoding="utf-8")).get("events", []):
        if e["end"] < TODAY:
            continue
        out.setdefault(e["vendorType"], []).append({"id": e["id"], "issuer": "", "brand": e["vendor"], "title": e["title"], "text": e["text"],
                                                    "end": e["end"], "url": e["url"], "vendor": True})
    return out


def brand_cards():
    """국제브랜드·카드사 선택 서비스(data/inbox/brand-services)에서 공항 라운지·공항 발레 되는 카드"""
    if not BRAND.exists():
        return [], []
    lounge, valet = [], []
    for g in json.loads(BRAND.read_text(encoding="utf-8")).get("programs", []):
        for s in g["services"]:
            base = {"issuer": g["issuer"], "program": f"{g['brand']} {g['tier']}", "cards": g["cards"], "ids": g.get("catalogIds") or [], "url": g["url"]}
            text = " ".join([s["title"], s.get("coverage") or "", *(s.get("conditions") or [])])
            if s["category"] == "airport_lounge":
                lounge.append({**base, "title": s["title"], "text": short(text, 110), "overseas": bool(OVERSEAS.search(text)), "domestic": bool(DOMESTIC.search(text)) or not OVERSEAS.search(text)})
            elif s["category"] in ("airport_valet", "airport_parking"):
                valet.append({**base, "title": s["title"]})
    return lounge, valet


def main():
    ev = card_events()
    lounge, dutyfree, valet = cards_index()
    vend = vendor_events()
    b_lounge, b_valet = brand_cards()
    # 선택 서비스로 라운지가 되는 카드: 카드 DB에 없는 카드만 덧붙임
    have = {c["id"] for c in lounge}
    for x in b_lounge:
        for i, name in enumerate(x["cards"]):
            cid = x["ids"][i] if i < len(x["ids"]) else None
            if cid and cid in have:
                continue
            lounge.append({"id": cid or "", "issuer": x["issuer"], "name": name, "type": "", "fee": None, "arrival": bool(ARRIVAL.search(x["text"])),
                           "overseas": x["overseas"], "domestic": x["domestic"], "items": [{"title": f"{x['program']} · {x['title']}", "text": x["text"], "arrival": False}]})
    have_v = {c["id"] for c in valet}
    for x in b_valet:
        for i, name in enumerate(x["cards"]):
            cid = x["ids"][i] if i < len(x["ids"]) else None
            if not (cid and cid in have_v):
                valet.append({"id": cid or "", "issuer": x["issuer"], "name": name, "type": "", "fee": None, "title": f"{x['program']} · {x['title']}"})
    out = {
        "built": TODAY,
        "air": {"events": vend.get("airline", []) + vend.get("ota", []) + ev["air"], "links": [{"name": n, "url": u} for n, u in AIRLINES]},
        "hotel": {"chains": hotel_chain_events(), "events": ev["hotel"]},
        "move": {"events": vend.get("airport", []) + ev["move"], "valet": valet},
        "dutyfree": {"events": vend.get("dutyfree", []) + ev["dutyfree"], "cards": dutyfree, "links": [{"name": n, "url": u} for n, u in DUTY_FREE]},
        "lounge": {"events": ev["lounge"], "cards": lounge},
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("여행준비:", {k: (len(v.get("events", [])), len(v.get("cards", v.get("valet", v.get("chains", []))))) for k, v in out.items() if isinstance(v, dict)})


if __name__ == "__main__":
    main()
