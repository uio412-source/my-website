"""Mr. Pay — 가맹점 DB 만들기 (배포 때 실행, 원본 새 판 확인은 한 달에 한 번)

원본 (공공데이터포털 파일 데이터, 로그인·키 없이 받음)
  온누리: 소상공인시장진흥공단_전국 온누리상품권 가맹점 현황  https://www.data.go.kr/data/3060079/fileData.do  (연 1회 갱신)
          칸: 가맹점명 · 소속 시장명(또는 상점가) · 소재지(시도 이름만) · 취급품목 · 지류형/디지털형 가맹 여부 · 가맹 등록년도
  업종·주소: 소상공인시장진흥공단_상가(상권)정보            https://www.data.go.kr/data/15083033/fileData.do (분기 갱신, ZIP 약 350MB)
          온누리에는 주소·업종이 없어서(소재지 = 시도), 같은 시도·같은 상호인 상가 후보 중
          '그 시장 가맹점들의 후보가 가장 많이 모인 시군구·동'(= 시장 위치)에 있는 곳이 하나일 때만 주소·업종을 붙임.
          못 맞춘 가맹점은 업종을 취급품목·상호 낱말로 추정(inf=1)하고 주소 대신 시장 위치(시군구·동)를 보여 줌

흐름
  1. 캐시(~/.cache/mrpay, 배포 워크플로가 actions/cache로 달마다 보관)에 이번 달 확인 기록이 있으면 네트워크를 안 씀
  2. 없으면(매월 첫 배포) 두 상세 페이지에서 최신 판 id(uddi)를 읽고, 캐시에 없는 판만 내려받음
       POST /tcs/dss/selectFileDataDownload.do → atchFileId·fileDetailSn·dataNm
       GET  /cmm/cmm/fileDownload.do?atchFileId=…&fileDetailSn=…&dataNm=…  (dataNm을 빼면 0바이트가 옴)
  3. 판이 바뀌었으면 다시 맞춰 pay/data/onnuri/ 아래 시도별 JSON과 meta.json을 만듦(커밋 안 함, 결과도 캐시)
  실패하면 캐시에 남은 지난 판을 쓰고, 그것도 없으면 아무것도 만들지 않음(화면은 '준비 중').

사용: python tools/pay/build.py [--force]            # --force: 이번 달 확인했어도 다시 확인
      python tools/pay/build.py --csv 온누리.csv [--sangga 상가.zip]   # 내려받은 파일로 시험
"""
from __future__ import annotations

import csv
import io
import json
import os
import re
import shutil
import sys
import urllib.parse
import urllib.request
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

VERSION = 3  # 맞추는 규칙·출력 모양을 바꾸면 올림(캐시된 결과를 다시 만듦)
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "pay" / "data" / "onnuri"
CACHE = Path(os.environ.get("MRPAY_CACHE", Path.home() / ".cache" / "mrpay"))
BASE = "https://www.data.go.kr"
UA = "Mozilla/5.0 (compatible; mr-pay-db/1.0; +https://uio412-source.github.io/my-website/)"
KST = timezone(timedelta(hours=9))
NOW = datetime.now(KST)
MONTH = NOW.strftime("%Y-%m")
csv.field_size_limit(10_000_000)

DATASETS = {
    "onnuri": {"pk": "3060079", "min": 500_000, "title": "소상공인시장진흥공단_전국 온누리상품권 가맹점 현황"},
    "sangga": {"pk": "15083033", "min": 20_000_000, "title": "소상공인시장진흥공단_상가(상권)정보"},
}

