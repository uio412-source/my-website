# AI 작업 지침 (Claude · ChatGPT · Gemini 공통)

이 저장소를 수정하는 모든 AI 도구와 사람은 아래 규칙을 따릅니다.

## 프로젝트 개요
- **Mr. Stocks**: 줍줍 지표 차트와 관심종목 시세을 보여 주는 **정적 웹사이트**입니다. 빌드 도구나 프레임워크 없이 HTML, CSS, JS만 씁니다.
- 모바일 우선입니다. 폭 720px 이하에서는 위 메뉴 대신 하단 탭바(차트 · 관심종목 · 배당)가 나옵니다.
- **Mr. Cards**(옛 이름 페이모먼트): 같은 저장소의 `paymorevent/` 폴더에 있는 카드 혜택 사이트로 `/my-website/paymorevent/`에 배포됩니다. 메뉴는 **카드상품 검색 · 발급이벤트 · 카드사 이벤트** 세 가지입니다(호텔 기능은 제거). React·Vite로 빌드하며(`npm ci`, `npm run build`), 링크·이미지 경로는 `lib/site-path.ts`의 함수를 씁니다. 헤더·하단 탭바·글꼴·색은 Mr. Stocks와 같게 `paymorevent/app/mr-cards.css`와 `components/customer-shell.tsx`에서 맞춥니다.
  - **화면**(2026-11 개편): 목록 `components/catalog.tsx`(카드상품 검색·발급이벤트·카드사 이벤트), 상세 `pages/card-detail.tsx`(표준 양식: 머리(큰 카드 이미지·카드사·이름) → 기본 정보 표(종류·연회비·전월실적·최고 피킹률) → 혜택 격자 표(카드사 상품설명서처럼 `구분 | 적용처 | 혜택 | 한도·조건`, 묶음은 가로 머리줄, '통합' 한도는 세로로 합친 칸, 기본 정보와 같은 전월실적은 칸마다 되풀이하지 않음. 한 줄은 `mc-text.ts`의 `benefitRow`) → 피킹률 표 → 결제별 인정 표 → 이벤트 표 → 원문(접힘). 모든 정보는 같은 표 모양 `.cd-t`로만 보여 주고 설명 문단·카드 소개 문구(DB `description`)는 쓰지 않습니다. 이름 앞 카드사명은 빼고 위에 따로 표시)·`pages/event-detail.tsx`, 공통 조각 `components/mc-ui.tsx`(필터 `Chips`는 줄마다 왼쪽에 이름이 붙고, `issuers`면 카드사 타일 칩), 스타일 `app/mc.css` 하나. 카드상품 검색의 혜택 필터는 한 번에 하나만 고릅니다(다시 누르면 해제). DB 원문을 화면용으로 거르는 규칙(혜택이 아닌 안내 항목 숨김, 빈 값 "확인 중" 표시 안 함, 이벤트 요약 문구)과 검색(여러 단어·초성·동의어·이름 우선 점수)은 `lib/mc-text.ts`에 있습니다.
  - **다크 모드**: Mr. Stocks와 같은 `theme` 저장값을 같이 씁니다(한쪽에서 바꾸면 다른 쪽도 같음). 색은 `app/mr-cards.css`의 `--mc-*` 변수만 쓰고(`app/mc.css`에 색 값을 직접 쓰지 마세요), 다크 값은 `scripts/dark-theme.mjs`의 `tokens`에서 `app/mr-cards-dark.css`로 생성합니다. 변수를 추가·변경했다면 `paymorevent/`에서 `npm run theme`을 실행해 함께 커밋하세요.
  - **첫 화면 속도**: `pages/main.tsx`는 화면(목록·카드 상세·이벤트 상세)과 큰 데이터(`data/events.json`, `data/home-cards.json`)를 `import()`로 나눠 받습니다. 이 파일들을 다시 맨 위 `import`로 불러오지 마세요(첫 화면 JS가 다시 2.5MB가 됩니다).
  - **피킹률**(`lib/catalog-model.ts`의 `pickingOptions`): 놀이공원·스포츠 경기·골프·호텔 예약사이트처럼 이용률 낮은 혜택은 `NICHE_PICKING`으로 빼고, 구독·멤버십은 월 3만원까지만 쓴다고 봅니다. 할인받은 결제가 전월실적에서 빠지는 카드는 그 결제를 실적 밖에서 더 쓴다고 보고 분모에 더합니다. 손으로 검수한 수정(한도·통합한도·실적 제외)은 `data/picking-review.json`에 이유와 함께 적으면 빌드 때 덮어씁니다.
  - **이렇게 써도 될까?**(`lib/card-themes.ts`의 `PAYMENT_CHECKS`·`paymentCheck`): 관리비·4대보험·국세·지방세·공과금·자동차 구매·상품권·등록금·월세·무이자할부·혜택받은 결제. 상품권·관리비·세금은 저장된 판정을, 나머지는 원문 제외 목록에서 찾습니다(제외 목록 전체를 확인한 카드만 '목록에 없음 = 인정').
  - **카드 목록 데이터**: 원본은 `public/catalog-snapshot.json`이고, 앱은 빌드 때 여기서 만든 `card-list.json`(목록·상세 공통)·`card-search.json`(목록 검색)만 받습니다. 요약 카드에서 새 필드를 읽으려면 `scripts/card-list.mjs`의 `LIST_FIELDS`에 추가하세요.
  - **사이트 전환 메뉴**(로고 옆 ▾): Mr. Stocks·Hotels·Travel은 `assets/js/main.js`, Mr. Cards는 `components/customer-shell.tsx`에 있습니다. 문구를 바꾸거나 사이트를 추가하면 두 곳을 같이 고치세요.
