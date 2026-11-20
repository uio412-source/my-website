# AI 작업 지침 (Claude · ChatGPT · Gemini 공통)

이 저장소를 수정하는 모든 AI 도구와 사람은 아래 규칙을 따릅니다.

## 프로젝트 개요
- **Mr. Stocks**: 줍줍 지표 차트와 관심종목 시세을 보여 주는 **정적 웹사이트**입니다. 빌드 도구나 프레임워크 없이 HTML, CSS, JS만 씁니다.
- 모바일 우선입니다. 폭 720px 이하에서는 위 메뉴 대신 하단 탭바(차트 · 관심종목 · 배당)가 나옵니다.
- **Mr. Cards**(옛 이름 페이모먼트): 같은 저장소의 `paymorevent/` 폴더에 있는 카드 혜택 사이트로 `/my-website/paymorevent/`에 배포됩니다. 메뉴는 **카드상품 검색 · 발급이벤트 · 카드사 이벤트** 세 가지입니다(호텔 기능은 제거). React·Vite로 빌드하며(`npm ci`, `npm run build`), 링크·이미지 경로는 `lib/site-path.ts`의 함수를 씁니다. 헤더·하단 탭바·글꼴·색은 Mr. Stocks와 같게 `paymorevent/app/mr-cards.css`와 `components/customer-shell.tsx`에서 맞춥니다.
  - **다크 모드**: Mr. Stocks와 같은 `theme` 저장값을 같이 씁니다(한쪽에서 바꾸면 다른 쪽도 같음). `app/*.css`의 색은 `var(--d-색, 원래색)`으로 감싸 두었고 다크 값은 `app/mr-cards-dark.css`(자동 생성)에 있습니다. CSS에 색을 추가·변경했다면 `paymorevent/`에서 `npm run theme`을 실행해 함께 커밋하세요.
  - **첫 화면 속도**: `pages/main.tsx`는 화면(목록·카드 상세·이벤트 상세)과 큰 데이터(`data/events.json`, `data/home-cards.json`)를 `import()`로 나눠 받습니다. 이 파일들을 다시 맨 위 `import`로 불러오지 마세요(첫 화면 JS가 다시 2.5MB가 됩니다).
  - **화면 규칙**: 카드·이벤트 목록은 24개씩 보여 주고 "더 보기"(남은 개수 표시)로 늘립니다. 휴대폰에서 카드사 선택과 칩은 옆으로 넘기는 한 줄입니다. 새 스타일은 `app/mr-cards.css` 끝의 "UI/UX 개선" 부분에 `--mc-*` 변수만 써서 넣으면 다크 모드가 따로 손대지 않아도 맞습니다.
  - **사이트 전환 메뉴**(로고 옆 ▾): Mr. Stocks는 `assets/js/main.js`, Mr. Cards는 `components/customer-shell.tsx`에 있습니다. 문구를 바꾸면 두 곳을 같이 고치세요.
  - **호텔 기능 제거**: 호텔 칩·`#호텔` 해시태그·'호텔제휴' 필터는 없습니다. 호텔·리조트가 직접 주는 혜택 이벤트(호텔 체인·특급호텔 다이닝·객실 패키지 등)는 `lib/hotel-offers.mjs` 기준으로 목록·상세 주소에서 빼고, 아고다·호텔스닷컴 같은 여행 예약 사이트 할인은 남깁니다. 호텔 관련 화면 요소를 다시 추가하지 마세요.
- `main` 브랜치에 merge되면 GitHub Actions(`.github/workflows/deploy.yml`)가 GitHub Pages로 자동 배포합니다.

