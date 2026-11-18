"""웅줍 지표 데이터 생성기.

Yahoo Finance 일봉을 받아 자산마다 다음을 계산해 data/ungjup/<id>.json 으로 저장합니다.
  - 20일/200일 이동평균, RSI(14, Wilder)
  - 웅줍라인 = min(200일선, 다음 종가가 RSI 33이 되는 가격)
  - 음영 단계: 0 없음 / 1 (200일선 아래 또는 RSI<33) / 2 (둘 다 = 웅줍 구간)
  - 웅줍LV(1~100): 하락장 고점=LV1, 바닥=LV100이 되도록 자산별로 보정한 실시간 산식

사용법
  python tools/ungjup/build.py          # 저장된 계수(coefs.json)로 데이터만 갱신
  python tools/ungjup/build.py --fit    # 하락장 기준으로 계수를 다시 보정한 뒤 갱신
"""
import argparse, json, math, sys, time, urllib.request
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
    {"id": "ndx",   "symbol": "^NDX",      "name": "나스닥100",  "desc": "미국 기술주 대표 지수",       "min_dd": 0.10, "year": 252, "unit": ""},
    {"id": "spy",   "symbol": "SPY",       "name": "SPY",       "desc": "S&P500 추종 ETF",            "min_dd": 0.10, "year": 252, "unit": "$"},
    {"id": "qld",   "symbol": "QLD",       "name": "QLD",       "desc": "나스닥100 2배 레버리지 ETF",  "min_dd": 0.20, "year": 252, "unit": "$"},
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
    return df[~df.index.duplicated(keep="last")]


def indicators(df, year):
    c = df["close"]
    df["sma20"] = c.rolling(20).mean()
    df["sma200"] = c.rolling(200).mean()
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


def features(df):
    return np.c_[np.ones(len(df)), np.sqrt(df["dd52"].clip(lower=0)), df["gap200"], df["rsi"]]


def fit(df, eps):
    """하락장 고점→바닥 구간의 사후 레벨(1~100)을 실시간 지표로 근사 + 바닥 중앙값이 100이 되도록 눈금 보정."""
    X, y, w, bottoms = [], [], [], []
    cv = df["close"].values
    for e in eps:
        if not e["done"]:
            continue
        sl = slice(e["peak"], e["bottom"] + 1)
        part = df.iloc[sl]
        ok = part[["dd52", "gap200", "rsi"]].notna().all(axis=1).values
        if ok.sum() < 3:
            continue
        lv = 1 + 99 * (1 - cv[sl] / cv[e["peak"]]) / e["mdd"]
        X.append(features(part[ok])); y.append(lv[ok]); w.append(np.full(ok.sum(), 1 / ok.sum()))
        bottoms.append(e["bottom"])
    X, y, w = np.vstack(X), np.concatenate(y), np.concatenate(w)
    sw = np.sqrt(w)[:, None]
    b = np.linalg.lstsq(X * sw, y * sw[:, 0], rcond=None)[0]
    raw_bottom = np.clip(features(df.iloc[bottoms]) @ b, 1, 100)
    q = float(np.median(raw_bottom))
    k = 99 / (q - 1)
    b = b * k
    b[0] += 1 - k
    return [round(float(v), 3) for v in b]


def apply_lv(df, coef):
    return np.clip(features(df) @ np.array(coef), 1, 100)


def stats(df, eps, year):
    c = df["close"]
    fw = c.shift(-year) / c - 1
    lv = df["lv"]
    rows = []
    for lo, hi in [(1, 40), (40, 80), (80, 95), (95, 101)]:
        m = (lv >= lo) & (lv < hi) & fw.notna()
        if m.sum() < 20:
            rows.append({"range": f"{lo}~{min(hi, 100)}", "days": int(m.sum())}); continue
        rows.append({"range": f"{lo}~{min(hi, 100)}", "days": int(m.sum()),
                     "fwd1y_median": round(float(fw[m].median()), 4),
                     "fwd1y_up": round(float((fw[m] > 0).mean()), 3)})
    done = [e for e in eps if e["done"]]
    bl = [df["lv"].iloc[e["bottom"]] for e in done if not math.isnan(df["lv"].iloc[e["bottom"]])]
    return {"episodes": len(done), "bottom_lv_median": round(float(np.median(bl)), 1) if bl else None,
            "bottom_lv90_share": round(float(np.mean(np.array(bl) >= 90)), 3) if bl else None,
            "by_level": rows}