# 시도 이름 → (파일 코드, 짧은 이름)
SIDO = [
    ("seoul", "서울", ("서울특별시", "서울시", "서울")),
    ("busan", "부산", ("부산광역시", "부산시", "부산")),
    ("daegu", "대구", ("대구광역시", "대구시", "대구")),
    ("incheon", "인천", ("인천광역시", "인천시", "인천")),
    ("gwangju", "광주", ("광주광역시", "광주")),
    ("daejeon", "대전", ("대전광역시", "대전시", "대전")),
    ("ulsan", "울산", ("울산광역시", "울산시", "울산")),
    ("sejong", "세종", ("세종특별자치시", "세종시", "세종")),
    ("gyeonggi", "경기", ("경기도", "경기")),
    ("gangwon", "강원", ("강원특별자치도", "강원도", "강원")),
    ("chungbuk", "충북", ("충청북도", "충북")),
    ("chungnam", "충남", ("충청남도", "충남")),
    ("jeonbuk", "전북", ("전북특별자치도", "전라북도", "전북")),
    # 전남·광주 통합: 온누리 원본(2026-07-31판)은 '전남' 하나로, 상가정보(2026-09판)는 '전남광주통합특별시'로 적음
    ("jeonnam", "전남", ("전남광주통합특별시", "전남광주특별시", "전라남도", "전남")),
    ("gyeongbuk", "경북", ("경상북도", "경북")),
    ("gyeongnam", "경남", ("경상남도", "경남")),
    ("jeju", "제주", ("제주특별자치도", "제주도", "제주")),
]
SIDO_OF = {alias: (code, short) for code, short, aliases in SIDO for alias in aliases}
SIDO_SHORT = {code: short for code, short, _ in SIDO} | {"etc": "기타"}
SIDO_NAME = SIDO_SHORT | {"jeonnam": "전남·광주"}  # 화면에 보이는 이름

# 원본 칸(띄어쓰기 지운 이름) → 내부 키
ONNURI_COLS = {
    "name": ("가맹점명", "상호명", "상호"),
    "market": ("소속시장명(또는상점가)", "소속시장명", "시장명", "소속시장", "상점가명"),
    "addr": ("소재지", "주소", "도로명주소", "소재지주소"),
    "goods": ("취급품목", "품목"),
    "paper": ("지류형가맹여부", "지류형", "지류가맹여부"),
    "digital": ("디지털형가맹여부", "디지털형", "디지털가맹여부"),
    "year": ("가맹등록년도", "등록년도", "가맹년도"),
}
SANGGA_COLS = {
    "name": ("상호명",), "branch": ("지점명",),
    "cat": ("상권업종대분류명",), "mid": ("상권업종중분류명",), "biz": ("상권업종소분류명",),
    "sido": ("시도명",), "sgg": ("시군구명",), "dong": ("법정동명",), "hdong": ("행정동명",),
    "jibun": ("지번주소",), "road": ("도로명주소",), "bldg": ("건물명",),
    "lon": ("경도",), "lat": ("위도",),
}


def log(*a):
    print("[pay]", *a, flush=True)


# ----------------------------------------------------------------- 내려받기
def http(url: str, data: dict | None = None, method: str = "GET", referer: str | None = None, timeout: int = 60) -> tuple[bytes, dict]:
    body = None
    if data is not None and method == "POST":
        body = urllib.parse.urlencode(data).encode()
    elif data is not None:
        url = url + ("&" if "?" in url else "?") + urllib.parse.urlencode(data)
    headers = {"User-Agent": UA, "Accept": "*/*", "Accept-Language": "ko-KR,ko;q=0.9"}
    if referer:
        headers["Referer"] = referer
    if body:
        headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(), dict(r.headers)


def find_key(obj, key):
    """중첩된 JSON에서 첫 번째 key 값."""
    if isinstance(obj, dict):
        if obj.get(key) not in (None, ""):
            return obj[key]
        vals = obj.values()
    elif isinstance(obj, list):
        vals = obj
    else:
        return None
    for v in vals:
        hit = find_key(v, key)
        if hit not in (None, ""):
            return hit
    return None


def latest_version(pk: str) -> tuple[str, str]:
    """상세 페이지에서 최신 판 uddi와 파일 날짜(_YYYYMMDD, 있으면)."""
    page = f"{BASE}/data/{pk}/fileData.do"
    html = http(page)[0].decode("utf-8", "replace")
    calls = re.findall(r"fn_fileDataDown\(\s*'(\d+)'\s*,\s*'(uddi:[^']+)'", html)
    uddis = sorted({u for p, u in calls if p == pk})
    if not uddis:
        uddis = sorted(set(re.findall(r"uddi:[0-9a-fA-F-]{36}", html)))
    if not uddis:
        raise RuntimeError(f"{pk}: 상세 페이지에서 판 id(uddi)를 못 찾음")
    if len(uddis) > 1:
        log(pk, "판 id가 여러 개:", uddis, "→ 첫 번째 사용")
    dates = re.findall(r"_(20\d{6})", html)
    return uddis[0], (max(dates) if dates else "")


