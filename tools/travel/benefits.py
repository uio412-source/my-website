"""Mr. Travel 혜택 데이터: Mr. Cards 카드사 이벤트·카드 DB에서 해외·여행 혜택만 골라 요약합니다.

  python tools/travel/benefits.py

- 입력: paymorevent/data/events.json (카드사 이벤트), paymorevent/data/cards.json.gz (카드 상품)
- 출력: travel/benefits.json
  - events: 끝나지 않은 해외·여행 이벤트. places가 비어 있으면 '공통', 나라 코드가 있으면 '나라별'
  - cards : 트래블카드(해외 결제·ATM 수수료 면제, 라운지 등) 요약
나라 코드는 travel/places.json의 id와 같습니다. 지역 묶음은 EU(유럽)·SEA(동남아)·APAC(아시아·태평양).
배포 때마다 실행되므로 Mr. Cards 데이터가 갱신되면 여기도 자동으로 따라갑니다.
"""
import gzip, html, json, re
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVENTS = ROOT / "paymorevent/data/events.json"
CARDS = ROOT / "paymorevent/data/cards.json.gz"
OUT = ROOT / "travel/benefits.json"

TODAY = (datetime.now(timezone.utc) + timedelta(hours=9)).strftime("%Y-%m-%d")

TRAVEL = re.compile(
    r"해외|여행|트래블|항공|공항|면세|환전|라운지|트립닷컴|아고다|agoda|익스피디아|호텔스닷컴|hotels\.com|클룩|kkday|"
    r"그랩|grab|우버|uber|비스터|맥아더글렌|렌터카|hertz|avis|유심|esim|로밍|와이파이 ?도시락|여행자보험|"
    r"돈키호테|빅카메라|bic camera|미츠이|ihg|래디슨|밀레니엄|프리퍼드|"
    r"일본|중국|대만|홍콩|마카오|몽골|베트남|태국|필리핀|싱가포르|말레이시아|인도네시아|발리|라오스|괌|사이판|"
    r"호주|뉴질랜드|미국|하와이|뉴욕|캐나다|유럽|영국|프랑스|이탈리아|스페인|스위스|튀르키예|터키|두바이|이집트",
    re.I)
# 국내 숙박·여행만 해당하는 행사는 뺌 (제목에 '해외'가 있으면 남김)
DOMESTIC = re.compile(r"휘닉스파크|소노|국내호텔|국내 호텔|제주|부산|경상|여수|숲 ?여행|강원|조선 ?팰리스|파르나스|시그니엘|"
                      r"롯데호텔|그랜드 ?조선|그랜드 머큐어|호텔 ?식사권|백미당|애프터눈|휴양림|우다페|ALL x WOORI|DINING WEEK|에플로어|KTX|중고차|직구|몰테일")
SIGNUP = re.compile(r"^(네이버페이|카카오페이|토스|페이코|PAYCO)\s*·")
GENERIC = re.compile(r"^공식 (진행 이벤트|혜택|목록의)|확인 필요$")
# 혜택이 아닌 안내문(서비스 오픈·멤버십·유의사항)은 혜택 카드로 보여 주지 않음
NOTICE = re.compile(r"알려드려요|안내|서비스 ?오픈|유의 ?사항")
# '멤버십 등급 제공·업그레이드'처럼 실제 혜택인 멤버십은 남기고, '멤버십 안내'만 안내문으로 봄
MEMBERSHIP = re.compile(r"멤버십")
MEMBERSHIP_BENEFIT = re.compile(r"등급|제공|업그레이드|무료")
BENEFIT_WORD = re.compile(r"할인|적립|캐시백|%|\d[\d,]*\s*(?:만\s*)?원")

# 나라·지역 키워드 (travel/places.json id). 위에서부터 차례로 검사
PLACES = [
    ("HI", r"하와이|호놀룰루"),
    ("JP", r"일본|도쿄|오사카|교토|후쿠오카|삿포로|오키나와|돈키호테|빅카메라|bic ?camera|미츠이|스시로|코메다|레고랜드|스튜디오도쿄|호시노|hoshino|byfood|엔\(JPY\)|JPY"),
    ("CN", r"중국|상하이|베이징|알리페이|alipay|위안"),
    ("TW", r"대만|타이베이|타이완"),
    ("HK", r"홍콩"),
    ("MO", r"마카오"),
    ("MN", r"몽골"),
    ("VN", r"베트남|다낭|나트랑|하노이|호치민|푸꾸옥"),
    ("TH", r"태국|방콕|푸켓|치앙마이"),
    ("PH", r"필리핀|세부|보라카이|마닐라"),
    ("SG", r"싱가포르"),
    ("MY", r"말레이시아|코타키나발루|쿠알라"),
    ("ID", r"인도네시아|발리"),
    ("LA", r"라오스"),
    ("GU", r"괌|사이판"),
    ("AU", r"호주|시드니"),
    ("NZ", r"뉴질랜드"),
    ("US", r"미국|뉴욕|H ?Mart|자유의 여신상|라스베가스"),
    ("CA", r"캐나다|밴쿠버"),
    ("GB", r"영국|런던"),
    ("FR", r"프랑스|파리(?!바게)"),
    ("IT", r"이탈리아|로마|밀라노"),
    ("ES", r"스페인|바르셀로나"),
    ("CH", r"스위스"),
    ("TR", r"튀르키예|터키|이스탄불"),
    ("AE", r"두바이|아랍에미리트|UAE"),
    ("EG", r"이집트"),
    ("EU", r"유럽|비스터|맥아더글렌"),
    ("SEA", r"동남아|grab|그랩"),
    ("APAC", r"아시아 ?태평양|아태"),
]
PLACES = [(c, re.compile(p, re.I)) for c, p in PLACES]
GLOBAL = re.compile(r"전 ?세계|국내외|글로벌|아고다|agoda|호텔스닷컴|익스피디아|트립닷컴|클룩|우버|uber|DiDi|디디", re.I)

