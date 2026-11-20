"""Mr. Hotels 대표 이미지 찾기 (배포 워크플로에서 실행)

  python tools/hotels/images.py

hotels/directory.json에서 image가 없는 호텔(Marriott, HOTELLUX의 독립 호텔)의
공식 페이지를 열어 og:image 주소를 찾고 hotels/images.json({"프로그램:id": 주소})에 적습니다.
- 페이지 주소: 호텔의 site가 있으면 site, 없으면 url
- same이 있는 호텔(다른 체인 목록에 같은 호텔이 있음)은 화면에서 그 이미지를 같이 쓰므로 건너뜁니다.
- 실패한 호텔은 비워 두고 화면은 성급 타일로 대신 보여 줍니다. 이전 images.json에 있던 값은 유지합니다.
이미지 주소를 직접 정하려면 directory.json의 호텔에 "image"를 넣으세요(이 스크립트보다 우선).
"""
import json
import re
import sys
import urllib.request
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
        if url.startswith("https://") and not url.lower().split("?")[0].endswith(".svg") and "logo" not in url.lower():
            return url
    return None


def main():
    data = json.loads(DIRECTORY.read_text(encoding="utf-8"))
    try:
        found = json.loads(OUT.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        found = {}
    jobs = []
    for country in data["countries"]:
        for city in country["cities"]:
            for program, hotels in city["programs"].items():
                for h in hotels:
                    if h.get("image") or h.get("same"):
                        continue
                    jobs.append((f"{program}:{h['id']}", h.get("site") or h["url"]))

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
    OUT.write_text(json.dumps(found, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"대표 이미지 {ok}/{len(jobs)}곳 새로 찾음 → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    sys.exit(main())
