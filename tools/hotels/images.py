"""Mr. Hotels 대표 이미지 찾기 (배포 워크플로에서 실행)

  python tools/hotels/images.py

hotels/directory.json에서 image가 없는 호텔(Marriott, HOTELLUX의 독립 호텔)의
공식 페이지를 열어 og:image 주소를 찾고 hotels/images.json({"프로그램:id": 주소})에 적습니다.
- 페이지 주소: 호텔의 site가 있으면 site, 없으면 url
- same이 있는 호텔(다른 체인 목록에 같은 호텔이 있음)은 화면에서 그 이미지를 같이 쓰므로 건너뜁니다.
- 이미 images.json에 있는 호텔은 다시 요청하지 않습니다(캐시). 공통 배너(link_img 등)·로고·자리표시자
  이미지와 여러 호텔에 똑같이 붙는 이미지는 호텔 사진이 아니라서 버립니다.
- 실패한 호텔은 비워 두고 화면은 성급 타일로 대신 보여 줍니다. 이전 images.json에 있던 값은 유지합니다.
이미지 주소를 직접 정하려면 directory.json의 호텔에 "image"를 넣으세요(이 스크립트보다 우선).
"""
import json
import re
import sys
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = ROOT / "hotels" / "directory.json"
OUT = ROOT / "hotels" / "images.json"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130.0 Safari/537.36")
META = re.compile(r'<meta[^>]+(?:property|name)=["\'](?:og:image|og:image:url|twitter:image)["\'][^>]*>', re.I)
CONTENT = re.compile(r'content=["\']([^"\']+)["\']', re.I)
# 체인 공통 배너·로고·빈 이미지 자리표시자는 호텔 사진이 아니므로 버림
BAD_IMAGE = re.compile(r"link_img|common_?banner|main_?banner|banner|/logo|_logo\.|logo\.|placeholder|no_?image|default_?img|og_?default|share_?img", re.I)


def og_image(page):
    req = urllib.request.Request(page, headers={
        "User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8"})
    with urllib.request.urlopen(req, timeout=20) as r:
        html = r.read(1_500_000).decode("utf-8", "ignore")
    for tag in META.findall(html):
        m = CONTENT.search(tag)
        if not m:
            continue
        url = unescape(m.group(1)).strip()
        if url.startswith("//"):
            url = "https:" + url
        if url.startswith("https://") and not url.lower().split("?")[0].endswith(".svg") and not BAD_IMAGE.search(url):
            return url
    return None


def main():
    data = json.loads(DIRECTORY.read_text(encoding="utf-8"))
    try:
        found = json.loads(OUT.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        found = {}
    # 예전에 저장된 공통 배너·로고는 캐시에서 버리고 다시 찾음
    stale = sorted(k for k, v in found.items() if not isinstance(v, str) or not v.startswith("https://") or BAD_IMAGE.search(v))
    for k in stale:
        found.pop(k, None)
    if stale:
        print(f"  캐시에서 공통 배너·로고 {len(stale)}개 버림")
    jobs = []
    for country in data["countries"]:
        for city in country["cities"]:
            for program, hotels in city["programs"].items():
                for h in hotels:
                    key = f"{program}:{h['id']}"
                    # 이미 찾은 이미지는 다시 요청하지 않고 캐시를 씀(배포마다 263곳을 새로 긁지 않게)
                    if h.get("image") or h.get("same") or key in found:
                        continue
                    jobs.append((key, h.get("site") or h["url"]))

    def run(job):
        key, page = job
        try:
            return key, og_image(page), None
        except Exception as e:  # 사이트가 막거나 느리면 건너뜀
            return key, None, e

    ok = 0
    with ThreadPoolExecutor(max_workers=6) as pool:
        for key, url, err in pool.map(run, jobs):
            if url:
                found[key] = url
                ok += 1
            print(f"  {key}: {url or ('실패 ' + str(err) if err else '없음')}")
    # 같은 이미지가 여러 호텔에 붙으면 체인 공통 배너로 보고 모두 뺌(호텔 사진이 아님)
    dup = {url for url, n in Counter(found.values()).items() if n > 1}
    if dup:
        found = {k: v for k, v in found.items() if v not in dup}
        print(f"  여러 호텔에 같은 이미지 {len(dup)}개 → 공통 배너로 보고 뺌")
    OUT.write_text(json.dumps(found, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"대표 이미지 {ok}/{len(jobs)}곳 새로 찾음 · 캐시 {len(found)}곳 → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    sys.exit(main())
