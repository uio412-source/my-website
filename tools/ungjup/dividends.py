"""배당 페이지용 데이터: 종목별 최근 12개월 주당 배당금(data/ungjup/dividends.json).

브라우저는 Yahoo를 직접 부를 수 없어서(CORS) 배포 때 미리 계산해 둡니다.
모든 종목(약 1만6천 개)을 매번 받을 수는 없으므로 아래 '배당 유니버스'만 계산합니다.
  - 관심종목(data/watchlist.json) 전부
  - data/dividend_extra.json 에 적은 티커 (배당 페이지에서 자주 쓰는 종목을 여기에 추가)
  - 국내: 코스피 시가총액 상위 200 + 코스닥 상위 40 + 이름에 배당·커버드콜·인컴·리츠 등이 들어간 ETF
  - 미국: 아래 US_DIV 목록 (대표 배당주·배당 ETF)
목록에 없는 종목은 배당 페이지에서 주당 배당금을 직접 입력할 수 있습니다.

주당 배당금(dps) = 최근 365일 동안 배당락일이 있었던 배당금 합계.
상장 1년이 안 된 종목은 평균 배당금 × 지급 주기(월 12·분기 4·반기 2·연 1)로 연환산합니다.
하루에 한 번만 새로 받습니다(20시간 이내면 건너뜀). --dividends 로 강제 갱신.
"""
import json, re, statistics, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "ungjup" / "dividends.json"
UA = {"User-Agent": "Mozilla/5.0"}

US_DIV = """
SCHD VYM VIG DGRO HDV SPYD NOBL DVY SDY JEPI JEPQ QYLD XYLD RYLD DIVO SPY VOO IVV QQQ QQQM VTI VT VXUS
TLT IEF SHY BND AGG LQD HYG GLD SLV VNQ O STAG MAIN ARCC
AAPL MSFT NVDA AVGO GOOGL META AMZN JPM BAC WFC C GS MS BLK SPGI V MA BX
KO PEP PG JNJ ABBV MRK PFE LLY UNH AMGN BMY GILD CVS MO PM T VZ CMCSA
XOM CVX COP EOG OXY NEE DUK SO D AEP EXC SRE
HD LOW MCD SBUX TGT WMT COST NKE
CAT DE MMM HON LMT RTX GD UPS UNP ADP ITW EMR
IBM CSCO TXN QCOM INTC ORCL ADI KLAC
BRK-B BTI ENB TSM
""".split()
KR_ETF_PAT = re.compile(r"배당|커버드콜|인컴|리츠|REIT|월지급|프리미엄|타겟|채권혼합")


def universe():
    syms = []
    add = lambda s: s and s not in syms and syms.append(s)
    wl = ROOT / "data" / "watchlist.json"
    if wl.exists():
        for g in json.loads(wl.read_text())["groups"]:
            for it in g["items"]:
                add(it.get("symbol"))
    extra = ROOT / "data" / "dividend_extra.json"
    if extra.exists():
        for s in json.loads(extra.read_text()):
            add(s)
    sp = ROOT / "data" / "ungjup" / "symbols.json"
    if sp.exists():
        rows = json.loads(sp.read_text())["rows"]
        kospi = [r for r in rows if r[3] == "KOSPI" and not r[4]][:200]
        kosdaq = [r for r in rows if r[3] == "KOSDAQ" and not r[4]][:40]
        etfs = [r for r in rows if r[3] != "US" and r[4] and KR_ETF_PAT.search(r[1] or "")]
        for r in kospi + kosdaq + etfs:
            add(r[0])
    for s in US_DIV:
        add(s)
    return syms


def get(url):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
                return json.load(r)
        except Exception:
            if i == 2:
                raise
            time.sleep(1.5 * (i + 1))


def one(symbol):
    d = get("https://query1.finance.yahoo.com/v8/finance/chart/"
            f"{urllib.parse.quote(symbol)}?range=2y&interval=1mo&events=div")["chart"]["result"][0]
    meta = d["meta"]
    price = meta.get("regularMarketPrice")
    if not price:
        return None
    divs = sorted((v["date"], float(v["amount"])) for v in (d.get("events") or {}).get("dividends", {}).values())
    now = time.time()
    ttm = [(t, a) for t, a in divs if t > now - 365 * 86400]
    first = divs[0][0] if divs else None
    freq_n = len(ttm)
    if divs and first > now - 365 * 86400 and len(divs) >= 2:
        # 상장 1년 미만: 지급 간격으로 주기를 추정해 연환산
        gap = statistics.median(b[0] - a[0] for a, b in zip(divs, divs[1:])) / 86400
        per_year = 12 if gap < 45 else 4 if gap < 120 else 2 if gap < 240 else 1
        dps = statistics.mean(a for _, a in divs) * per_year
        freq_n = per_year
    elif divs and first > now - 365 * 86400:
        dps, freq_n = divs[0][1], 1
    else:
        dps = sum(a for _, a in ttm)
    freq = "월" if freq_n >= 10 else "분기" if freq_n >= 3 else "반기" if freq_n == 2 else "연" if freq_n == 1 else ""
    # 월별 배당 (배당락 월 기준, 최근 12개월)
    months = {}
    for t, a in ttm:
        m = datetime.fromtimestamp(t, timezone.utc).month
        months[m] = round(months.get(m, 0) + a, 6)
    last = divs[-1] if divs else None
    return {
        "cur": meta.get("currency") or ("KRW" if symbol.endswith((".KS", ".KQ")) else "USD"),
        "price": round(float(price), 4),
        "dps": round(dps, 6),
        "freq": freq,
        "months": [[m, a] for m, a in sorted(months.items())],
        "last": [datetime.fromtimestamp(last[0], timezone.utc).strftime("%Y-%m-%d"), round(last[1], 6)] if last else None,
    }


def main(force=False):
    if OUT.exists() and not force:
        upd = json.loads(OUT.read_text()).get("updated", "")
        try:
            age = (datetime.now(timezone.utc) - datetime.strptime(upd, "%Y-%m-%d %H:%M UTC").replace(tzinfo=timezone.utc)).total_seconds()
            if age < 20 * 3600:
                print(f"배당: {upd} 데이터가 최신이라 건너뜀")
                return
        except ValueError:
            pass
    syms = universe()
    old = json.loads(OUT.read_text())["items"] if OUT.exists() else {}
    items, failed = {}, 0

    def work(s):
        try:
            return s, one(s)
        except Exception:
            return s, "fail"

    with ThreadPoolExecutor(max_workers=6) as ex:
        for s, r in ex.map(work, syms):
            if r == "fail":
                failed += 1
                if s in old:
                    items[s] = old[s]  # 실패하면 예전 값 유지
            elif r:
                items[s] = r
    try:
        fx = get("https://query1.finance.yahoo.com/v8/finance/chart/KRW%3DX?range=5d&interval=1d")["chart"]["result"][0]["meta"]["regularMarketPrice"]
    except Exception:
        fx = json.loads(OUT.read_text()).get("fx", {}).get("USDKRW") if OUT.exists() else None
    payers = sum(1 for v in items.values() if v["dps"] > 0)
    OUT.write_text(json.dumps({"updated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
                               "fx": {"USDKRW": round(float(fx), 2) if fx else None},
                               "items": items}, ensure_ascii=False, separators=(",", ":")))
    print(f"배당: {len(items)}종목 (배당 있음 {payers}, 실패 {failed}) · USD/KRW {fx}")


if __name__ == "__main__":
    main(force="--force" in sys.argv)