- **Mr. Hotels**: `hotels/` 폴더, `/my-website/hotels/`에 배포. 메뉴는 **티어 · 호텔 · 이벤트** 세 가지(`index.html` · `list.html` · `events.html`)이며 헤더·하단 탭바는 Mr. Stocks와 같은 마크업을 각 HTML에 복사해 씁니다. 화면은 `assets/js/hotels.js`(body의 `data-page`로 분기), 스타일은 `portfolio.css`의 `wl-*`(탭·목록·타일)에 `assets/css/hotels.css`를 더합니다.
  - 등급 기준·혜택·제휴카드는 `hotels.js`의 `P`(등급별 `card`, 프로그램별 `cards`·`cardNote`), 호텔별 조식·라운지·룸업글 여부와 메모는 `flags`, 호텔 목록은 `hotels/directory.json`, 이벤트는 `hotels/events.json`(공식 프로모션을 요약해 화면에서 바로 읽게 함. `endsAt`이 지난 행사는 자동으로 숨김)에서 고칩니다.
  - 호텔 화면: 국가·도시·나의 등급을 고르면 `호텔명 | 성급 | 위치 | 조식 | 라운지 | 룸업글`을 핑크 점으로 보여 줍니다. 대표 이미지는 호텔의 `image` → `hotels/images.json` → `same`(다른 체인 목록의 같은 호텔) 순서로 찾고, 없거나 깨지면 성급 타일을 보여 줍니다.
  - `hotels/images.json`은 배포 때 `tools/hotels/images.py`가 `image`가 없는 호텔(Marriott, HOTELLUX 독립 호텔은 `site`)의 공식 페이지 og:image를 찾아 채웁니다. 실패해도 배포는 계속됩니다.
  - 선택한 프로그램·등급은 브라우저 `mrhotels.program`, `mrhotels.tier.<프로그램>`에 저장해 세 화면이 같이 씁니다.
  - **발레파킹**(`hotels/valet.html`, `assets/js/hotel-valet.js`·`hotel-valet.css`): ① 가진 카드 고르기(카드사 탭·검색) → ② 카드마다 지난달 실적 채웠는지·카드 브랜드 선택 → ③ 무료 발레 되는 호텔(가능·실적 채우면·안 됨, 구 칩 필터, 펼치면 무료 시간·횟수·조건·제시물). 선택은 브라우저 `mrhotels.valet.v2`(`{카드사|카드명: {brand, met}}`)에 저장하고 예전 `mrhotels.valet.cards`는 처음 열 때 옮깁니다. 데이터는 `hotels/valet.json`(카드사 공식 안내), 판정은 `assets/js/valet-rules.js`(Mr. Cards와 공유). Mr. Cards에서 `valet.html?card=카드ID&hotel=호텔ID`로 넘어옵니다.
- **Mr. Travel**: `travel/` 폴더, `/my-website/travel/`에 배포. 메뉴는 **혜택 · 여행지** 두 가지(`index.html` · `places.html`)이며 헤더·하단 탭바는 Mr. Stocks와 같은 마크업을 각 HTML에 복사해 씁니다. 화면은 `assets/js/travel.js`(body의 `data-page`로 분기), 스타일은 `portfolio.css`의 `wl-*`에 `assets/css/travel.css`를 더합니다.
  - **혜택**: `travel/benefits.json`은 배포 때 `tools/travel/benefits.py`가 Mr. Cards 데이터(`paymorevent/data/events.json`, `cards.json.gz`)에서 해외·여행 혜택만 골라 만듭니다(마감 지난 행사 제외). 나라 키워드가 없으면 **공통**, 있으면 **나라별**(코드는 `places.json`의 id, 지역 묶음 `EU`·`SEA`·`APAC`)이고, 트래블카드는 카드 DB에서 수수료 면제·라운지 여부를 읽습니다. 분류 키워드는 `benefits.py`의 `PLACES`·`TYPES`에서 고칩니다. 원본 행사가 갱신되려면 Mr. Cards 이벤트 데이터를 갱신하세요.
  - **여행지**: `travel/places.json`(나라별 월별 시즌 `season` 0=비수기·1=보통·2=성수기, 왕복 항공권 `air`·5성급 1박 `hotel` 참고 시세(만원), 비행시간·시차·통화·입국 조건)을 직접 고칩니다. 바꾸면 `checked` 날짜도 고치세요. 지도는 `travel/world.json`(태평양 중심 Natural Earth 선 지도)이며 `tools/travel/world.mjs`로 다시 만듭니다. 핀 위치는 `travel.js`의 `project()`가 같은 투영식으로 계산합니다.
  - 마지막으로 고른 나라는 브라우저 `mrtravel.place`에 저장합니다. 혜택 화면 `index.html#place-JP`, 여행지 화면 `places.html#JP`처럼 주소로 바로 열 수 있습니다.
- **데이터 수집(이벤트·호텔·카드 상품)**: 외부 AI·사람은 큰 DB를 직접 고치지 않고 `data/inbox/<card-events|hotel-events|card-products>/YYYY-MM-DD-<출처>.json`만 추가하는 PR을 올립니다. 양식과 순서는 `docs/data-update.md`. PR 검사는 `.github/workflows/data-check.yml`(`tools/data/inbox.py validate`), 배포 때 `tools/data/inbox.py merge`가 이벤트 DB에 합칩니다(커밋 안 함). `card-products`는 검토 대기열이라 자동 반영하지 않습니다.
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
assets/js/travel.js    Mr. Travel (혜택 · 여행지 지도)
travel/               Mr. Travel 페이지와 데이터 (benefits.json은 배포 때 생성, places.json·world.json은 직접 관리)
tools/travel/benefits.py Mr. Cards 데이터 → travel/benefits.json
tools/travel/world.mjs   세계지도 → travel/world.json (지도 바꿀 때만)
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
