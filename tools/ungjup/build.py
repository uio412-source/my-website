"""줍줍 지표 데이터 생성기.

Yahoo Finance 일봉을 받아 자산마다 다음을 계산해 data/ungjup/<id>.json 으로 저장합니다.
  - 20일/200일 이동평균, RSI(14, Wilder)
  - 줍줍라인 = min(200일선, 다음 종가가 RSI 33이 되는 가격)
  - 음영 단계: 0 없음 / 1 (200일선 아래 또는 RSI<33) / 2 (둘 다 = 줍줍 구간)
  - 줍줍LV(1~1000, v2): "지금의 하락 스트레스가 전체 자산 과거 모든 날 중 몇 번째인가"
      1) 세 지표를 자산의 평소 변동성(연율)으로 나눠 자산 간 비교가 되게 함
           깊이 = 52주 고점 대비 하락률 / 변동성
           이격 = 200일선 아래로 벌어진 정도 / 변동성 (위에 있으면 0)
           과매도 = max(0, 50 − RSI)
      2) 각 지표를 전 자산·전 기간 공통 백분위로 바꿔 0.5·깊이 + 0.3·이격 + 0.2·과매도 로 합침
      3) 3일 지수평활 후, 그 점수의 공통 백분위 × 999 + 1 = 줍줍LV
         → LV 900 = 과거 전체에서 상위 10% 하락 스트레스, LV 500 = 중간

사용법
  python tools/ungjup/build.py          # 저장된 기준표(lv_model.json)로 데이터만 갱신
  python tools/ungjup/build.py --fit    # 모든 자산 이력으로 기준표·변동성을 다시 만든 뒤 갱신
"""
import argparse, json, math, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "ungjup"

RSI_N, RSI_T = 14, 33

# min_dd: 하락장으로 볼 최소 하락폭, 바닥 대비 2배(min_dd*2) 반등하면 하락장 종료
# year: 52주에 해당하는 봉 수 (비트코인은 주말에도 거래)
ASSETS = [
    {"id": "qqq",   "symbol": "QQQ",       "name": "QQQ",       "desc": "나스닥100 추종 ETF",          "min_dd": 0.10, "year": 252, "unit": "$"},
    {"id": "spy",   "symbol": "SPY",       "name": "SPY",       "desc": "S&P500 추종 ETF",            "min_dd": 0.10, "year": 252, "unit": "$"},
    {"id": "gld",   "symbol": "GLD",       "name": "GLD",       "desc": "금 현물 ETF",                "min_dd": 0.10, "year": 252, "unit": "$"},
    {"id": "ks200", "symbol": "069500.KS", "name": "코스피200",  "desc": "KODEX 200 ETF 기준",         "min_dd": 0.10, "year": 252, "unit": "₩"},
    {"id": "btc",   "symbol": "BTC-USD",   "name": "비트코인",   "desc": "BTC/USD",                    "min_dd": 0.25, "year": 365, "unit": "$"},
]


def fetch(symbol):
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/"
           f"{urllib.parse.quote(symbol)}?period1=0&period2=9999999999&interval=1d")
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                res = json.load(r)["chart"]["result"][0]
            break
        except Exception as e:  # 네트워크 일시 오류 재시도
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    q = res["indicators"]["quote"][0]
    df = pd.DataFrame({"close": q["close"]},
                      index=pd.to_datetime(res["timestamp"], unit="s") + pd.Timedelta(seconds=res["meta"].get("gmtoffset", 0)))
    df.index = df.index.normalize()
    df = df.dropna()
    df = df[df["close"] > 0]
    return df[~df.index.duplicated(keep="last")].sort_index()