## 폴더 구조
```
index.html            ungjup.html로 이동만 함
ungjup.html           차트 (지수별 줍줍 구간·줍줍LV, 참고자료)
holdings.html         관심종목 (시세·등락률·줍줍LV·뉴스)
dividend.html         배당 (보유 종목별 예상 배당금·배당률, 월별 배당)
wealth.html           이전 주소에서 관심종목으로 이동
assets/css/style.css  공통 스타일·색상 변수 (색은 :root 변수에서만 변경)
assets/css/ungjup.css 차트 페이지 스타일
assets/css/portfolio.css 관심종목 페이지 스타일 (배당 페이지도 목록·시트·타일에 함께 씀)
assets/css/dividend.css 배당 페이지 스타일
assets/js/main.js     공통 스크립트
assets/js/ungjup.js   차트 (캔버스, 외부 라이브러리 없음)
assets/js/watchlist.js 관심종목 페이지
assets/js/dividend.js  배당 페이지
tools/ungjup/build.py 데이터 생성기 (Yahoo Finance → data/ungjup/*.json)
tools/ungjup/extras.py 종목 검색 목록(symbols.json)·종목별 뉴스(news.json) 생성
tools/ungjup/dividends.py 종목별 최근 12개월 주당 배당금(dividends.json) 생성
data/watchlist.json   기본 관심종목 목록 (종목명과 티커)
data/dividend_extra.json (선택) 배당 데이터를 꼭 계산할 추가 티커 목록 ["SCHD", "005930.KS"]
data/ungjup/          생성된 지수 데이터, 종목별 시세·LV(holdings_lv.json), 줍줍LV 기준표(lv_model.json), symbols.json, news.json
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
8. API 키, 비밀번호, 개인정보는 절대 커밋하지 마세요.
9. 화면에 보이는 문구는 한국어로 씁니다.

## 관심종목 데이터
- 기본 목록은 `data/watchlist.json`에서 수정합니다. `name`에 종목명, `symbol`에 Yahoo Finance 티커(국내는 `005930.KS` 형식)를 넣으면 다음 배포 때 최근 일봉 기준 가격과 전일 대비 등락률, 줍줍LV가 계산됩니다.
- 뉴스는 배포 때 Google 뉴스 한국어 최근 7일 기사를 종목별로 최대 3개 가져옵니다. 검색어를 지정하려면 종목에 `news_q`를 추가하세요.
- 종목 검색 목록은 미국의 Nasdaq Trader 공식 목록과 국내 네이버 증권 시가총액 목록으로 구성합니다. 7일마다 새로 받고 `--symbols`로 강제 갱신할 수 있습니다. 미국 종목 한글 이름은 `extras.py`의 `US_KO`에 추가하세요.
- 화면 구성: 오늘 등락 분포 → 보기 탭(전체·국내·해외·줍줍권)·정렬 → 한 줄 목록. 종목을 누르면 상세 시트(줍줍LV 게이지·RSI·52주 고점/200일선 대비·뉴스·삭제)가 열립니다. 뉴스 피드는 종목당 최대 2건, 최신 12건이며 데스크톱은 오른쪽 열, 모바일은 가로로 넘기는 카드입니다.
- 화면에서 추가하거나 삭제한 관심종목은 브라우저의 `mrstocks.watchlist.v1`에 저장됩니다. 배포 데이터에 없는 종목은 시세와 뉴스 검색 링크로 연결됩니다.

## 배당
- 보유 종목(종목·수량·취득가)은 브라우저 `mrstocks.dividend.v1`에만 저장됩니다. 취득가를 비우면 현재가로 계산합니다. 세전/세후 선택은 `mrstocks.dividend.tax`.
- 주당 배당금은 배포 때 `dividends.py`가 Yahoo 배당 이력으로 계산합니다: 최근 365일 배당락 기준 합계(상장 1년 미만은 평균 × 지급 주기로 연환산). 하루 한 번만 새로 받고 `build.py --dividends`로 강제 갱신.
- 계산 대상(배당 유니버스): 관심종목 + `data/dividend_extra.json` + 코스피 시총 상위 200·코스닥 40 + 이름에 배당·커버드콜·인컴·리츠 등이 들어간 국내 ETF + `dividends.py`의 `US_DIV`. 목록에 없는 종목은 화면에서 연간 주당 배당금을 직접 입력합니다.
- 화면: 요약(투자금 | 연 배당금 | 배당률, 월 평균·현재가 기준 배당률) → 월별 예상 배당금(배당락 월 기준) → 보유 종목(연 배당금 순). 미국 종목은 오늘 환율(`fx.USDKRW`)로 원화 환산, 세후는 국내 15.4%·미국 15% 단순 적용.

## 줍줍 지표
- 데이터는 배포 워크플로가 하루 두 번(한국시간 06:40, 16:40) `tools/ungjup/build.py`로 갱신합니다.
- 자산 추가·변경은 `build.py`의 `ASSETS` 목록만 고치면 페이지에 자동으로 나타납니다.
- **줍줍LV(v2)** = 지금의 하락 스트레스가 "전체 자산(지수+관심종목) 과거 모든 날 중 몇 번째인가"를 1~1000으로 나타낸 값입니다.
  1. 52주 고점 대비 하락률, 200일선 아래 이격(위면 0)을 자산의 평소 변동성으로 나누고, 과매도 = max(0, 50 − RSI)
  2. 셋을 공통 백분위로 바꿔 0.5·하락률 + 0.3·이격 + 0.2·과매도로 합치고 3일 평활
  3. 그 점수의 공통 백분위 × 999 + 1 → LV 900 = 과거 전체에서 상위 10%
- 구간 이름: 1~399 평온 · 400~699 조정 · 700~899 깊은 조정 · 900~1000 줍줍권
- 기준표와 자산별 평소 변동성은 `data/ungjup/lv_model.json`에 고정되어 있습니다. 다시 만들 때만 `python tools/ungjup/build.py --fit`을 실행하고 PR에 이유를 적으세요. 상장 200일 미만 종목은 있는 기간으로 200일선을 근사하고 "추정"으로 표시합니다.
- 차트 색은 `style.css`의 `--chart-*`, `--lv-*` 변수를 씁니다. 줍줍 음영은 핑크(`--chart-zone1/2`, 진한 구간 하단 띠 `--chart-zone-strip`)입니다.
- **오른쪽 아래 새로고침 버튼**(`main.js`): 누르면 캐시를 건너뛰고(`?v=시각`, `cache: no-store`) 서버의 최신 데이터 파일을 다시 받아 지금 화면을 그대로 다시 그립니다. 결과는 토스트로 알려 주고, 이미 최신이면 GitHub Actions 배포 페이지(지금 다시 계산) 링크를 보여 줍니다.
  - 페이지 스크립트는 데이터를 `window.MS.getJSON(url)`로 불러오고, `datarefresh` 이벤트를 받으면 `e.detail.tasks.push(Promise)`로 다시 그리는 작업을 넣으세요. 이벤트 연결은 한 번만 하세요(다시 그릴 때 중복되지 않게).
- **배포 버전 도장**: 배포 때 `tools/stamp_version.py`가 모든 HTML에 `<meta name="mrs-build">`와 CSS·JS 주소의 `?v=커밋`을 붙이고 `version.json`을 만듭니다. `main.js`가 페이지를 열 때·탭으로 돌아올 때·새로고침 버튼을 누를 때 `version.json`과 비교해, 브라우저에 옛 페이지가 남아 있으면 한 번 자동으로 새로 불러옵니다. 그러니 HTML에 `?v=2` 같은 버전을 직접 붙이지 마세요.
- 다크/라이트 모드는 오른쪽 위 버튼으로 바꾸며 `<html data-theme>`과 localStorage에 저장됩니다. 색을 추가할 때는 `style.css`의 다크 블록 두 곳(시스템 설정용, `data-theme="dark"`용)에 모두 넣으세요.

## 로컬 미리보기
```
python3 -m http.server 8000
```
브라우저에서 http://localhost:8000 을 엽니다.
