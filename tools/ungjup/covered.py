"""차트 페이지 '커버드콜 vs 본주' 데이터(data/ungjup/covered.json).

묶음(GROUPS)마다 본주와 커버드콜 ETF의 종가·분배금을 Yahoo에서 받아
가장 늦게 상장한 종목의 상장일부터 공통 거래일로 맞춰 저장합니다.
화면(assets/js/covered.js)이 기간을 골라 총수익(분배금 재투자)·주가 수익·분배금 몫을 계산합니다.

  - 종가는 분할만 반영된 실제 종가(배당 미반영), 분배금은 배당락일 기준 주당 금액
  - 총수익 지수: TR_t = TR_{t-1} × (종가_t + 분배금_t) / 종가_{t-1}  (세전, 배당락일 종가에 재투자)
  - dip: 위 차트의 진한 핑크 '줍줍 구간'(본주 지수 카드 zone 2 = 200일선 아래 + RSI 33 미만)인 날을
    공통 거래일 위치 [시작, 끝] 범위로. 화면의 '줍줍구간 배당 재매수' 계산에 씁니다.
    build.py가 이번 실행에서 먼저 쓴 data/ungjup/<asset>.json을 읽으므로 차트 음영과 같은 날입니다.

종목을 바꾸거나 묶음을 추가하려면 GROUPS만 고치세요. asset은 차트 위 지수 카드 id(build.py ASSETS)로,
그 카드를 고르면 이 묶음이 함께 열립니다.

사용법: python tools/ungjup/covered.py   (build.py가 배포 때 함께 실행)
"""
import json, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "ungjup" / "covered.json"
UA = {"User-Agent": "Mozilla/5.0"}

# items: (티커, 이름, 화면용 짧은 이름, 본주 여부)
GROUPS = [
    {"id": "k200", "name": "코스피200", "asset": "ks200", "unit": "₩", "items": [
        ("069500.KS", "KODEX 200", "KODEX 200", True),
        ("498400.KS", "KODEX 200타겟위클리커버드콜", "200타겟위클리", False),
    ]},
    {"id": "ndx", "name": "나스닥100", "asset": "qqq", "unit": "$", "items": [
        ("QQQ", "QQQ (나스닥100)", "QQQ", True),
        ("GPIQ", "GPIQ (골드만삭스 나스닥100 프리미엄인컴)", "GPIQ", False),
        ("JEPQ", "JEPQ (JP모간 나스닥 프리미엄인컴)", "JEPQ", False),
    ]},
    {"id": "spx", "name": "S&P500", "asset": "spy", "unit": "$", "items": [
        ("SPY", "SPY (S&P500)", "SPY", True),
        ("JEPI", "JEPI (JP모간 에쿼티 프리미엄인컴)", "JEPI", False),
    ]},
]


def fetch(symbol):
    """{날짜: 종가}, {날짜: 분배금} — 날짜는 거래소 현지 기준 YYYY-MM-DD."""
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/"
           f"{urllib.parse.quote(symbol)}?period1=0&period2=9999999999&interval=1d&events=div")
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                res = json.load(r)["chart"]["result"][0]
            break
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    off = res["meta"].get("gmtoffset", 0)
    day = lambda ts: datetime.fromtimestamp(ts + off, timezone.utc).strftime("%Y-%m-%d")
    closes = {}
    for ts, c in zip(res.get("timestamp") or [], res["indicators"]["quote"][0]["close"]):
        if c and c > 0:
            closes[day(ts)] = c
    divs = {}
    for ev in ((res.get("events") or {}).get("dividends") or {}).values():
        if ev.get("amount"):
            d = day(ev["date"])
            divs[d] = divs.get(d, 0) + ev["amount"]
    return closes, divs


def dip_runs(asset, dates):
    """본주 지수 카드의 줍줍 구간(zone 2)인 날 → 묶음 날짜 위치 [[시작, 끝], ...]. 데이터가 없으면 None."""
    try:
        rows = json.loads((OUT.parent / f"{asset}.json").read_text())["rows"]
        zone = dict(zip(rows["d"], rows["z"]))
    except Exception as e:
        print(f"[커버드콜] {asset} 줍줍 구간 없음: {e}", file=sys.stderr)
        return None
    if not any(d in zone for d in dates):
        return None
    runs, a = [], None
    for i, d in enumerate(dates):
        on = zone.get(d) == 2
        if on and a is None:
            a = i
        if not on and a is not None:
            runs.append([a, i - 1]); a = None
    if a is not None:
        runs.append([a, len(dates) - 1])
    return runs


def build_group(g):
    raw = {}
    for sym, *_ in g["items"]:
        closes, divs = fetch(sym)
        if len(closes) < 2:
            raise ValueError(f"{sym} 종가 없음")
        raw[sym] = (closes, divs)
    listed = {s: min(c) for s, (c, _) in raw.items()}
    start = max(listed.values())
    dates = sorted(set.intersection(*(set(d for d in c if d >= start) for c, _ in raw.values())))
    if len(dates) < 2:
        raise ValueError("공통 거래일 부족")
    nd = 0 if g["unit"] == "₩" else 2
    items = []
    for sym, name, short, base in g["items"]:
        closes, divs = raw[sym]
        # 배당락일이 공통 거래일에 없으면 그 다음 공통 거래일에 붙임 (시작일 이전 분배금은 버림)
        dv = {}
        j = 0
        for d in sorted(divs):
            if d <= dates[0]:
                continue
            while j < len(dates) and dates[j] < d:
                j += 1
            if j < len(dates):
                dv[j] = dv.get(j, 0) + divs[d]
        items.append({
            "symbol": sym, "name": name, "short": short, "base": base, "listed": listed[sym],
            "c": [round(closes[d], nd) if nd else round(closes[d]) for d in dates],
            "dv": [[i, round(a, 4)] for i, a in sorted(dv.items())],
        })
    out = {"id": g["id"], "name": g["name"], "asset": g["asset"], "unit": g["unit"],
           "start": dates[0], "d": dates, "items": items}
    dip = dip_runs(g["asset"], dates)
    if dip is not None:
        out["dip"] = dip
    return out


def main():
    old = {}
    if OUT.exists():
        try:
            old = {g["id"]: g for g in json.loads(OUT.read_text())["groups"]}
        except Exception:
            old = {}
    groups = []
    for g in GROUPS:
        try:
            out = build_group(g)
            groups.append(out)
            last = {it["short"]: it["c"][-1] for it in out["items"]}
            dip = f"줍줍구간 {len(out['dip'])}번" if "dip" in out else "줍줍구간 데이터 없음"
            print(f"커버드콜 {g['name']:6s} {out['start']} ~ {out['d'][-1]}  {last}  {dip}")
        except Exception as e:  # 실패한 묶음은 지난 데이터 유지
            print(f"[커버드콜 실패] {g['name']}: {e}", file=sys.stderr)
            if g["id"] in old:
                groups.append(old[g["id"]])
    if not groups:
        sys.exit(1)
    OUT.write_text(json.dumps({"updated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
                               "groups": groups}, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