def indicators(df, year, sma_min=200):
    """sma_min < 200 이면 상장 직후처럼 이력이 짧을 때 있는 기간만으로 200일선을 근사."""
    c = df["close"]
    df["sma20"] = c.rolling(20).mean()
    df["sma200"] = c.rolling(200, min_periods=sma_min).mean()
    d = c.diff()
    ag = d.clip(lower=0).ewm(alpha=1 / RSI_N, adjust=False, min_periods=RSI_N).mean()
    al = (-d).clip(lower=0).ewm(alpha=1 / RSI_N, adjust=False, min_periods=RSI_N).mean()
    df["rsi"] = 100 - 100 / (1 + ag / al)
    # 다음 종가가 얼마면 RSI가 정확히 33이 되는지 (전일 평균 상승/하락폭으로 역산)
    k = RSI_T / (100 - RSI_T)
    pag, pal, pc = ag.shift(1), al.shift(1), c.shift(1)
    down = (RSI_N - 1) * (pag / k - pal)
    up = (RSI_N - 1) * (pal * k - pag)
    df["rsi33"] = np.where(down > 0, pc - down, pc + up)
    df["ujline"] = np.minimum(df["sma200"], df["rsi33"])
    df["zone"] = (c < df["sma200"]).astype(int) + (df["rsi"] < RSI_T).astype(int)
    df["dd52"] = 1 - c / c.rolling(year, min_periods=20).max()
    df["gap200"] = c / df["sma200"] - 1
    return df


def episodes(close, min_dd):
    """스윙 고점 대비 min_dd 이상 하락한 구간. 바닥 대비 2*min_dd 반등 또는 고점 회복 시 종료."""
    up = 2 * min_dd
    cv = close.values
    n = len(cv)
    eps, p, i = [], 0, 1
    while i < n:
        if cv[i] >= cv[p]:
            p = i; i += 1; continue
        t = j = i
        while j < n:
            if cv[j] < cv[t]:
                t = j
            if cv[j] >= cv[p] or cv[j] >= cv[t] * (1 + up):
                break
            j += 1
        mdd = 1 - cv[t] / cv[p]
        done = j < n
        if mdd >= min_dd:
            eps.append({"peak": p, "bottom": t, "mdd": mdd, "done": done})
        if not done:
            break
        p, i = j, j + 1
    return eps


# ---------- 줍줍LV v2 ----------
WEIGHTS = {"depth": 0.5, "below": 0.3, "rsilow": 0.2}
SMOOTH_SPAN = 3
GRID = np.linspace(0, 1, 1001)
MODEL = OUT / "lv_model.json"


def long_vol(df, year):
    """평소 변동성: 1년 이동 변동성(연율)의 전체 기간 중앙값. 폭락기 변동성 급등에 휘둘리지 않게."""
    lr = np.log(df["close"]).diff()
    return float((lr.rolling(year, min_periods=60).std() * np.sqrt(year)).median())


def raw_features(df, vol):
    return pd.DataFrame({
        "depth": df["dd52"] / vol,
        "below": (-df["gap200"]).clip(lower=0) / vol,
        "rsilow": (50 - df["rsi"]).clip(lower=0),
    }, index=df.index)


def pct(x, table):
    return np.interp(x, table, GRID)


def score(feat, model):
    s = sum(w * pct(feat[k].values, np.array(model["tables"][k])) for k, w in model["weights"].items())
    return pd.Series(s, index=feat.index).ewm(span=model["smooth_span"], adjust=False).mean()


def lv_series(df, vol, model):
    feat = raw_features(df, vol)
    ok = feat.notna().all(axis=1)
    out = pd.Series(np.nan, index=df.index)
    if ok.any():
        s = score(feat[ok], model)
        out[ok] = 1 + 999 * pct(s.values, np.array(model["tables"]["score"]))
    return out


def fit_model(series):
    """series: {symbol: (df, vol)} → 전 자산 공통 백분위 기준표."""
    feats = pd.concat([raw_features(df, v) for df, v in series.values()]).dropna()
    tables = {k: np.quantile(feats[k].values, GRID).tolist() for k in WEIGHTS}
    model = {"version": 2, "weights": WEIGHTS, "smooth_span": SMOOTH_SPAN, "tables": tables}
    scores = []
    for df, v in series.values():
        f = raw_features(df, v).dropna()
        if len(f):
            scores.append(score(f, model).values)
    model["tables"]["score"] = np.quantile(np.concatenate(scores), GRID).tolist()
    model["vol"] = {s: round(v, 4) for s, (_, v) in series.items()}
    return model


