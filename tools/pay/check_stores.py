"""Mr. Pay — pay/brands.json의 매장·시장·브랜드가 온누리 가맹점 DB(pay/data/onnuri/)와 어떻게 맞는지 확인

화면(assets/js/pay.js의 makeMatcher)과 같은 규칙:
  store(매장 하나): 같은 시도 + 상호가 같거나(짧은 쪽 3자 이상이면 서로 포함)
                    + sgg가 주소·시장 위치에 있거나 시장 이름이 맞음(둘 다 없으면 상호만)
  market(시장·상점가): 같은 시도 + 소속 시장 이름에 들어 있음 + 디지털 가맹(얼굴결제는 온누리 카드형만)
  brand(프랜차이즈): 상호에 브랜드 이름·별칭(영문은 단어 경계)
  place(장소)·match:false는 맞추지 않음

사용: python tools/pay/check_stores.py   (build.py로 pay/data/onnuri/를 만든 뒤, 항상 0으로 끝남)
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "pay" / "data" / "onnuri"
BRANDS = ROOT / "pay" / "brands.json"


def norm(s: str) -> str:
    s = re.sub(r"\(주\)|㈜|주식회사|\(유\)|유한회사", "", s or "")
    return re.sub(r"[\s\-_·.,'\"()\[\]{}&/+~!@#*]+", "", s).lower()


def same_name(nn: str, key: str) -> bool:
    return nn == key or (min(len(nn), len(key)) >= 3 and (key in nn or nn in key))


def load_rows(sid: str) -> list[dict]:
    d = json.loads((DATA / f"{sid}.json").read_text(encoding="utf-8"))
    mk = [dict(zip(d["mcols"], r)) for r in d["markets"]]
    out = []
    for r in d["rows"]:
        s = dict(zip(d["cols"], r))
        m = mk[s["m"]] if 0 <= s["m"] < len(mk) else {}
        s["market"] = m.get("name") or ""
        s["sgg"] = m.get("sgg") or "위치 모름"
        s["short"] = s.get("addr") or (f"{m.get('sgg')} {m.get('dong') or ''} 일대".strip() if m.get("sgg") else "")
        out.append(s)
    return out


def matches(e: dict, s: dict, sido: dict) -> bool:
    kind = e.get("kind") or "brand"
    if kind != "brand" and e.get("sido") and e["sido"] not in (sido["name"], sido["id"]):
        return False
    names = [n for n in [e.get("name"), *(e.get("aliases") or [])] if n]
    nn, lo, mk = norm(s["name"]), str(s["name"]).lower(), norm(s["market"])
    if kind == "brand":
        for n in names:
            if re.fullmatch(r"[\x20-\x7e]+", n):
                if re.search(r"(^|[^a-z0-9])" + re.escape(n.lower()) + r"($|[^a-z0-9])", lo):
                    return True
            elif norm(n) and norm(n) in nn:
                return True
        return False
    if kind == "store":
        if not any(norm(n) and same_name(nn, norm(n)) for n in names):
            return False
        sgg, market = norm(e.get("sgg")), norm(e.get("market"))
        if not sgg and not market:
            return True
        where = norm(" ".join([s["sgg"], s.get("addr") or "", s["short"]]))
        return bool((sgg and sgg in where) or (market and market in mk))
    if kind == "market":
        keys = [norm(e.get("market"))] if e.get("market") else []
        keys += [norm(n) for n in names]
        return bool(s.get("digital")) and bool(mk) and any(len(k) >= 2 and k in mk for k in keys)
    return False


def fmt(s: dict) -> str:
    kind = "/".join(k for k, v in (("지류", s.get("paper")), ("디지털", s.get("digital"))) if v) or "-"
    return f"{s['name']} · {s['market'] or '-'} · {s['short'] or '-'} · {kind}"


def main() -> int:
    if not (DATA / "meta.json").exists():
        print("[stores] pay/data/onnuri/meta.json 없음 — build.py를 먼저 돌리세요")
        return 0
    meta = json.loads((DATA / "meta.json").read_text(encoding="utf-8"))
    entries = [e for e in json.loads(BRANDS.read_text(encoding="utf-8")).get("brands", []) if e.get("match") is not False]
    found: dict[int, list] = defaultdict(list)
    brand_n = Counter()
    for sido in meta["sidos"]:
        if not (DATA / f"{sido['id']}.json").exists():
            continue
        for s in load_rows(sido["id"]):
            for i, e in enumerate(entries):
                if (e.get("kind") or "brand") == "place":
                    continue
                if matches(e, s, sido):
                    found[i].append((sido["name"], s))
                    if (e.get("kind") or "brand") == "brand":
                        brand_n[e["program"]] += 1
    for i, e in enumerate(entries):
        kind = e.get("kind") or "brand"
        if kind not in ("store", "market"):
            continue
        hits = found.get(i, [])
        where = " ".join(x for x in (e.get("sido"), e.get("sgg"), e.get("market")) if x)
        print(f"[stores] {e['program']} {kind} {e['name']} ({where}) → {len(hits)}곳")
        for sido_name, s in hits[:3]:
            print(f"[stores]     {sido_name} · {fmt(s)}")
    brands = [e for e in entries if (e.get("kind") or "brand") == "brand"]
    per = Counter()
    for i, e in enumerate(entries):
        if (e.get("kind") or "brand") == "brand" and found.get(i):
            per[(e["program"], e["name"])] = len(found[i])
    print(f"[stores] 브랜드 {len(brands)}개 중 온누리 가맹점에 나온 브랜드: {dict(per.most_common(15))}")
    print(f"[stores] 프로그램별 브랜드 맞춤 가맹점 수: {dict(brand_n)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