def download(pk: str, uddi: str, min_size: int) -> bytes:
    page = f"{BASE}/data/{pk}/fileData.do"
    form = {"publicDataPk": pk, "publicDataDetailPk": uddi, "fileDetailSn": "1", "publicDataTyCode": "PR0051"}
    info = None
    for method in ("POST", "GET"):
        try:
            raw = http(f"{BASE}/tcs/dss/selectFileDataDownload.do", form, method=method, referer=page)[0]
            info = json.loads(raw.decode("utf-8", "replace"))
            if find_key(info, "atchFileId"):
                break
            log(pk, method, "응답에 atchFileId 없음:", raw[:300])
        except Exception as e:  # noqa: BLE001
            log(pk, method, "selectFileDataDownload 실패:", e)
    atch = find_key(info, "atchFileId") if info else None
    if not atch:
        raise RuntimeError(f"{pk}: 파일 id(atchFileId)를 못 받음")
    sn = find_key(info, "fileDetailSn") or "1"
    nm = find_key(info, "dataNm") or find_key(info, "fileNm") or DATASETS_BY_PK[pk]["title"]
    log(pk, "파일:", atch, sn, nm)
    body, headers = http(f"{BASE}/cmm/cmm/fileDownload.do", {"atchFileId": atch, "fileDetailSn": sn, "dataNm": nm}, referer=page, timeout=900)
    log(pk, "받은 크기", f"{len(body):,}", "bytes", headers.get("Content-Type"))
    if len(body) < min_size:
        raise RuntimeError(f"{pk}: 파일이 너무 작음({len(body):,} bytes) — 판이 바뀌었거나 다운로드가 막힘")
    return body


DATASETS_BY_PK = {v["pk"]: v for v in DATASETS.values()}


# ----------------------------------------------------------------- 읽기
def norm_col(c: str) -> str:
    return re.sub(r"\s+", "", c or "").replace("﻿", "")


def decode(body: bytes) -> str:
    for enc in ("utf-8-sig", "cp949"):
        try:
            return body.decode(enc)
        except UnicodeDecodeError:
            continue
    return body.decode("cp949", "replace")


def col_index(head: list[str], spec: dict) -> dict:
    h = [norm_col(c) for c in head]
    idx = {}
    for key, names in spec.items():
        for n in names:
            if n in h:
                idx[key] = h.index(n)
                break
    return idx


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def yes(v: str) -> int:
    return 1 if (v or "").strip().upper() in ("Y", "YES", "O", "가맹", "1", "TRUE", "예") else 0


def sido_of(addr: str) -> tuple[str, str]:
    first = addr.split(" ", 1)[0] if addr else ""
    if first in SIDO_OF:
        return SIDO_OF[first]
    for alias, v in SIDO_OF.items():
        if addr.startswith(alias):
            return v
    return ("etc", "기타")


def nname(s: str) -> str:
    """상호 비교용: (주)·주식회사·띄어쓰기·기호를 뺀 소문자."""
    s = re.sub(r"\(주\)|㈜|주식회사|\(유\)|유한회사|\(사\)", "", s or "")
    return re.sub(r"[\s\-_·.,'\"()\[\]{}&/+~!@#*]+", "", s).lower()