def stats(df, eps, year):
    c = df["close"]
    fw = c.shift(-year) / c - 1
    lv = df["lv"]
    rows = []
    for lo, hi in LV_BANDS:
        m = (lv >= lo) & (lv < hi) & fw.notna()
        row = {"lo": lo, "hi": min(hi, 1000), "days": int(m.sum())}
        if m.sum() >= 20:
            row.update({"fwd1y_median": round(float(fw[m].median()), 4), "fwd1y_up": round(float((fw[m] > 0).mean()), 3)})
        rows.append(row)
    done = [e for e in eps if e["done"]]
    bl = [lv.iloc[e["bottom"]] for e in done if not math.isnan(lv.iloc[e["bottom"]])]
    return {"episodes": len(done), "bottom_lv_median": round(float(np.median(bl)), 1) if bl else None,
            "by_level": rows}


LV_BANDS = [(1, 400), (400, 700), (700, 900), (900, 1001)]


def r(v, nd):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) else round(float(v), nd)


def daily_change(df):
    close = df["close"]
    return r(close.iloc[-1] / close.iloc[-2] - 1, 6) if len(close) >= 2 else None


def index_json(asset, df, eps):
    last = df["close"].iloc[-1]
    nd = 0 if last >= 1000 else 2
    out = df.dropna(subset=["sma20"])
    rec = {
        "d": [x.strftime("%Y-%m-%d") for x in out.index],
        "c": [r(v, nd) for v in out["close"]],
        "s20": [r(v, nd) for v in out["sma20"]],
        "s200": [r(v, nd) for v in out["sma200"]],
        "uj": [r(v, nd) for v in out["ujline"]],
        "rsi": [r(v, 1) for v in out["rsi"]],
        "lv": [None if math.isnan(v) else int(round(v)) for v in out["lv"]],
        "z": [int(v) for v in out["zone"]],
    }
    lt = df.iloc[-1]
    meta = {k: asset[k] for k in ("id", "symbol", "name", "desc", "unit")}
    meta.update({
        "last": {"date": df.index[-1].strftime("%Y-%m-%d"), "close": r(lt.close, 2), "change": daily_change(df), "sma20": r(lt.sma20, 2),
                 "sma200": r(lt.sma200, 2), "rsi": r(lt.rsi, 1), "ujline": r(lt.ujline, 2),
                 "lv": None if math.isnan(lt.lv) else int(round(lt.lv)), "zone": int(lt.zone),
                 "dd52": r(lt.dd52, 4), "gap200": r(lt.gap200, 4)},
        "stats": stats(df, eps, asset["year"]),
    })
    return meta, rec


WATCHLIST = ROOT / "data" / "watchlist.json"