def r(v, nd):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) else round(float(v), nd)


def build(asset, coefs, do_fit):
    df = indicators(fetch(asset["symbol"]), asset["year"])
    eps = episodes(df["close"], asset["min_dd"])
    if do_fit or asset["id"] not in coefs:
        coefs[asset["id"]] = fit(df, eps)
    coef = coefs[asset["id"]]
    df["lv"] = np.nan
    ok = df[["dd52", "gap200", "rsi"]].notna().all(axis=1)
    df.loc[ok, "lv"] = apply_lv(df[ok], coef)

    # 사후 정답 레벨 (완료된 하락장만)
    truth = np.full(len(df), np.nan)
    cv = df["close"].values
    for e in eps:
        if e["done"]:
            sl = slice(e["peak"], e["bottom"] + 1)
            truth[sl] = 1 + 99 * (1 - cv[sl] / cv[e["peak"]]) / e["mdd"]
    df["truth"] = truth

    # 가격 자릿수: 값 크기에 맞춰 반올림 (파일 크기 절약)
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
        "lv": [r(v, 0) for v in out["lv"]],
        "tr": [r(v, 0) for v in out["truth"]],
        "z": [int(v) for v in out["zone"]],
    }
    lt = df.iloc[-1]
    meta = {k: asset[k] for k in ("id", "symbol", "name", "desc", "unit", "min_dd")}
    meta.update({
        "coef": coef,
        "last": {"date": df.index[-1].strftime("%Y-%m-%d"), "close": r(lt.close, 2), "sma20": r(lt.sma20, 2),
                 "sma200": r(lt.sma200, 2), "rsi": r(lt.rsi, 1), "ujline": r(lt.ujline, 2),
                 "lv": r(lt.lv, 0), "zone": int(lt.zone), "dd52": r(lt.dd52, 4), "gap200": r(lt.gap200, 4)},
        "stats": stats(df, eps, asset["year"]),
        "bottoms": [df.index[e["bottom"]].strftime("%Y-%m-%d") for e in eps if e["done"]],
    })
    return meta, rec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fit", action="store_true", help="계수를 다시 보정")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    cpath = OUT / "coefs.json"
    coefs = json.loads(cpath.read_text()) if cpath.exists() else {}
    index, failed = [], []
    for a in ASSETS:
        try:
            meta, rec = build(a, coefs, args.fit)
        except Exception as e:
            print(f"[실패] {a['symbol']}: {e}", file=sys.stderr)
            failed.append(a["id"])
            continue
        (OUT / f"{a['id']}.json").write_text(json.dumps({"meta": meta, "rows": rec}, ensure_ascii=False, separators=(",", ":")))
        index.append(meta)
        L = meta["last"]
        print(f"{a['name']:8s} {L['date']} 종가 {L['close']:>12,.2f}  RSI {L['rsi']:5.1f}  음영 {L['zone']}  웅줍LV {L['lv']:>3.0f}  "
              f"하락장 {meta['stats']['episodes']}개  바닥LV중앙값 {meta['stats']['bottom_lv_median']}")
    if failed and len(failed) == len(ASSETS):
        sys.exit(1)
    cpath.write_text(json.dumps(coefs, indent=2))
    # 실패한 자산은 기존 index 항목 유지
    ipath = OUT / "index.json"
    if failed and ipath.exists():
        old = {m["id"]: m for m in json.loads(ipath.read_text())["assets"]}
        index += [old[i] for i in failed if i in old]
        order = [a["id"] for a in ASSETS]
        index.sort(key=lambda m: order.index(m["id"]))
    ipath.write_text(json.dumps({"updated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
                                 "assets": index}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    import urllib.parse  # noqa: E402
    main()