def read_onnuri(text: str) -> list[dict]:
    rows = csv.reader(io.StringIO(text))
    head = next(rows)
    log("온누리 머리줄:", head)
    idx = col_index(head, ONNURI_COLS)
    if "name" not in idx or "addr" not in idx:
        raise RuntimeError(f"온누리: 필수 칸(가맹점명·소재지) 없음 / 머리줄 {head}")
    get = lambda r, k: clean(r[idx[k]]) if k in idx and idx[k] < len(r) else ""
    out, seen, dup = [], set(), 0
    for i, r in enumerate(rows):
        if i < 3:
            log("온누리 예시:", r)
        name, where = get(r, "name"), get(r, "addr")
        if not name:
            continue
        code, short = sido_of(where)
        market = get(r, "market")
        if (short, market, name) in seen:
            dup += 1
            continue
        seen.add((short, market, name))
        out.append({"name": name, "market": market, "goods": get(r, "goods"),
                    "paper": yes(get(r, "paper")), "digital": yes(get(r, "digital")), "year": get(r, "year")[:4],
                    "sido": code, "short": short})
    log(f"온누리 {len(out):,}곳 (같은 시도·시장·상호 {dup:,}건 뺌)")
    return out


def iter_sangga(zbytes: bytes):
    """상가(상권)정보 ZIP 안의 시도별 CSV를 한 줄씩."""
    with zipfile.ZipFile(io.BytesIO(zbytes)) as z:
        names = [n for n in z.namelist() if n.lower().endswith(".csv")]
        log("상가정보 파일:", len(names), "개", [n.encode("cp437", "replace").decode("cp949", "replace") if not n.isascii() else n for n in z.namelist()][:30])
        for n in names:
            raw = z.read(n)
            text = decode(raw)
            rows = csv.reader(io.StringIO(text))
            head = next(rows)
            idx = col_index(head, SANGGA_COLS)
            if "name" not in idx or ("road" not in idx and "jibun" not in idx):
                log("상가정보: 칸을 못 맞춤", n, head[:12])
                continue
            sidos = Counter()
            for r in rows:
                g = {k: (r[i].strip() if i < len(r) else "") for k, i in idx.items()}
                sidos[g.get("sido", "")] += 1
                yield g
            log("  ", len(raw) // 1_000_000, "MB", dict(sidos.most_common(3)))


MAX_CANDS = 80  # '제일상회'처럼 아주 흔한 상호는 후보를 이만큼만 봄


def match(stores: list[dict], sangga_rows) -> tuple[Counter, dict]:
    """온누리 가맹점마다 같은 시도·같은 상호인 상가 후보를 모으고,
    시장마다 후보가 가장 많이 모인 시군구·동(시장 위치)을 정한 뒤 그 안에 후보가 하나뿐이면 주소·업종을 붙임."""
    by_key = defaultdict(list)
    for i, s in enumerate(stores):
        by_key[(s["short"], nname(s["name"]))].append(i)
    cands = defaultdict(list)
    seen, cats, other = 0, Counter(), Counter()
    for g in sangga_rows:
        seen += 1
        short = SIDO_OF.get(g.get("sido", ""), (None, None))[1]
        if not short:
            other[g.get("sido", "")] += 1
            continue
        cats[g.get("cat", "")] += 1
        keys = {nname(g.get("name", ""))}
        if g.get("branch"):
            keys.add(nname(g["name"] + g["branch"]))
        for k in keys:
            for i in by_key.get((short, k), ()):
                if len(cands[i]) < MAX_CANDS:
                    cands[i].append(g)
    log(f"상가정보 {seen:,}곳 · 대분류 {dict(cats.most_common())}")
    if other:
        log("상가정보 시도명을 못 읽은 줄:", dict(other.most_common(5)))
    log(f"같은 시도·상호 후보가 있는 온누리 가맹점 {len(cands):,}곳")

    # 시장 위치: 가맹점마다 후보 시군구(·동)에 1/후보수 표를 줌
    vs, vd = defaultdict(Counter), defaultdict(Counter)
    for i, gs in cands.items():
        mk = (stores[i]["short"], stores[i]["market"])
        sg = {g.get("sgg", "") for g in gs}
        for x in sg:
            vs[mk][x] += 1 / len(sg)
        dd = {(g.get("sgg", ""), g.get("dong", "")) for g in gs}
        for x in dd:
            vd[mk][x] += 1 / len(dd)
    home = {}
    for mk, c in vs.items():
        (top, v), tot = c.most_common(1)[0], sum(c.values())
        if top and v >= 2 and v / tot >= 0.4:
            dd = Counter({d: n for (g, d), n in vd[mk].items() if g == top})
            dong = dd.most_common(1)[0][0] if dd else ""
            home[mk] = (top, dong)
    log(f"위치를 정한 시장 {len(home):,}곳 / 후보가 있는 시장 {len(vs):,}곳")

    stat = Counter()
    for i, gs in cands.items():
        s = stores[i]
        h = home.get((s["short"], s["market"]))
        if not h:
            stat["시장 위치 모름"] += 1
            continue
        pick = [g for g in gs if g.get("sgg") == h[0]]
        if len(pick) > 1:
            same = [g for g in pick if g.get("dong") == h[1]]
            if len(same) >= 1:
                pick = same
        if len(pick) > 1 and s["market"]:
            inb = [g for g in pick if s["market"] in (g.get("bldg") or "")]
            if inb:
                pick = inb
        if len(pick) != 1:
            stat["시장 안 후보 여럿" if pick else "시장 안 후보 없음"] += 1
            continue
        g = pick[0]
        s["cat"], s["biz"] = g.get("cat", ""), g.get("biz", "")
        addr = g.get("road") or g.get("jibun") or ""
        s["addr"] = addr.split(" ", 1)[1] if " " in addr else addr  # 시도는 뺌
        try:
            s["lat"], s["lon"] = float(g["lat"]), float(g["lon"])
        except (KeyError, ValueError):
            pass
        stat["맞춤"] += 1
    stat["후보 없음"] = len(stores) - len(cands)
    return stat, home


# 못 맞춘 가맹점의 업종 추정(취급품목 → 상호 순서). 대분류 이름은 상가정보에 실제로 있는 이름으로 바꿔 씀
GUESS = [
    ("음식", r"식당|음식|분식|김밥|국밥|칼국수|떡볶이|순대국|치킨|통닭|닭강정|족발|보쌈|횟집|회센터|고기집|고깃집|구이|갈비|한식|중식|중국집|짜장|일식|초밥|돈까스|돈가스|카페|커피|다방|제과|베이커리|빵|호떡|도넛|호프|주점|포차|막걸리|백반|찌개|냉면|국수|만두|전집|빈대떡|어묵|튀김|도시락|아구찜|해장국|감자탕|곱창|피자|파스타|햄버거|버거|활어|횟|회집|장어|삼계탕|닭갈비|순대|떡갈비|한정식|뷔페|맥주|호프집"),
    ("소매", r"과일|채소|야채|청과|수산|생선|건어물|젓갈|정육|축산|한우|고기|떡|반찬|김치|곡물|양곡|쌀|잡곡|건강원|인삼|약초|농산|식품|슈퍼|마트|상회|의류|옷|신발|가방|잡화|이불|침구|그릇|주방|철물|공구|전자|가전|휴대폰|안경|꽃|화원|문구|완구|한복|원단|포목|수예|금은방|귀금속|시계|화장품|참기름|방앗간|기름|닭|계란|두부|묵|홍어|굴비|김|미역|조미|양념|주류|담배|약국|건강식품|농약|종묘|사료|애견|한과|정장|양복|양품|속옷|내의|모자|액세서리|악세사리|정수기|가구|커튼|타일|페인트|자전거|낚시|등산|스포츠용품|화장지|생활용품|도자기|유기|공예|기념품|특산품|전통주|커피원두|찻잎|홍삼|버섯|견과|건과|약재|한약재"),
    ("수리·개인", r"미용|헤어|이용원|이발|네일|세탁|수선|사진|열쇠|구두|목욕|사우나|피부|마사지|수리|정비|카센터|대여|렌탈"),
]


def guess_cat(s: dict, cats: set) -> str:
    def real(name):
        if name in cats:
            return name
        hit = [c for c in cats if c and (name.split("·")[0] in c)]
        return hit[0] if hit else name
    for text in (s.get("goods", ""), s.get("name", "")):
        for cat, rx in GUESS:
            if text and re.search(rx, text):
                return real(cat)
    return ""


# ----------------------------------------------------------------- 쓰기
COLS = ["name", "m", "goods", "paper", "digital", "year", "cat", "biz", "addr", "inf"]
MCOLS = ["name", "sgg", "dong", "lat", "lon", "count"]


def write(stores: list[dict], versions: dict, stat: Counter, home: dict, out: Path) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    for f in out.glob("*.json"):
        f.unlink()
    cats = {s["cat"] for s in stores if s.get("cat")}
    for s in stores:
        if not s.get("cat"):
            c = guess_cat(s, cats)
            if c:
                s["cat"], s["inf"] = c, 1
    by_sido = defaultdict(list)
    for s in stores:
        by_sido[s["sido"]].append(s)
    sidos = []
    for code, items in sorted(by_sido.items(), key=lambda kv: -len(kv[1])):
        # 시장 표: 이름·시군구·동(시장 위치)·맞춘 가맹점 좌표의 가운데
        group = defaultdict(list)
        for x in items:
            group[x["market"]].append(x)
        mk_names = sorted(group)
        mi = {m: i for i, m in enumerate(mk_names)}
        mk_rows, sgg_count = [], Counter()
        for m in mk_names:
            sgg, dong = home.get((SIDO_SHORT.get(code, ""), m), ("", ""))
            pts = sorted((x["lat"], x["lon"]) for x in group[m] if x.get("lat"))
            lat, lon = (round(pts[len(pts) // 2][0], 5), round(pts[len(pts) // 2][1], 5)) if pts else (None, None)
            mk_rows.append([m, sgg, dong, lat, lon, len(group[m])])
            sgg_count[sgg] += len(group[m])
        items.sort(key=lambda x: (x["market"], x["name"]))
        rows = [[x["name"], mi[x["market"]], x["goods"], x["paper"], x["digital"], x["year"],
                 x.get("cat", ""), x.get("biz", ""), x.get("addr", ""), x.get("inf", 0)] for x in items]
        (out / f"{code}.json").write_text(json.dumps({"mcols": MCOLS, "markets": mk_rows, "cols": COLS, "rows": rows},
                                                     ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        cat_n = Counter(x.get("cat") or "미확인" for x in items)
        sidos.append({"id": code, "name": SIDO_NAME.get(code, code), "count": len(items), "markets": len(mk_names),
                      "matched": sum(1 for x in items if x.get("addr")),
                      "cats": dict(cat_n.most_common()),
                      "sigungu": [{"name": k or "위치 모름", "count": v} for k, v in sorted(sgg_count.items(), key=lambda kv: (not kv[0], -kv[1]))]})
    total = len(stores)
    matched = sum(1 for s in stores if s.get("addr"))
    meta = {
        "built": NOW.strftime("%Y-%m-%d"),
        "total": total,
        "matched": matched,
        "guessed": sum(1 for s in stores if s.get("inf")),
        "match": dict(stat),
        "sources": [
            {"id": "onnuri", "title": DATASETS["onnuri"]["title"], "url": f"{BASE}/data/{DATASETS['onnuri']['pk']}/fileData.do", **versions.get("onnuri", {})},
            {"id": "sangga", "title": DATASETS["sangga"]["title"], "url": f"{BASE}/data/{DATASETS['sangga']['pk']}/fileData.do", **versions.get("sangga", {})},
        ],
        "sidos": sidos,
    }
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    sizes = {f.name: round(f.stat().st_size / 1024) for f in out.glob("*.json")}
    log(f"합계 {total:,}곳 · 주소·업종 맞춤 {matched:,}곳 ({matched / max(total, 1):.0%}) · 업종 추정 {meta['guessed']:,}곳 · 맞춤 결과 {dict(stat)}")
    log("시도별:", {s["name"]: (s["count"], s["markets"], s["matched"]) for s in sidos})
    log("업종(전체):", dict(Counter(x.get("cat") or "미확인" for x in stores).most_common()))
    log("파일 크기(KB):", dict(sorted(sizes.items(), key=lambda kv: -kv[1])))
    for code, mname in (("seoul", "광장시장"), ("seoul", "망원시장"), ("gyeonggi", ""), ("jeonnam", "")):
        ex = [x for x in by_sido.get(code, []) if x.get("addr") and (not mname or mname in x["market"])][:4]
        log(code, mname or "(아무 시장)", "맞춘 예:", [(x["market"], x["name"], x["addr"], x["cat"], x["biz"]) for x in ex])
    unk = [x for x in stores if not x.get("cat")][:8]
    log("업종 모름 예:", [(x["market"], x["name"], x["goods"]) for x in unk])
    return meta


# ----------------------------------------------------------------- 실행
def main() -> int:
    if "--csv" in sys.argv:
        on = Path(sys.argv[sys.argv.index("--csv") + 1])
        stores = read_onnuri(decode(on.read_bytes()))
        stat, home = Counter({"후보 없음": len(stores)}), {}
        if "--sangga" in sys.argv:
            sg = Path(sys.argv[sys.argv.index("--sangga") + 1])
            stat, home = match(stores, iter_sangga(sg.read_bytes()))
        write(stores, {}, stat, home, OUT)
        return 0

    force = "--force" in sys.argv
    CACHE.mkdir(parents=True, exist_ok=True)
    state_f = CACHE / "state.json"
    state = json.loads(state_f.read_text()) if state_f.exists() else {}
    file_of = lambda key, uddi: CACHE / f"{key}-{re.sub(r'[^0-9A-Za-z-]', '_', uddi)}.bin"

    if force or state.get("checkedMonth") != MONTH:
        for key, ds in DATASETS.items():
            try:
                uddi, fdate = latest_version(ds["pk"])
                log(key, "최신 판:", uddi, fdate or "(날짜 못 읽음)")
                f = file_of(key, uddi)
                if not f.exists():
                    f.write_bytes(download(ds["pk"], uddi, ds["min"]))
                    for old in CACHE.glob(f"{key}-*.bin"):
                        if old != f:
                            old.unlink()
                state[key] = {"uddi": uddi, "fileDate": fdate, "checked": NOW.strftime("%Y-%m-%d")}
            except Exception as e:  # noqa: BLE001
                log(key, "새 판 확인 실패 — 캐시에 있는 판을 씀:", e)
        if all(state.get(k) for k in DATASETS):
            state["checkedMonth"] = MONTH
        state_f.write_text(json.dumps(state, ensure_ascii=False, indent=1))
    else:
        log("이번 달(", MONTH, ") 원본 확인함 — 캐시 사용")

    def cached(key):
        u = (state.get(key) or {}).get("uddi")
        if u and file_of(key, u).exists():
            return file_of(key, u)
        c = sorted(CACHE.glob(f"{key}-*.bin"))
        return c[-1] if c else None

    on_f, sg_f = cached("onnuri"), cached("sangga")
    if not on_f:
        log("캐시에 온누리 원본이 없음 — 이번 배포는 Mr. Pay DB 없이 진행")
        return 1
    sig = [VERSION, on_f.name, sg_f.name if sg_f else ""]
    built = CACHE / "out"
    if state.get("built") == sig and (built / "meta.json").exists() and not force:
        log("같은 판으로 만든 결과가 캐시에 있음 — 그대로 씀")
    else:
        stores = read_onnuri(decode(on_f.read_bytes()))
        stat, home = Counter({"후보 없음": len(stores)}), {}
        if sg_f:
            try:
                stat, home = match(stores, iter_sangga(sg_f.read_bytes()))
            except Exception as e:  # noqa: BLE001
                log("상가정보 맞추기 실패 — 업종 없이 만듦:", e)
        versions = {k: state.get(k, {}) for k in DATASETS}
        write(stores, versions, stat, home, built)
        state["built"] = sig
        state_f.write_text(json.dumps(state, ensure_ascii=False, indent=1))
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(built, OUT)
    log("pay/data/onnuri 준비 완료:", len(list(OUT.glob("*.json"))), "파일")
    return 0


if __name__ == "__main__":
    sys.exit(main())
