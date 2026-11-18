# AI 작업 지침 (Claude · ChatGPT · Gemini 공통)

이 저장소를 수정하는 모든 AI 도구와 사람은 아래 규칙을 따릅니다.

## 프로젝트 개요
- **Mr. Stocks**: 웅줍 지표 차트와 보유종목·자산 현황을 보여 주는 **정적 웹사이트**입니다. 빌드 도구나 프레임워크 없이 HTML, CSS, JS만 씁니다.
- 모바일 우선입니다. 폭 720px 이하에서는 위 메뉴 대신 하단 탭바(차트 · 보유종목 · 자산)가 나옵니다.
- `main` 브랜치에 merge되면 GitHub Actions(`.github/workflows/deploy.yml`)가 GitHub Pages로 자동 배포합니다.

## 폴더 구조
```
index.html            ungjup.html로 이동만 함
ungjup.html           차트 (지수별 웅줍 구간·웅줍LV, 참고자료)
holdings.html         보유종목 (종목별 평가금액·손익·웅줍LV 태그)
wealth.html           자산 (총액·손익, 시장/유형/웅줍LV/상위종목 비중)
assets/css/style.css  공통 스타일·색상 변수 (색은 :root 변수에서만 변경)
assets/css/ungjup.css 차트 페이지 스타일
assets/css/portfolio.css 보유종목·자산 페이지 스타일
assets/js/main.js     공통 스크립트
assets/js/ungjup.js   차트 (캔버스, 외부 라이브러리 없음)
assets/js/portfolio.js 보유종목·자산 페이지
tools/ungjup/build.py 데이터 생성기 (Yahoo Finance → data/ungjup/*.json)
tools/ungjup/extras.py 종목 검색 목록(symbols.json)·뉴스 자막(news.json) 생성
data/holdings.json    보유종목 원본 (사람이 직접 수정)
data/ungjup/          생성된 지수 데이터, holdings_lv.json, 웅줍LV 기준표(lv_model.json), symbols.json, news.json
assets/img/           이미지
```

## 작업 규칙
1. **`main`에 직접 push하지 마세요.** 브랜치(`ai/<도구>/<작업내용>`, 예: `ai/claude/update-hero`)에서 작업하고 Pull Request를 만드세요.
2. PR 설명에는 **무엇을, 왜** 바꿨는지와 어떤 AI 도구로 작업했는지 적으세요.
3. 한 PR에는 한 가지 작업만 담으세요. 같은 파일을 여러 도구가 동시에 고치지 않도록 합니다.
4. 새 페이지를 추가하면 **모든 페이지의 상단 `<nav class="nav">`와 하단 `<nav class="tabbar">`**에 링크를 추가하세요. 헤더는 각 HTML 파일에 복사되어 있습니다.
5. 색상은 CSS 변수(`var(--color-...)`)만 사용하고 값을 직접 쓰지 마세요. 다크 모드가 함께 동작해야 합니다.
6. 모바일(폭 360px)에서 가로 스크롤이 생기지 않는지 확인하세요.
7. 이미지는 `assets/img/`에 넣고, 가능한 한 500KB 이하로 압축하며 `alt` 속성을 반드시 적으세요.
8. API 키, 비밀번호, 개인정보는 절대 커밋하지 마세요. `data/holdings.json`의 보유 현황은 사이트 소유자가 공개하기로 한 내용이며, 계좌번호 같은 다른 정보는 넣지 마세요.
9. 화면에 보이는 문구는 한국어로 씁니다.

## 보유종목 갱신
- `data/holdings.json`의 `asof`(기준일)와 각 종목의 `qty`(수량), `value`(평가금액, 원), `pnl`(평가손익, 원)을 고칩니다. 수익률은 페이지가 `pnl / (value - pnl)`로 계산합니다.
- 새 종목은 Yahoo Finance 티커를 `symbol`에 넣으면(국내는 `005930.KS` 형식) 다음 배포 때 웅줍LV가 계산됩니다.
- `type`은 자산 탭의 유형별 비중에 쓰입니다 (레버리지 ETF, 커버드콜 ETF, 개별 종목, 테마·섹터 ETF, 기타 투자).

## 보유종목 페이지 부가 기능
- **뉴스 자막**: 배포 때 `extras.py`가 보유 개별 종목(+ `news_q`가 있는 종목)과 시장(나스닥·코스피)마다 Google 뉴스 한국어 최근 3일 기사를 받아 `news.json`(최대 40건)으로 저장합니다. 브라우저는 외부 API를 직접 부르지 않습니다(CORS).
- **종목 검색 목록**: 미국 = nasdaqtrader.com 공식 목록, 한국 = 네이버 증권 시가총액 목록(코스피 .KS·코스닥 .KQ, ETF 포함). 7일마다 새로 받고 `--symbols`로 강제 갱신. 미국 종목 한글 이름은 `extras.py`의 `US_KO` 별칭표에 추가하세요.
- **직접 추가한 종목**: 브라우저 localStorage(`mrstocks.added.v1`)에만 저장되고 자산 탭 합계에도 들어갑니다. 웅줍LV는 `data/holdings.json`에 반영해야 계산됩니다(시트의 "반영용 JSON 복사").

## 웅줍 지표
- 데이터는 배포 워크플로가 하루 두 번(한국시간 06:40, 16:40) `tools/ungjup/build.py`로 갱신합니다.
- 자산 추가·변경은 `build.py`의 `ASSETS` 목록만 고치면 페이지에 자동으로 나타납니다.
- **웅줍LV(v2)** = 지금의 하락 스트레스가 "전체 자산(지수+보유종목) 과거 모든 날 중 몇 번째인가"를 1~1000으로 나타낸 값입니다.
  1. 52주 고점 대비 하락률, 200일선 아래 이격(위면 0)을 자산의 평소 변동성으로 나누고, 과매도 = max(0, 50 − RSI)
  2. 셋을 공통 백분위로 바꿔 0.5·하락률 + 0.3·이격 + 0.2·과매도로 합치고 3일 평활
  3. 그 점수의 공통 백분위 × 999 + 1 → LV 900 = 과거 전체에서 상위 10%
- 구간 이름: 1~399 평온 · 400~699 조정 · 700~899 깊은 조정 · 900~1000 웅줍권
- 기준표와 자산별 평소 변동성은 `data/ungjup/lv_model.json`에 고정되어 있습니다. 다시 만들 때만 `python tools/ungjup/build.py --fit`을 실행하고 PR에 이유를 적으세요. 상장 200일 미만 종목은 있는 기간으로 200일선을 근사하고 "추정"으로 표시합니다.
- 차트 색은 `style.css`의 `--chart-*`, `--lv-*` 변수를 씁니다. 웅줍 음영은 핑크(`--chart-zone1/2`, 진한 구간 하단 띠 `--chart-zone-strip`)입니다.
- 다크/라이트 모드는 오른쪽 위 버튼으로 바꾸며 `<html data-theme>`과 localStorage에 저장됩니다. 색을 추가할 때는 `style.css`의 다크 블록 두 곳(시스템 설정용, `data-theme="dark"`용)에 모두 넣으세요.

## 로컬 미리보기
```
python3 -m http.server 8000
```
브라우저에서 http://localhost:8000 을 엽니다.
