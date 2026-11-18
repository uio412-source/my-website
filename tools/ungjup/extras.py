"""보유종목 페이지용 부가 데이터: 종목 검색 목록(symbols.json)과 뉴스 자막(news.json).

브라우저에서는 외부 사이트를 직접 부를 수 없어(CORS) 배포 때 미리 받아 파일로 둡니다.
  - 종목 목록: 미국 = 나스닥 공식 목록(NYSE·ETF 포함), 한국 = 네이버 증권 시가총액 목록(코스피·코스닥·ETF)
               7일마다 새로 받습니다.
  - 뉴스: 보유 개별 종목 + 시장(나스닥·코스피)마다 Google 뉴스 한국어 최근 3일 기사
"""
import json, re, sys, time, urllib.parse, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UA = {"User-Agent": "Mozilla/5.0"}

# 자주 찾는 미국 종목·ETF 한글 이름 (검색용 별칭)
US_KO = {
    "AAPL": "애플", "MSFT": "마이크로소프트", "NVDA": "엔비디아", "AMZN": "아마존닷컴", "GOOGL": "알파벳 A", "GOOG": "알파벳 C",
    "META": "메타 플랫폼스", "TSLA": "테슬라", "AVGO": "브로드컴", "BRK-B": "버크셔 해서웨이 B", "BRK-A": "버크셔 해서웨이 A",
    "JPM": "제이피모간 체이스", "V": "비자", "MA": "마스터카드", "UNH": "유나이티드헬스 그룹", "XOM": "엑슨모빌", "JNJ": "존슨앤드존슨",
    "PG": "프록터앤드갬블", "HD": "홈디포", "COST": "코스트코", "LLY": "일라이 릴리", "ABBV": "애브비", "MRK": "머크", "PFE": "화이자",
    "KO": "코카콜라", "PEP": "펩시코", "MCD": "맥도날드", "WMT": "월마트", "DIS": "월트 디즈니", "NFLX": "넷플릭스", "ADBE": "어도비",
    "CRM": "세일즈포스", "ORCL": "오라클", "CSCO": "시스코", "INTC": "인텔", "AMD": "AMD", "QCOM": "퀄컴", "TXN": "텍사스 인스트루먼트",
    "MU": "마이크론 테크놀로지", "AMAT": "어플라이드 머티어리얼즈", "LRCX": "램리서치", "ASML": "ASML 홀딩", "TSM": "TSMC",
    "ARM": "에이알엠 홀딩스", "SMCI": "슈퍼마이크로컴퓨터", "PLTR": "팔란티어", "SNOW": "스노우플레이크", "CRWD": "크라우드스트라이크",
    "PANW": "팔로알토 네트웍스", "NOW": "서비스나우", "SHOP": "쇼피파이", "UBER": "우버", "ABNB": "에어비앤비", "PYPL": "페이팔",
    "SQ": "블록", "COIN": "코인베이스", "HOOD": "로빈후드", "MSTR": "마이크로스트래티지", "IONQ": "아이온큐", "RGTI": "리게티 컴퓨팅",
    "CRWV": "코어위브", "NBIS": "네비우스 그룹", "SPCX": "스페이스X", "RKLB": "로켓랩", "ASTS": "AST 스페이스모바일",
    "BA": "보잉", "CAT": "캐터필러", "DE": "디어앤드컴퍼니", "GE": "GE 에어로스페이스", "LMT": "록히드 마틴", "RTX": "RTX",
    "BX": "블랙스톤", "GS": "골드만삭스", "MS": "모건스탠리", "BAC": "뱅크오브아메리카", "WFC": "웰스파고", "C": "씨티그룹",
    "SPGI": "S&P 글로벌", "BLK": "블랙록", "NEE": "넥스트에라 에너지", "BE": "블룸 에너지", "ENPH": "엔페이즈 에너지",
    "FSLR": "퍼스트 솔라", "CEG": "컨스텔레이션 에너지", "VST": "비스트라", "OKLO": "오클로", "SMR": "뉴스케일 파워",
    "NKE": "나이키", "SBUX": "스타벅스", "TGT": "타깃", "LULU": "룰루레몬", "F": "포드", "GM": "제너럴 모터스", "RIVN": "리비안",
    "LCID": "루시드", "NIO": "니오", "BABA": "알리바바", "PDD": "PDD 홀딩스", "TCEHY": "텐센트", "SONY": "소니", "TM": "토요타",
    "SPY": "SPDR S&P500", "VOO": "뱅가드 S&P500", "IVV": "아이셰어즈 S&P500", "QQQ": "인베스코 QQQ 나스닥100", "QQQM": "인베스코 나스닥100",
    "QLD": "프로셰어즈 QQQ 2배", "TQQQ": "프로셰어즈 QQQ 3배", "SQQQ": "프로셰어즈 QQQ 3배 인버스", "SSO": "프로셰어즈 S&P500 2배",
    "UPRO": "프로셰어즈 S&P500 3배", "SOXL": "디렉시온 반도체 3배", "SOXS": "디렉시온 반도체 3배 인버스", "SOXX": "아이셰어즈 반도체",
    "SMH": "반에크 반도체", "SCHD": "슈왑 미국 배당", "JEPI": "JP모간 에쿼티 프리미엄 인컴", "JEPQ": "JP모간 나스닥 프리미엄 인컴",
    "VTI": "뱅가드 토탈 스톡마켓", "VT": "뱅가드 토탈 월드", "DIA": "SPDR 다우존스", "IWM": "아이셰어즈 러셀2000", "GLD": "SPDR 금",
    "IAU": "아이셰어즈 금", "SLV": "아이셰어즈 은", "TLT": "아이셰어즈 미국채 20년", "TMF": "디렉시온 미국채 3배", "URA": "글로벌X 우라늄",
    "ARKK": "ARK 이노베이션", "QTUM": "디파이언스 퀀텀", "QCLN": "퍼스트트러스트 클린에너지", "ROBO": "로보 글로벌 로보틱스",
    "AIPO": "디파이언스 AI 전력 인프라", "NASA": "테마 우주 혁신", "IBIT": "아이셰어즈 비트코인", "BITO": "프로셰어즈 비트코인",
    "XLK": "기술 섹터 SPDR", "XLE": "에너지 섹터 SPDR", "XLF": "금융 섹터 SPDR", "XLV": "헬스케어 섹터 SPDR",
}
SKIP_WORDS = re.compile(r"\b(Warrant|Warrants|Right|Rights|Unit|Units|Preferred|Depositary Shares, each representing a 1/)\b", re.I)