TYPES = [
    ("보험", r"보험"),
    ("통신", r"유심|esim|로밍|와이파이|데이터"),
    ("교통", r"택시|그랩|grab|우버|uber|렌터카|hertz|avis|대중교통|디디|didi"),
    ("공항", r"공항|라운지|주차|movv|리무진"),
    ("쇼핑", r"면세|비스터|맥아더글렌|아울렛|돈키호테|빅카메라|bic ?camera|백화점|쇼핑|h ?mart|직구|circle ?k|편의점"),
    ("투어", r"하나투어|모두투어|노랑풍선|참좋은|롯데관광|한진트래블|마이리얼트립|클룩|kkday|투어|패키지|골프|전세기|크루즈|레고랜드|스튜디오"),
    ("숙소", r"호텔|숙박|아고다|agoda|익스피디아|리조트|ihg|힐튼|메리어트|하얏트|래디슨|밀레니엄|프리퍼드|accor|트래블버킷|호텔패스|트립닷컴"),
    ("항공", r"항공|마일리지|국제선"),
    ("할부", r"할부|분할납부"),
    ("다이닝", r"다이닝|레스토랑|커피|라멘|스시|식당"),
]
TYPES = [(t, re.compile(p, re.I)) for t, p in TYPES]
BRANDS = [("Visa", r"visa"), ("Mastercard", r"마스터|master"), ("JCB", r"jcb"),
          ("UnionPay", r"유니온페이|unionpay|\bUPI\b"), ("Amex", r"아멕스|amex")]
BRANDS = [(b, re.compile(p, re.I)) for b, p in BRANDS]


def clean(s):
    s = html.unescape(html.unescape(str(s or "")))
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def no_excluded(s):
    """'일본호텔 제외' 같은 조각은 나라 판정에서 뺌"""
    return " ".join(p for p in re.split(r"[·,()\[\]※/]", s) if "제외" not in p)


def places_of(title, desc):
    text = no_excluded(title)
    found = [c for c, rx in PLACES if rx.search(text)]
    # 제목에 나라가 없으면 짧은 부제(신한카드식 '신한 Mastercard 일본 할인 혜택')만 봄. 전 세계 OTA 할인은 공통
    if not found and desc and len(desc) <= 40 and not GLOBAL.search(title):
        found = [c for c, rx in PLACES if rx.search(no_excluded(desc))]
    if "HI" in found and "US" in found:
        found.remove("US")
    if "SEA" in found and len(found) > 1:
        found.remove("SEA")
    return found


def kind_of(text):
    for t, rx in TYPES:
        if rx.search(text):
            return t
    return "해외결제"


def build_events():
    out, seen = [], set()
    for e in json.loads(EVENTS.read_text(encoding="utf-8")):
        if e.get("status") not in ("active", "upcoming", "needs_review"):
            continue
        if (e.get("endsAt") or "9999") < TODAY:
            continue
        title, desc = clean(e.get("title")), clean(e.get("description"))
        if SIGNUP.search(title):
            continue
        travel = e.get("category") == "해외/여행" or TRAVEL.search(title) or (len(desc) <= 40 and TRAVEL.search(desc))
        if not travel or (DOMESTIC.search(title) and "해외" not in title):
            continue
        key = (e.get("issuer"), title)
        if key in seen:
            continue
        seen.add(key)
        text = clean(e.get("benefitText"))
        if GENERIC.search(text) or text == title:
            text = desc if desc and desc != title and not GENERIC.search(desc) else ""
        both = f"{title} {desc} {text}"
        notice = NOTICE.search(title) or (MEMBERSHIP.search(title) and not MEMBERSHIP_BENEFIT.search(title))
        if notice and not BENEFIT_WORD.search(both):
            continue
        out.append({
            "id": e["id"],
            "issuer": e.get("issuer") or "",
            "title": title,
            "text": text[:140],
            "kind": kind_of(f"{title} {desc}"),
            "places": places_of(title, desc),
            "brand": next((b for b, rx in BRANDS if rx.search(f"{title} {desc}")), None),
            "start": e.get("startsAt"),
            "end": e.get("endsAt"),
            "check": e.get("status") == "needs_review",
            "url": e.get("sourceDetailUrl") or e.get("sourceUrl"),
        })
        if not text and not out[-1]["brand"]:
            out[-1]["brand"] = next((b for b, rx in BRANDS if rx.search(both)), None)
    out.sort(key=lambda x: (x["end"] or "9999", x["issuer"], x["title"]))
    return out


