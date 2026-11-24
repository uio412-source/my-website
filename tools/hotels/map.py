"""Mr. Hotels 지도 바탕(hotels/map.json) 생성기 — 지도 모양을 바꿀 때만 한 번 실행하고 결과를 커밋합니다.

준비(공개 데이터, 저장소에는 넣지 않음):
  mkdir -p /tmp/geo && cd /tmp/geo
  curl -LO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson
  curl -LO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson
  curl -LO https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json
실행:
  python tools/hotels/map.py /tmp/geo

hotels/areas.json의 도시별 box(조금 넓혀서) 안의 Natural Earth 1:10m 땅(면)·강과 서울 25개 구 경계를
Mr. Travel 세계지도(travel/world.json)와 같은 투영으로 바꿔 SVG path로 저장합니다.
도시가 둘 이상인 나라(일본)는 나라 범위의 땅도 저장합니다.
화면(hotels.js)은 world.json으로 세계를, 이 파일로 나라·도시를 그립니다(땅은 칠하고 바다는 바탕색).
"""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORLD = json.loads((ROOT / "travel" / "world.json").read_text())
AREAS = json.loads((ROOT / "hotels" / "areas.json").read_text())
OUT = ROOT / "hotels" / "map.json"


def project(lon, lat):
    """travel.js·hotels.js의 project()와 같은 Natural Earth 투영(태평양 중심)."""
    l = lon - WORLD["l0"]
    l = ((l + 180) % 360 + 360) % 360 - 180
    lam, phi = math.radians(l), math.radians(lat)
    p2 = phi * phi
    p4 = p2 * p2
    x = lam * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)))
    y = phi * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))
    return WORLD["tx"] + WORLD["k"] * x, WORLD["ty"] - WORLD["k"] * y


def clip_segment(a, b, box):
    """Liang–Barsky: 상자 안에 들어가는 선분 부분 (없으면 None)."""
    x0, y0, x1, y1 = box
    dx, dy = b[0] - a[0], b[1] - a[1]
    t0, t1 = 0.0, 1.0
    for p, q in ((-dx, a[0] - x0), (dx, x1 - a[0]), (-dy, a[1] - y0), (dy, y1 - a[1])):
        if p == 0:
            if q < 0:
                return None
            continue
        r = q / p
        if p < 0:
            if r > t1:
                return None
            t0 = max(t0, r)
        else:
            if r < t0:
                return None
            t1 = min(t1, r)
    return (a[0] + t0 * dx, a[1] + t0 * dy), (a[0] + t1 * dx, a[1] + t1 * dy), t0 > 0, t1 < 1


def clip_line(coords, box):
    """경위도 선 → 상자 안 조각들(경위도)."""
    out, cur = [], []
    for a, b in zip(coords, coords[1:]):
        c = clip_segment(a, b, box)
        if not c:
            if cur:
                out.append(cur)
                cur = []
            continue
        p, q, cut_in, cut_out = c
        if not cur or cut_in:
            if cur:
                out.append(cur)
            cur = [p]
        cur.append(q)
        if cut_out:
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return [l for l in out if len(l) >= 2]


