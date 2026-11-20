"""배포 버전 도장: 오래된 페이지가 브라우저 캐시에 남지 않게 합니다. (배포 워크플로에서만 실행)

  python tools/stamp_version.py <버전>

- version.json  : {"v": 버전, "built": UTC 시각}  ← main.js가 캐시 없이 읽어서 비교
- 모든 *.html   : <meta name="mrs-build" content="버전"> 를 넣고,
                  assets/ 아래 CSS·JS 주소에 ?v=버전 을 붙임 (배포마다 새 파일을 받게)
저장소의 HTML에는 도장이 없어서(로컬 미리보기 = "dev") 버전 확인을 건너뜁니다.
"""
import json, re, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSET = re.compile(r'((?:href|src)=")((?:\.\./)?assets/[^"?#]+\.(?:css|js))(?:\?[^"#]*)?(")')
META = re.compile(r'<meta name="mrs-build" content="[^"]*">')


def main(version):
    (ROOT / "version.json").write_text(json.dumps(
        {"v": version, "built": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}))
    for page in sorted([*ROOT.glob("*.html"), ROOT / "hotels" / "index.html"]):
        html = page.read_text(encoding="utf-8")
        tag = f'<meta name="mrs-build" content="{version}">'
        html = META.sub(tag, html) if META.search(html) else html.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n  ' + tag, 1)
        html = ASSET.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={version}{m.group(3)}", html)
        page.write_text(html, encoding="utf-8")
        print(f"  {page.relative_to(ROOT)}: {version}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "dev")
