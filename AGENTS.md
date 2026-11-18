# AI 작업 지침 (Claude · ChatGPT · Gemini 공통)

이 저장소를 수정하는 모든 AI 도구와 사람은 아래 규칙을 따릅니다.

## 프로젝트 개요
- 회사/개인 소개용 **정적 웹사이트**입니다. 빌드 도구나 프레임워크 없이 HTML, CSS, JS만 씁니다.
- `main` 브랜치에 merge되면 GitHub Actions(`.github/workflows/deploy.yml`)가 GitHub Pages로 자동 배포합니다.

## 폴더 구조
```
index.html          홈
about.html          소개
services.html       서비스
contact.html        연락처
ungjup.html         웅줍 지표 (자산별 차트)
assets/css/style.css  모든 스타일 (색상·글꼴은 맨 위 :root 변수에서만 변경)
assets/js/main.js     모바일 메뉴 등 공통 스크립트
assets/js/ungjup.js   웅줍 지표 차트 (캔버스, 외부 라이브러리 없음)
assets/css/ungjup.css 웅줍 지표 페이지 스타일
tools/ungjup/build.py 웅줍 지표 데이터 생성기 (Yahoo Finance → data/ungjup/*.json)
data/ungjup/          생성된 데이터와 자산별 보정 계수(coefs.json)
assets/img/           이미지
```

## 작업 규칙
1. **`main`에 직접 push하지 마세요.** 브랜치(`ai/<도구>/<작업내용>`, 예: `ai/claude/update-hero`)에서 작업하고 Pull Request를 만드세요.
2. PR 설명에는 **무엇을, 왜** 바꿨는지와 어떤 AI 도구로 작업했는지 적으세요.
3. 한 PR에는 한 가지 작업만 담으세요. 같은 파일을 여러 도구가 동시에 고치지 않도록 합니다.
4. 새 페이지를 추가하면 **모든 페이지의 `<nav>` 메뉴**에도 링크를 추가하세요. 헤더와 푸터는 각 HTML 파일에 복사되어 있습니다.
5. 색상은 CSS 변수(`var(--color-...)`)만 사용하고 값을 직접 쓰지 마세요. 다크 모드가 함께 동작해야 합니다.
6. 모바일(폭 360px)에서 가로 스크롤이 생기지 않는지 확인하세요.
7. 이미지는 `assets/img/`에 넣고, 가능한 한 500KB 이하로 압축하며 `alt` 속성을 반드시 적으세요.
8. API 키, 비밀번호, 개인정보는 절대 커밋하지 마세요.
9. 화면에 보이는 문구는 한국어로 씁니다.

## 웅줍 지표
- 데이터는 배포 워크플로가 하루 두 번(한국시간 06:40, 16:40) `tools/ungjup/build.py`로 갱신합니다.
- 자산 추가·변경은 `build.py`의 `ASSETS` 목록만 고치면 페이지에 자동으로 나타납니다.
- 웅줍LV 계수는 `data/ungjup/coefs.json`에 고정되어 있습니다. 다시 보정할 때만 `python tools/ungjup/build.py --fit`을 실행하고, PR에 바뀐 계수를 적으세요.
- 차트 색은 `style.css`의 `--chart-*`, `--lv-*` 변수를 씁니다.

## 로컬 미리보기
```
python3 -m http.server 8000
```
브라우저에서 http://localhost:8000 을 엽니다.