CARD_NAME = re.compile(r"트래블|travel|해외 ?3\.5", re.I)
CARD_SKIP = re.compile(r"캐릭터|산리오|쿠로미|스페셜|^(삼성월렛|카카오페이) ")


def card_text(c):
    parts = []
    for b in c.get("benefits") or []:
        parts += [str(b.get("category") or ""), str(b.get("title") or ""), str(b.get("detail") or ""), str(b.get("rate") or "")]
    for w in c.get("feeWaivers") or []:
        parts.append(str(w.get("note") or ""))
    parts.append(str(c.get("description") or ""))
    return clean(" ".join(parts))


def won(s):
    s = s.replace(",", "").replace(" ", "")
    m = re.fullmatch(r"(?:(\d+)만)?(?:(\d+)천)?(\d+)?원?", s)
    if not m or not any(m.groups()):
        return None
    man, cheon, rest = (int(x) if x else 0 for x in m.groups())
    return man * 10000 + cheon * 1000 + rest


def fee_label(text):
    """'국내전용 20,000원 (기본 …)' → '연회비 2만원', 여러 개면 '연회비 7천~1.8만원'"""
    text = re.sub(r"\([^)]*\)", " ", text)
    vals = sorted({v for v in (won(x) for x in re.findall(r"\d[\d,]*\s*원|\d+만\s*\d*천?\s*원?|\d+천\s*원?", text)) if v})
    if not vals:
        return "연회비 없음" if re.search(r"없음|면제|0원", text) else ""
    f = lambda v: (f"{v / 10000:g}만" if v >= 10000 else f"{v // 1000}천" if v % 1000 == 0 else f"{v:,}") + ""
    return "연회비 " + (f(vals[0]) + "원" if len(vals) == 1 else f"{f(vals[0])}~{f(vals[-1])}원")


def build_cards():
    cards, seen = [], set()
    for c in json.loads(gzip.open(CARDS).read()):
        name = clean(c.get("name"))
        if not CARD_NAME.search(name) or CARD_SKIP.search(name) or name in seen:
            continue
        seen.add(name)
        t = card_text(c)
        pay = bool(re.search(r"(해외|가맹점)[^。]{0,24}?수수료[^。]{0,14}?(면제|무료|캐시백)|해외 ?(이용|결제) ?수수료[^。]{0,8}?(면제|무료)", t))
        atm = bool(re.search(r"ATM[^。]{0,48}?(면제|무료|캐시백)|인출 ?수수료[^。]{0,12}?(면제|캐시백)", t, re.I))
        lounge = bool(re.search(r"라운지[^。]{0,30}?(무료|입장)|(무료|입장)[^。]{0,10}?라운지", t))
        rates = [float(m) for m in re.findall(r"해외[^%]{0,20}?(\d+(?:\.\d+)?)%\s*(?:결제일)?\s*(?:캐시백|할인|적립)", t)]
        rates = [r for r in rates if 0 < r <= 20]
        fee = fee_label(clean(c.get("annualFeeText")))
        cards.append({
            "id": c["id"], "issuer": c.get("issuer") or "", "name": name,
            "type": "체크" if c.get("type") == "debit" else "신용",
            "brands": [b for b in (c.get("brands") or []) if b != "국내전용"],
            "pay": pay, "atm": atm, "lounge": lounge,
            "back": max(rates) if rates else None,
            "fee": "연회비 없음" if c.get("type") == "debit" and (not fee or fee.endswith(" 0원")) else fee,
            "url": c.get("sourceUrl"),
        })
    cards.sort(key=lambda x: (x["issuer"], x["type"] != "체크", x["name"]))
    return cards


def main():
    events = json.loads(EVENTS.read_text(encoding="utf-8"))
    checked = max((e.get("verifiedAt") or "") for e in events)
    data = {"built": TODAY, "checked": checked, "events": build_events(), "cards": build_cards()}
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    common = sum(1 for e in data["events"] if not e["places"])
    print(f"travel/benefits.json: 이벤트 {len(data['events'])}건(공통 {common}) · 트래블카드 {len(data['cards'])}종 · 카드사 확인 {checked}")


if __name__ == "__main__":
    main()