def clip_ring(ring, box):
    """Sutherland–Hodgman: 다각형 고리를 상자로 자름(상자 가장자리를 따라 닫힘)."""
    x0, y0, x1, y1 = box
    edges = ((lambda p: p[0] >= x0, lambda a, b: (x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0]))),
             (lambda p: p[0] <= x1, lambda a, b: (x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0]))),
             (lambda p: p[1] >= y0, lambda a, b: (a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0)),
             (lambda p: p[1] <= y1, lambda a, b: (a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1)))
    pts = [tuple(p) for p in ring]
    for inside, cross in edges:
        if not pts:
            break
        out = []
        prev = pts[-1]
        for cur in pts:
            if inside(cur):
                if not inside(prev):
                    out.append(cross(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(cross(prev, cur))
            prev = cur
        pts = out
    return pts if len(pts) >= 3 else None


def land_in(features, box):
    rings = []
    for f in features:
        g = f["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        for poly in polys:
            outer = poly[0]
            xs = [p[0] for p in outer]
            ys = [p[1] for p in outer]
            if max(xs) < box[0] or min(xs) > box[2] or max(ys) < box[1] or min(ys) > box[3]:
                continue
            for ring in poly:
                r = clip_ring(ring, box)
                if r:
                    rings.append(r)
    return rings


def lines_of(geom):
    if geom["type"] == "LineString":
        return [geom["coordinates"]]
    if geom["type"] == "MultiLineString":
        return geom["coordinates"]
    return []


def path(lines, closed=False, tol=0.0012):
    """투영해서 SVG path로. 화면에서 구분 안 될 만큼 가까운 점은 건너뜀."""
    parts = []
    for line in lines:
        pts = [project(lon, lat) for lon, lat in line]
        keep = [pts[0]]
        for p in pts[1:-1]:
            if abs(p[0] - keep[-1][0]) + abs(p[1] - keep[-1][1]) >= tol:
                keep.append(p)
        keep.append(pts[-1])
        if len(keep) < 2:
            continue
        parts.append("M" + "L".join(f"{x:.4f},{y:.4f}" for x, y in keep) + ("Z" if closed else ""))
    return "".join(parts)


def main(src):
    src = Path(src)
    land = json.loads((src / "ne_10m_land.geojson").read_text())["features"]
    rivers = json.loads((src / "ne_10m_rivers_lake_centerlines.geojson").read_text())["features"]
    seoul = json.loads((src / "seoul_municipalities_geo_simple.json").read_text())["features"]
    out = {"source": "Natural Earth 1:10m 땅·강, 서울 구 경계: 통계청(southkorea/seoul-maps)",
           # 위도·경도 → 지도 좌표 투영값(world.json과 같음). 발레파킹 지도(hotel-valet.js)가 world.json 없이 핀을 찍을 때 씀
           "proj": {k: WORLD[k] for k in ("l0", "k", "tx", "ty")},
           "countries": {}, "cities": {}}
    by_country = {}
    for name, city in AREAS["cities"].items():
        by_country.setdefault(city.get("country"), []).append(city["box"])
    for country, boxes in by_country.items():
        if not country or len(boxes) < 2:
            continue
        w = min(b[0] for b in boxes); s = min(b[1] for b in boxes); e = max(b[2] for b in boxes); n = max(b[3] for b in boxes)
        mx, my = max((e - w) * 0.9, 2.5), max((n - s) * 0.9, 2.0)
        box = (w - mx, s - my, e + mx, n + my)
        rings = land_in(land, box)
        out["countries"][country] = {"land": path(rings, closed=True, tol=0.02)}
        print(f"{country}: 땅 {len(rings)}조각")
    for name, city in AREAS["cities"].items():
        w, s, e, n = city["box"]
        mx, my = (e - w) * 0.35, (n - s) * 0.35
        box = (w - mx, s - my, e + mx, n + my)
        rings = land_in(land, box)
        r_lines = [p for f in rivers for l in lines_of(f["geometry"]) for p in clip_line(l, box)]
        item = {"land": path(rings, closed=True), "rivers": path(r_lines)}
        if name == "서울":
            gu = []
            for f in seoul:
                g = f["geometry"]
                polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
                rings = [poly[0] for poly in polys]
                ring = max(rings, key=len)
                cx = sum(p[0] for p in ring) / len(ring)
                cy = sum(p[1] for p in ring) / len(ring)
                lx, ly = project(cx, cy)
                gu.append({"n": f["properties"]["name"], "d": path(rings, closed=True, tol=0.0008), "c": [round(lx, 4), round(ly, 4)]})
            item["gu"] = sorted(gu, key=lambda x: x["n"])
        out["cities"][name] = item
        print(f"{name}: 땅 {len(rings)}조각 · 강 {len(r_lines)}조각" + (f" · 구 {len(item.get('gu', []))}" if "gu" in item else ""))
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"→ {OUT.relative_to(ROOT)} {OUT.stat().st_size:,} bytes")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/geo")