def get(url, timeout=30):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except Exception:
            if i == 2:
                raise
            time.sleep(2 ** i)


def clean_us_name(n):
    n = re.sub(r"\s*-\s*(Common Stock|Class [A-C] Common Stock|Ordinary Shares|American Depositary Shares.*|Common Shares.*)$", "", n)
    n = re.sub(r"\s+(Common Stock|Class [A-C] Common Stock|Ordinary Shares)$", "", n)
    return n.strip()


def build_symbols(out):
    rows = []
    # 미국
    nas = get("https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt").decode("utf-8", "replace").splitlines()
    for line in nas[1:]:
        f = line.split("|")
        if len(f) < 8 or f[3] == "Y" or line.startswith("File Creation"):
            continue
        sym, name, etf = f[0], f[1], f[6] == "Y"
        if SKIP_WORDS.search(name):
            continue
        rows.append([sym, US_KO.get(sym, ""), clean_us_name(name), "US", 1 if etf else 0])
    oth = get("https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt").decode("utf-8", "replace").splitlines()
    for line in oth[1:]:
        f = line.split("|")
        if len(f) < 8 or f[6] == "Y" or line.startswith("File Creation"):
            continue
        sym, name, etf = f[0].replace(".", "-"), f[1], f[4] == "Y"
        if SKIP_WORDS.search(name) or "$" in sym:
            continue
        rows.append([sym, US_KO.get(sym, ""), clean_us_name(name), "US", 1 if etf else 0])
    # 한국 (코스피 = .KS, 코스닥 = .KQ)
    for market, suffix in (("KOSPI", ".KS"), ("KOSDAQ", ".KQ")):
        page = 1
        while True:
            d = json.loads(get(f"https://m.stock.naver.com/api/stocks/marketValue/{market}?page={page}&pageSize=100"))
            for s in d["stocks"]:
                rows.append([s["itemCode"] + suffix, s["stockName"], "", market, 1 if s.get("stockEndType") == "etf" else 0])
            if page * 100 >= d["totalCount"]:
                break
            page += 1
            time.sleep(0.2)
    us = sum(1 for r in rows if r[3] == "US")
    out.write_text(json.dumps({"updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                               "cols": ["symbol", "ko", "en", "market", "etf"], "rows": rows},
                              ensure_ascii=False, separators=(",", ":")))
    print(f"종목 목록: 미국 {us:,} · 한국 {len(rows) - us:,}")


def news_for(query, days=3, limit=3):
    q = urllib.parse.quote(f"{query} when:{days}d")
    xml = get(f"https://news.google.com/rss/search?q={q}&hl=ko&gl=KR&ceid=KR:ko")
    items = []
    for it in ET.fromstring(xml).iter("item"):
        title = it.findtext("title") or ""
        src = it.findtext("source") or ""
        if src and title.endswith(" - " + src):
            title = title[: -len(src) - 3]
        title = re.sub(r"\s+-\s+[^-]{1,20}$", "", title) if not src else title
        try:
            t = parsedate_to_datetime(it.findtext("pubDate")).astimezone(timezone.utc)
        except Exception:
            continue
        items.append({"title": title.strip(), "source": src, "link": it.findtext("link"), "time": t.strftime("%Y-%m-%dT%H:%M:%SZ")})
        if len(items) >= limit:
            break
    return items


def build_news(holdings, out):
    targets = [("시장", "나스닥 증시", None), ("시장", "코스피 증시", None)]
    seen = set()
    stocks = [it for g in holdings["groups"] for it in g["items"] if it.get("type") == "개별 종목" or it.get("news_q")]
    for it in sorted(stocks, key=lambda x: -x["value"]):
        if it["symbol"] in seen:
            continue
        seen.add(it["symbol"])
        targets.append((it["name"], it.get("news_q") or f'"{it["name"]}"', it["symbol"]))
    allnews, titles = [], set()
    for label, q, sym in targets:
        try:
            got = news_for(q, limit=2 if sym else 3)
        except Exception as e:
            print(f"[뉴스 실패] {label}: {e}", file=sys.stderr)
            continue
        for n in got:
            key = re.sub(r"\W", "", n["title"])[:40]
            if key in titles:
                continue
            titles.add(key)
            allnews.append({**n, "label": label, "symbol": sym})
        time.sleep(0.3)
    allnews.sort(key=lambda n: n["time"], reverse=True)
    out.write_text(json.dumps({"updated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), "items": allnews[:40]},
                              ensure_ascii=False, indent=1))
    print(f"뉴스: {len(allnews[:40])}건 (대상 {len(targets)}개)")


def main(holdings_path, out_dir, force_symbols=False):
    holdings = json.loads(Path(holdings_path).read_text())
    sym_path = out_dir / "symbols.json"
    fresh = False
    if sym_path.exists() and not force_symbols:
        upd = json.loads(sym_path.read_text()).get("updated", "2000-01-01")
        fresh = (datetime.now(timezone.utc) - datetime.fromisoformat(upd).replace(tzinfo=timezone.utc)).days < 7
    if not fresh:
        try:
            build_symbols(sym_path)
        except Exception as e:
            print(f"[종목 목록 실패] {e}", file=sys.stderr)
    try:
        build_news(holdings, out_dir / "news.json")
    except Exception as e:
        print(f"[뉴스 실패] {e}", file=sys.stderr)