def watch_symbols():
    groups = json.loads(WATCHLIST.read_text())["groups"]
    return list(dict.fromkeys(item["symbol"] for group in groups for item in group["items"]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fit", action="store_true", help="기준표·변동성을 다시 만듦")
    ap.add_argument("--symbols", action="store_true", help="종목 검색 목록을 7일이 안 됐어도 새로 받음")
    ap.add_argument("--dividends", action="store_true", help="배당 데이터를 20시간이 안 됐어도 새로 받음")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)

    # 1) 모든 자산(지수 + 관심종목) 받아서 지표 계산
    plan = {a["symbol"]: {"year": a["year"], "asset": a} for a in ASSETS}
    symbols = watch_symbols()
    for s in symbols:
        plan.setdefault(s, {"year": 365 if s.endswith("-USD") else 252, "asset": None})
    model = json.loads(MODEL.read_text()) if MODEL.exists() else None
    series, failed = {}, []
    for s, p in plan.items():
        try:
            raw = fetch(s)
            if raw.empty:
                raise ValueError("거래일 데이터 없음")
        except Exception as e:
            print(f"[실패] {s}: {e}", file=sys.stderr)
            failed.append(s)
            continue
        p["short"] = len(raw) < 200
        df = indicators(raw, p["year"], sma_min=60 if p["short"] else 200)
        vol = (model or {}).get("vol", {}).get(s) if not args.fit else None
        series[s] = (df, vol or long_vol(df, p["year"]))
    if not series:
        sys.exit(1)

    # 2) 기준표 (처음이거나 --fit 일 때만 새로 만듦)
    if model is None or args.fit:
        model = fit_model(series)
    for s, (df, v) in series.items():
        model["vol"].setdefault(s, round(v, 4))
    MODEL.write_text(json.dumps(model, separators=(",", ":")))

    for s, (df, v) in series.items():
        df["lv"] = lv_series(df, v, model)

    # 3) 지수 데이터
    index = []
    for a in ASSETS:
        if a["symbol"] not in series:
            continue
        df, _ = series[a["symbol"]]
        meta, rec = index_json(a, df, episodes(df["close"], a["min_dd"]))
        (OUT / f"{a['id']}.json").write_text(json.dumps({"meta": meta, "rows": rec}, ensure_ascii=False, separators=(",", ":")))
        index.append(meta)
        L = meta["last"]
        print(f"{a['name']:8s} {L['date']} 종가 {L['close']:>12,.2f}  RSI {L['rsi']:5.1f}  음영 {L['zone']}  줍줍LV {L['lv']:>4}  "
              f"바닥일LV중앙값 {meta['stats']['bottom_lv_median']}")
    ipath = OUT / "index.json"
    if ipath.exists():  # 실패한 지수는 기존 값 유지
        old = {m["id"]: m for m in json.loads(ipath.read_text())["assets"]}
        have = {m["id"] for m in index}
        index += [old[a["id"]] for a in ASSETS if a["id"] not in have and a["id"] in old]
        order = [a["id"] for a in ASSETS]
        index.sort(key=lambda m: order.index(m["id"]))
    ipath.write_text(json.dumps({"updated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
                                 "assets": index}, ensure_ascii=False, indent=1))

    # 4) 관심종목 시세와 줍줍LV
    hpath = OUT / "holdings_lv.json"
    old = json.loads(hpath.read_text()) if hpath.exists() else {}
    previous = old.get("items", {})
    items = {s: previous[s] for s in symbols if s in previous}
    print("관심종목")
    updated = old.get("updated")
    for s in symbols:
        if s not in series:
            continue
        df, _ = series[s]
        lt = df.iloc[-1]
        date = df.index[-1].strftime("%Y-%m-%d")
        if date < items.get(s, {}).get("date", ""):
            continue
        items[s] = {"date": date, "close": r(lt.close, 2),
                    "change": daily_change(df), "rsi": r(lt.rsi, 1),
                    "lv": None if math.isnan(lt.lv) else int(round(lt.lv)), "zone": int(lt.zone),
                    "dd52": r(lt.dd52, 4), "gap200": r(lt.gap200, 4), "short": plan[s]["short"]}
        print(f"  {s:10s} LV {items[s]['lv'] if items[s]['lv'] is not None else '-':>4}  음영 {items[s]['zone']}"
              f"{'  짧은이력' if plan[s]['short'] else ''}")
        updated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    hpath.write_text(json.dumps({"updated": updated, "items": items}, ensure_ascii=False, indent=1))

    # 5) 종목 검색 목록과 관심종목 뉴스
    sys.path.insert(0, str(Path(__file__).parent))
    import extras
    extras.main(WATCHLIST, OUT, force_symbols=args.symbols)

    # 6) 배당 페이지용 종목별 주당 배당금
    import dividends
    try:
        dividends.main(force=args.dividends)
    except Exception as e:
        print(f"[배당 실패] {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
