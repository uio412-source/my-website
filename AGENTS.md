# AI 작업 지침 (Claude · ChatGPT · Gemini 공통)

이 저장소를 수정하는 모든 AI 도구와 사람은 아래 규칙을 따릅니다.

## 프로젝트 개요
- **Mr. Stocks**: 줍줍 지표 차트와 관심종목 시세을 보여 주는 **정적 웹사이트**입니다. 빌드 도구나 프레임워크 없이 HTML, CSS, JS만 씁니다.
- 모바일 우선입니다. 폭 720px 이하에서는 위 메뉴 대신 하단 탭바(차트 · 관심종목 · 배당)가 나옵니다.
- **명언 배너**: Mr. Stocks 차트 페이지(`ungjup.html`) 맨 위 `<div id="qroll">`에만 '공포에 사라' 취지의 투자자 명언이 7초마다 바뀝니다(`assets/js/quotes.js`의 `QUOTES`, 스타일은 `style.css`의 `.qroll`). 마우스를 올리거나 키보드 포커스면 멈추고, 누르면 다음. 명언은 출처(주주서한·인터뷰·책)를 `src`에 적고, 출처가 확인 안 된 말은 `by`에 '…의 말로 알려짐', `src`에 '출처 확인 안 됨'으로 적습니다. 명언마다 말한 사람의 사진을 `img`에 적으면 배너 왼쪽에 원형 사진으로 함께 나오고(사진이 없거나 못 불러오면 글자만), 사진은 `assets/img/quotes/`에 두며 출처·라이선스는 같은 폴더의 `CREDITS.md`에 적습니다.
- **Mr. Cards**(옛 이름 페이모먼트): 같은 저장소의 `paymorevent/` 폴더에 있는 카드 혜택 사이트로 `/my-website/paymorevent/`에 배포됩니다. 메뉴는 **카드상품 검색 · 발급이벤트 · 카드사 이벤트 · 내 혜택** 네 가지입니다(호텔 기능은 제거, 주소 `#cards`·`#cashback`·`#events`·`#mine`). React·Vite로 빌드하며(`npm ci`, `npm run build`), 링크·이미지 경로는 `lib/site-path.ts`의 함수를 씁니다. 헤더·하단 탭바·글꼴·색은 Mr. Stocks와 같게 `paymorevent/app/mr-cards.css`와 `components/customer-shell.tsx`에서 맞춥니다.
  - **화면**(2026-11 개편): 목록 `components/catalog.tsx`(카드상품 검색·발급이벤트·카드사 이벤트), 상세 `pages/card-detail.tsx`(표준 양식: 머리(큰 카드 이미지·카드사·이름) → 기본 정보 표(종류·연회비·전월실적·최고 피킹률) → 혜택 격자 표(카드사 상품설명서처럼 `구분 | 적용처 | 혜택 | 한도·조건`, 묶음은 가로 머리줄, '통합' 한도는 세로로 합친 칸, 기본 정보와 같은 전월실적은 칸마다 되풀이하지 않음. 한 줄은 `mc-text.ts`의 `benefitRow`) → 피킹률 표 → 결제별 인정 표 → 이벤트 표 → 원문(접힘). 모든 정보는 같은 표 모양 `.cd-t`로만 보여 주고 설명 문단·카드 소개 문구(DB `description`)는 쓰지 않습니다. 이름 앞 카드사명은 빼고 위에 따로 표시)·`pages/event-detail.tsx`(카드 상세와 같은 머리 + 정보 표 + 참여 조건 번호 목록, 기간만 되풀이하는 조건 줄은 뺌), 공통 조각 `components/mc-ui.tsx`(필터 `Chips`는 줄마다 왼쪽에 이름이 붙고, `issuers`면 카드사 타일 칩), 스타일 `app/mc.css` 하나. 카드상품 검색의 혜택 태그는 여러 개 고를 수 있습니다(고른 태그를 **모두** 만족하는 카드만, 고른 칩은 ✓ 표시, 다시 누르면 해제, '전체'는 모두 해제). 상품권·관리비·국세·지방세·호텔 등급을 여러 개 고르면 카드 줄의 이유도 태그마다 한 줄씩 붙습니다. 목록 혜택 칩은 상세 혜택 표와 같은 말(`highlights` → `benefitRow`의 '구분 값')을 씁니다. 공무원·교육청·국민행복·법인·학생증처럼 가입 대상이 정해진 카드는 `mc-text.ts`의 `RESTRICTED`로 추천순에서 아래로 내리고 '가입 대상 제한'을 붙입니다. DB 원문을 화면용으로 거르는 규칙(혜택이 아닌 안내 항목 숨김, 빈 값 "확인 중" 표시 안 함, 이벤트 요약 문구)과 검색(여러 단어·초성·동의어·이름 우선 점수)은 `lib/mc-text.ts`에 있습니다.
  - **광고성 이벤트는 안 보임**(`lib/ad-events.ts`의 `isAd`, 제목 기준): 보험 가입·보험료 조회·보장분석 상담, 대출·리볼빙·분할납부·할부금융·투자·연금 등 금융상품, 통신·인터넷·멤버십·구독 가입·상담·견적·대리점, 여행사 패키지(하나투어·모두투어 …)·해외직구 쿠폰(알리·테무)·가전·교육 제휴, 홍보·정보성 글(MD 추천·라방·기부·운세·마케팅 수신 동의 …). `pages/main.tsx`가 이벤트를 받자마자 빼서 목록·상세·내 카드·비교 어디에도 안 나옵니다. 보험료·요금 **자동납부·자동이체**와 카드 자체 **무료 보험**은 남깁니다. Mr. Travel 혜택·여행준비도 같은 규칙(`tools/travel/ads.py`, 바꾸면 둘 다)으로 뺍니다.
  - **카드사 이벤트**(2026-11-24 개편, `lib/event-view.ts` · `components/event-row.tsx`): 카드사 목록에서 제목·기간만 긁어 온 이벤트가 많아서, 제목(없으면 요약)에서 **혜택**(`eventValue`: '최대 3만원 캐시백'·'10% 즉시할인'·'무이자 최대 6개월'·'1+1'·'추첨 경품', 금액은 원·$·엔 환산해 정렬), **분야**(`FIELDS`: 쇼핑·해외·여행·외식·카페·생활·납부·교통·차·문화·레저·페이·포인트·무이자 할부·기타, 키워드는 `FIELD_RX`), **가맹점**(`MERCHANTS`), 응모 여부·대상 카드(모르면 `null`)를 뽑습니다. 광고 문구·카드사 자기 이름·HTML 엔티티는 `cleanTitle`이 지웁니다.
    - 목록 한 줄: 이름(제목에서 혜택을 뗀 나머지) → 혜택(빨강) → 카드사·분야·응모·대상·결제 경로 → D-day. 혜택을 떼어 내지 못한 제목은 제목 안의 숫자 부분만 강조(같은 말을 두 줄로 쓰지 않음). 마감순일 때는 '3일 안·일주일 안·한 달 안·한 달 넘게'로 묶고, 혜택 큰 순은 금액 → % → 나머지 순. 같은 카드사·제목·마감일 중복은 하나만.
    - 상세: 이름 → 혜택(크게) → 기간·참여·대상 표(모르는 값은 '카드사 안내 확인'으로, 단정하지 않음) → 받는 조건(카드사 상세·수집기가 정리한 이벤트만) → 대상 카드 → **같은 가맹점의 다른 카드사 이벤트**(혜택 큰 순) → 같은 카드사의 같은 분야 이벤트. 제목·기간만 아는 이벤트는 그렇다고 한 줄 알림.
    - 맨 위 확인일은 카드사마다 달라서 가장 오래된 날~최근 날로 보여 줍니다.
  - **내 혜택**(메뉴 이름, 화면 제목은 '내 카드 이벤트 모아보기', 2026-11-25, `#mine`, `components/mine.tsx` · `lib/my-benefits.ts`): 가진 카드를 등록하면(브라우저 `mrcards.mine`, 최대 12장, `lib/my-cards.ts`의 `toggleMine`) 그 카드로 지금 받을 수 있는 카드사 이벤트(`kind: 'card'`, 발급 이벤트는 이미 가진 카드라 뺌)를 **카드별로 묶어** 보여 줍니다. 등록은 맨 위 카드 찾기(영어 카드명은 `mc-text.ts`의 `koReading`으로 한글 읽기도 검색: '딥드림' → Deep Dream, '케이패스' → K-패스, 초성 가능, 끝의 '카드'는 무시, 같은 상품의 다른 이름도 찾음, 전체 카드 목록을 받은 뒤에 찾음) 또는 카드 상세의 `+ 내 카드` 버튼(같은 상품의 다른 변형이 등록돼 있으면 등록된 것으로 봄).
    - 판정(`myEvents`): 광고성(`isAd`)과 **새로 발급·첫 이용 회원 대상 홍보**(`isIssuePromo`: 연회비 캐시백·면제, 출시 기념, '한번 써보세요', 카드 신청하고 …)는 뺍니다(이미 가진 카드라 해당 없음). **대상 확인** = 같은 상품의 브랜드·디자인 변형까지 넣어 `offerApplies`가 참(대상 카드로 적힘·카드사 전체 대상). **확인 필요** = 같은 카드사 이벤트인데 공지에 대상 카드가 안 적힘(`cardTarget`·`cardIds`·`cardNames` 모두 없음). 이 중 문구로 빠지는 건 `textExcludes`가 뺍니다: 체크카드는 '체크…제외' 목록·'개인 신용카드'만 적힘·무이자 할부·제목의 신용카드 전용, 신용카드는 '신용…제외'·제목의 체크카드 전용, 브랜드를 아는 카드는 제목에 다른 브랜드(Visa·Mastercard·아멕스·유니온페이·JCB)만 있으면. 다른 카드 전용 이벤트는 안 보임. 같은 카드사·제목·마감일은 하나만(대상 확인 쪽을 남김).
    - 화면: 카드 찾기 → 카드마다 묶음(카드 이미지·이름·이벤트 수·7일 안 마감 수, 오른쪽 +/− 단추로 접고 펼침, 펼친 카드는 브라우저 `mrcards.mine.open`에 기억) → 펼치면 이벤트 줄(분야 아이콘 · 이름 · 혜택 · D-day, 대상 카드로 적힌 이벤트는 위로 올리고 '내 카드' 표시, 6건 뒤 '더 보기') → 카드 상세·발레파킹 N곳·빼기. 통계·필터·설명 문단은 두지 않습니다(텍스트 최소). 카드가 없으면 한 줄 안내 + 카드 찾기.
  - **카드 화면 보강**(2026-11-21):
    - 상세 머리: 발급 캐시백 배지(진행 중 최대 금액·D-day) · 월 최대 혜택 배지, 버튼 `카드사에서 신청 · 상품설명서 · 비교 담기 · 공유`. 기본 정보 표에 '월 최대 혜택' 줄. 휴대폰 폭(520px 이하)에서는 혜택 표를 3칸(구분+적용처 작은 글씨 | 혜택 | 한도·조건)으로 그립니다.
    - **내 지출로 계산**(피킹률 표 아래, `lib/card-value.ts`의 `benefitAt`): 한 달 지출(30·50·100·150·200만원·직접 입력)을 고르면 한 달·1년 혜택, 연회비, 1년 남는 돈. 그 금액 안에서 채울 수 있는 가장 큰 피킹률 구간 또는 국내 기본율 × 지출(실적 조건·월 한도 지킴) 중 큰 값.
    - **비슷한 카드**(`similarCards`): 같은 신용·체크, 비슷한 연회비에서 혜택 영역(`browseThemes`)이 겹치는 카드 4장.
    - **카드 비교**(`components/compare.tsx`): 목록 줄·상세·비슷한 카드의 `+ 비교`로 최대 3장 담고, 화면 아래 비교함에서 표로 비교(연회비·전월실적·피킹률·주요 혜택·상품권/관리비/세금·호텔 등급·발레·이벤트). 비교함과 **최근 본 카드**(목록 위)는 브라우저 `mrcards.compare`·`mrcards.recent`에만 저장(`lib/my-cards.ts`, 내 혜택의 `mrcards.mine`도 같은 곳).
    - 목록 줄은 이름 링크가 줄 전체를 덮는 구조(`.mc-stretch`)라 줄 안에 버튼을 둘 수 있습니다. 세로 카드 이미지는 `CardArt`가 가로로 눕혀 보여 줍니다. 목록·비교의 전월실적은 `spendShort`(혜택별 실적 중 가장 작은 값, 상세와 같은 기준)로 씁니다.
  - **다크 모드**: Mr. Stocks와 같은 `theme` 저장값을 같이 씁니다(한쪽에서 바꾸면 다른 쪽도 같음). 색은 `app/mr-cards.css`의 `--mc-*` 변수만 쓰고(`app/mc.css`에 색 값을 직접 쓰지 마세요), 다크 값은 `scripts/dark-theme.mjs`의 `tokens`에서 `app/mr-cards-dark.css`로 생성합니다. 변수를 추가·변경했다면 `paymorevent/`에서 `npm run theme`을 실행해 함께 커밋하세요.
  - **첫 화면 속도**: `pages/main.tsx`는 화면(목록·카드 상세·이벤트 상세)과 큰 데이터(`data/events.json`, `data/home-cards.json`)를 `import()`로 나눠 받습니다. 이 파일들을 다시 맨 위 `import`로 불러오지 마세요(첫 화면 JS가 다시 2.5MB가 됩니다).
  - **피킹률**(`lib/catalog-model.ts`의 `pickingOptions`): 놀이공원·스포츠 경기·골프·호텔 예약사이트처럼 이용률 낮은 혜택은 `NICHE_PICKING`으로 빼고, 구독·멤버십은 월 3만원까지만 쓴다고 봅니다. 할인받은 결제가 전월실적에서 빠지는 카드는 그 결제를 실적 밖에서 더 쓴다고 보고 분모에 더합니다. 손으로 검수한 수정(한도·통합한도·실적 제외)은 `data/picking-review.json`에 이유와 함께 적으면 빌드 때 덮어씁니다.
  - **이렇게 써도 될까?**(`lib/card-themes.ts`의 `PAYMENT_CHECKS`·`paymentCheck`): 관리비·4대보험·국세·지방세·공과금·자동차 구매·상품권·등록금·월세·무이자할부·혜택받은 결제. 상품권·관리비·세금은 저장된 판정을, 나머지는 원문 제외 목록에서 찾습니다(제외 목록 전체를 확인한 카드만 '목록에 없음 = 인정'). 카드 단위 저장 판정(`paymentEligibility`)이 있으면 범위별 규칙(`eligibilityRules`)보다 먼저이고, 규칙은 판정이 '미확인'인 항목만 채웁니다(`paymentVerdict`) — 상품설명서의 계산 예시 문장이 '가능' 규칙으로 파싱돼 하나 CLUB H가 상품권 가능으로 보이던 문제(2026-11-25 수정)를 막기 위한 규칙입니다. 목록의 **쓰임 필터**(`card-themes.ts`의 `useFit`)는 실제로 써서 남는 게 있는 카드만 보여 주고, 카드 줄에 이유를 한 줄로 붙입니다(예: "혜택 O · 기본 1% 적립", "실적 O · 전월 30만원 채우기"):
    - 국세·지방세: 혜택 O + 국내 전 가맹점 기본 적립·할인(`generalReward`)
    - 상품권(상테크)·관리비: 혜택 O + 기본 혜택(관리비는 관리비 전용 할인도), 또는 실적 O + 채울 전월실적·연간 실적 혜택. 가입 대상 제한 카드(`RESTRICTED`)는 뺌. 관리비 전용 할인 → 혜택 O → 실적만 O 순서로 정렬
    - 호텔 등급: 호텔 멤버십 등급을 주는 카드만(`HOTEL_TIERS`, Mr. Hotels `hotels.js`의 `P.*.cards`와 같은 내용이니 같이 고치세요)
    - 혜자카드·교통·쇼핑·커피 필터는 없앴습니다(검색어로는 그대로 찾힘).
  - **카드 브랜드 이름 통일**(`lib/network-brand.ts`): 카드 DB의 `brands`는 카드사 표기 그대로라(제이씨비·유피아이·UPI·Union Pay(K-WORLD)·S&·URS·더블류 …) 앱이 카드를 읽을 때(`pages/data.ts`·`main.tsx`) 결제망 이름 하나로 바꿉니다: Mastercard · Visa · American Express(신한 S& 포함) · JCB(신한 URS·NH 더블류 = JCB 네트워크) · UnionPay(유피아이·UPI·K-WORLD) · Diners Club · 국내전용(우리카드 'BC' 포함). BC Global·L·Global은 그대로. 연회비 줄의 브랜드 이름도 `brandText`로 같게 씁니다. 새 표기가 생기면 `networkBrand`에 넣으세요.
  - **카드 목록 데이터**: 원본은 `data/catalog-snapshot.json`이고, 앱은 빌드 때 여기서 만든 `card-list.json`(목록·상세 공통)·`card-search.json`(목록 검색)만 받습니다. 요약 카드에서 새 필드를 읽으려면 `scripts/card-list.mjs`의 `LIST_FIELDS`에 추가하세요.
  - **사이트 전환 메뉴**(로고 옆 ▾): Mr. Stocks·Hotels·Travel은 `assets/js/main.js`, Mr. Cards는 `components/customer-shell.tsx`에 있습니다. 문구를 바꾸거나 사이트를 추가하면 두 곳을 같이 고치세요.
- **Mr. Hotels**: `hotels/` 폴더, `/my-website/hotels/`에 배포. 메뉴는 **호텔 · 이벤트 · 발레파킹** 세 가지(`index.html` · `events.html` · `valet.html`, 예전 `list.html`은 `index.html`로 넘어감)이며 헤더·하단 탭바는 Mr. Stocks와 같은 마크업을 각 HTML에 복사해 씁니다. 화면은 `assets/js/hotels.js`(body의 `data-page`로 분기), 스타일은 `portfolio.css`의 `wl-*`(탭·목록·타일)에 `assets/css/hotels.css`를 더합니다.
  - 등급 기준·혜택·제휴카드는 `hotels.js`의 `P`(등급별 `card`, 프로그램별 `cards`·`cardNote`), 호텔별 조식·라운지·룸업글 여부와 메모는 `flags`, 호텔 목록은 `hotels/directory.json`, 이벤트는 `hotels/events.json`(공식 프로모션을 요약해 화면에서 바로 읽게 함. `endsAt`이 지난 행사는 자동으로 숨김)에서 고칩니다. 이벤트 카드의 조건 줄(`points`)은 위 예약·투숙 기간을 되풀이만 하는 줄은 빼고 2줄까지 보이고 나머지는 '조건 N개 더 보기'로 접힙니다(`hotels.js`의 `pointList`).
  - **호텔 지도**(`index.html`, `data-page="map"`, `hotels.js`의 `mapPage`): Mr. Travel 세계지도처럼 **전세계 → 나라 → 도시 → 동네** 순서로 들어가는 지도 중심 검색기. 거품 숫자는 호텔 수이고, 겹치는 거품은 합치며(누르면 확대), 이름표는 빈 자리(아래·위·오른쪽·왼쪽)에만 붙이고 자리가 없으면 숨깁니다(이름은 지도 아래 칩에). 동네 단계에서는 호텔 핀(숫자는 성급, 나의 등급에서 조식이나 라운지가 되면 진한 핑크, 룸업글만이면 테두리, 없으면 회색)을 동네 중심 둘레에 놓고, 핀이나 목록 줄을 누르면 카드(사진·성급·1박 평균가·등급별 조식·라운지·룸업글 표·다른 예약 경로·공식 페이지)가 열립니다. 주소는 `?at=나라/도시/동네#프로그램`.
    - 위치: 호텔 `area`(동네)를 `hotels/areas.json`의 `cities.<도시>.areas` 좌표에 맞춥니다(이름이 다르면 `alias`). 정확한 좌표가 있으면 `areas.json`의 `hotels`에 `"프로그램:호텔id": [위도, 경도]`로 넣으면 그 자리에 찍힙니다. 새 도시는 `cities`에 `country`·`place`(`travel/places.json` id)·`box`(서·남·동·북)·`areas`를 넣고 `tools/hotels/map.py`로 `hotels/map.json`(도시·나라 땅·강·서울 구 경계)을 다시 만들어 커밋하세요(준비물은 파일 맨 위 설명).
    - 1박 평균가: 호텔에 `price`(만원)·`priceAt`(날짜)이 있으면 그 값을, 없으면 "수집 전"과 5성급이면 `travel/places.json`의 도시 5성급 1박 참고 범위를 보여 줍니다.
  - **등급표**: 오른쪽 위 `등급표` 단추로 여는 창(`tierDialog`). 프로그램별 등급 달성 방법·보너스·조식/라운지/업그레이드/체크아웃·국내 제휴카드. 등급 줄을 누르면 나의 등급으로 저장되고 지도에 바로 반영됩니다.
  - 지도 아래 목록: 나라·도시 단계는 도시 카드, 도시·동네 단계는 `호텔명 | 성급 | 위치 | 조식 | 라운지 | 룸업글`을 핑크 점으로 보여 줍니다. 대표 이미지는 호텔의 `image` → `hotels/images.json` → `same`(다른 체인 목록의 같은 호텔) 순서로 찾고, 없거나 깨지면 성급 타일을 보여 줍니다.
  - `hotels/images.json`은 배포 때 `tools/hotels/images.py`가 `image`가 없는 호텔(Marriott, HOTELLUX 독립 호텔은 `site`)의 공식 페이지 og:image를 찾아 채웁니다. Marriott·리츠칼튼 공식 페이지는 봇을 막아(403) og:image를 못 읽는 경우가 많아, 그때는 호텔 코드·슬러그로 공식 사진 목록(`…/photos/jcr:content.roomimages.json`, Scene7 사진 주소)을 대신 읽습니다. 실패해도 배포는 계속됩니다.
  - 선택한 프로그램·등급은 브라우저 `mrhotels.program`, `mrhotels.tier.<프로그램>`에 저장해 지도·등급표·이벤트가 같이 씁니다.
  - **발레파킹**(`hotels/valet.html`, `assets/js/hotel-valet.js`·`hotel-valet.css`): ① 가진 카드 고르기(카드사 탭·검색, 카드가 10장 넘으면 고른 카드 먼저 8장만 보이고 '더 보기', 제휴 호텔 확인 중인 카드는 개수만 보이고 눌러서 펼침) → ② 카드마다 지난달 실적 채웠는지·카드 브랜드 선택 → ③ 무료 발레 되는 호텔(조건 없이 무료·이용 시 무료·금액 조건·실적 채우면·안 됨, 지도, 구 칩 필터, 펼치면 무료 시간·횟수·조건·제시물, '다른 카드'는 8종까지 보이고 '+N종 더'). 선택은 브라우저 `mrhotels.valet.v2`(`{카드사|카드명: {brand, met}}`)에 저장하고 예전 `mrhotels.valet.cards`는 처음 열 때 옮깁니다. 데이터는 `hotels/valet.json`(카드사 공식 안내), 판정은 `assets/js/valet-rules.js`(Mr. Cards와 공유). Mr. Cards에서 `valet.html?card=카드ID&hotel=호텔ID`로 넘어옵니다.
    - **조건 없이 무료만** 스위치(`hv-clean`, 브라우저 `mrhotels.valet.clean`): 상품설명서·브랜드 서비스 안내에 **호텔 이용(투숙·식음료 매장) 없이 무료**라고 적힌 곳만 보여 줍니다(전월실적은 채워야 함). 판정은 `valet-rules.js`의 `valetNoUse`(프로그램 `useRequired === false`일 때만, 값이 없으면 이용 필요로 봄)와 `valetExtra`(호텔별 추가 조건: `hotelOverrides.<호텔>.minReceipt`(원) → 메모의 '이상 영수증'·'호텔별 조건' 문구 → 프로그램 `receiptByHotel: true`). 상태는 조건 없이 무료 · 이용 시 무료(당일 투숙·식음료 이용) · 금액 조건(이용 + 영수증 최소금액) · 실적 채우면. 2026-11-24 현재 `valet.json`의 카드 안내는 모두 이용이 필요(`useRequired: true`)해서 스위치를 켜면 0곳입니다. 수집 데이터는 `hotel_valet`의 `useRequired`(docs/data-update.md)를 `inbox.py`가 옮깁니다. 호텔 이름은 `valet.json` 호텔의 `name`·`aliases`와 맞춰 연결하니, 안내문 표기가 다르면 그 호텔에 별칭을 넣으세요. 같은 카드사·브랜드·등급이라도 **안내문마다 대상 호텔이 다르면 각각 따로** 남기고(카드마다 자기 안내의 호텔만 표시), 같은 안내문을 다시 수집했을 때는 **대상 호텔이 더 많은 쪽**을 남깁니다. 카드 이름은 안내문마다 표기가 달라도('신한카드 The BEST+'='The BEST+', 'BeV III'='BeV Ⅲ 카드') 카드사명·'카드'·™®·기호·대소문자를 뺀 이름(`inbox.py`의 `card_key` = `hotel-valet.js`의 `cardNorm`, '+'는 남김)으로 **한 장으로 묶고**, 카드 DB id(`catalogId`)는 정확한 이름 → 느슨한 이름(카드 DB에서 한 장으로만 맞을 때) 순서로 찾아 Mr. Cards 카드 상세·'호텔 발레' 필터와 연결합니다. 예전 저장값(표기가 다른 카드키)은 묶인 카드로 옮깁니다.
    - **지도**: `hotels/map.json`의 서울 구 경계·강과 `proj`(위도·경도 → 지도 좌표, world.json과 같은 값. `tools/hotels/map.py`가 같이 씀) 위에 호텔 핀. 핀 위치는 `valet.json` 호텔의 `ll`([위도, 경도], 주소 기준 대략 위치)이고 없으면 구 가운데 둘레에 놓으니 새 호텔은 `ll`을 넣어 주세요(넣은 점이 그 구 경계 안에 드는지 확인). 핀 색은 조건 없이 무료(초록)·이용 시 무료와 금액 조건(초록 테두리)·실적 채우면(노랑 테두리)·안 됨(회색), 카드를 안 고르면 파랑. 겹치는 핀은 숫자 거품(누르면 확대), 끝까지 확대해도 겹치는 같은 건물·단지는 둘레에 펼칩니다. 구를 누르거나 구 칩을 고르면 그 구로 확대, 핀을 누르면 아래 말풍선(→ 목록에서 조건 보기).
    - 호텔 지도와 연결: `valet.json` 호텔의 `directory`(`프로그램:호텔id`, `hotels/directory.json` 키)가 있으면 호텔 지도 카드에 '무료 발레파킹 · 카드 N종' 줄이 생겨 `valet.html?hotel=호텔ID`로 넘어가고, 발레 목록 펼침의 '호텔 지도에서 등급 혜택 보기'는 `./?at=한국/서울/구&h=프로그램:호텔id`로 그 호텔 카드를 엽니다(`hotels.js`가 `h`를 읽고 주소에서 지움).
- **Mr. Travel**: `travel/` 폴더, `/my-website/travel/`에 배포. 메뉴는 **혜택 · 여행지 · 여행준비** 세 가지(`index.html` · `places.html` · `prep.html`)이며 헤더·하단 탭바는 Mr. Stocks와 같은 마크업을 각 HTML에 복사해 씁니다. 화면은 `assets/js/travel.js`(body의 `data-page`로 분기), 스타일은 `portfolio.css`의 `wl-*`에 `assets/css/travel.css`를 더합니다.
  - **혜택**: `travel/benefits.json`은 배포 때 `tools/travel/benefits.py`가 Mr. Cards 데이터(`paymorevent/data/events.json`, `cards.json.gz`)에서 해외·여행 혜택만 골라 만듭니다(마감 지난 행사 제외). 나라 키워드가 없으면 **공통**, 있으면 **나라별**(코드는 `places.json`의 id, 지역 묶음 `EU`·`SEA`·`APAC`)이고, 트래블카드는 카드 DB에서 수수료 면제·라운지 여부를 읽습니다. 분류 키워드는 `benefits.py`의 `PLACES`·`TYPES`에서 고칩니다. 화면의 필터 줄은 왼쪽에 이름(종류·카드사·나라)이 붙은 한 상자(Mr. Cards와 같은 모양)이고, 제목 앞 `[카드사x제휴처]` 꼬리표는 제휴처만 남깁니다. 목록 줄은 제목·카드사·종류 태그·D-day만(카드사 원문 요약 문장은 안 씀), 공통·한 나라는 15건, 나라별 묶음은 3건씩 보여 주고 '더 보기'. 나라 묶음 안에서는 그 나라 태그를 빼고 보여 줍니다. 원본 행사가 갱신되려면 Mr. Cards 이벤트 데이터를 갱신하세요.
  - **여행지**: `travel/places.json`(나라별 월별 시즌 `season` 0=비수기·1=보통·2=성수기, 왕복 항공권 `air`·5성급 1박 `hotel` 참고 시세(만원), 비행시간·시차·통화·입국 조건)을 직접 고칩니다. 바꾸면 `checked` 날짜도 고치세요. 상세의 월별 칸 아래 항공권·5성급 1박 월별 참고가(만원)는 나라에 `airM`·`hotelM`(12칸 배열)이 있으면 그 값을, 없으면 `air`·`hotel` 범위를 시즌에 맞춰 나눈 추정값(비수기 15%·보통 35%·성수기 60% 지점)을 보여 줍니다. 지도는 `travel/world.json`(태평양 중심 Natural Earth 선 지도)이며 `tools/travel/world.mjs`로 다시 만듭니다. 핀 위치는 `travel.js`의 `project()`가 같은 투영식으로 계산합니다.
  - 마지막으로 고른 나라는 브라우저 `mrtravel.place`에 저장합니다. 혜택 화면 `index.html#place-JP`, 여행지 화면 `places.html#JP`처럼 주소로 바로 열 수 있습니다.
  - **여행준비**(`prep.html`): 1 항공권 예매 → 2 호텔 예약 → 3 공항 이동 → 4 면세점 → 5 공항 라운지 순서. `travel/prep.json`은 배포 때 `tools/travel/prep.py`가 카드사 이벤트(`events.json`, inbox 합친 뒤)·카드 DB·`hotels/events.json`에서 만듭니다. 분류 키워드는 `prep.py`의 `RX`, 항공사·면세점 공식 사이트 목록은 `AIRLINES`·`DUTY_FREE`. 라운지는 카드 이름(한·영 동의어)으로 찾고 '해외 공항(귀국편)'·'국내 공항'으로 거릅니다(PP·라운지키·전 세계 문구면 해외). 카드사 이벤트 줄에는 원문 요약을 안 쓰고(호텔 체인·항공사·면세점 자체 행사만 한 줄), 라운지 카드는 서비스 2줄까지 한 줄씩 말줄임.
- **데이터 수집**: 외부 AI·사람은 큰 DB를 직접 고치지 않고 `data/inbox/<종류>/YYYY-MM-DD-<출처>.json`만 추가하는 PR을 올립니다. 양식·찾는 요령·실행 한도·하루 순서(매일 카드사 이벤트·상품공시실·상품설명서 10종, 토요일 여행 이벤트·브랜드 서비스)는 `docs/data-update.md`. PR 검사는 `.github/workflows/data-check.yml`(`tools/data/inbox.py validate`), 배포 때 `tools/data/inbox.py merge`가 합칩니다(결과는 커밋 안 함).
  - **자동 머지**(`.github/workflows/data-automerge.yml` → `tools/data/automerge.py`): `ai/chatgpt/data-*` 브랜치 PR이 열리면 10분 기다린 뒤, 바뀐 파일이 전부 `data/inbox` 새 JSON이고 main의 `inbox.py validate`를 통과하면 머지하고 배포(`deploy.yml`)를 직접 실행합니다(GITHUB_TOKEN 머지는 push 배포를 안 일으켜서). 안 맞으면 머지하지 않고 PR에 이유를 댓글로 남기며, 3시간마다 놓친 PR을 다시 봅니다. `pull_request_target`이라 PR 쪽 코드는 실행하지 않습니다. 이 두 파일을 고칠 때 이 원칙(PR에서는 inbox JSON만 가져옴)을 지키세요. 머지 뒤에는 수집 대기열(`data/collect-queue.json`)을 다시 만들어 그 파일만 커밋합니다(실패해도 머지·배포에는 영향 없음).
  - 종류: `card-events`·`hotel-events`(이벤트 DB) · `travel-events`(항공사·면세점·공항 자체 이벤트 → `travel/vendor-events.json`, 여행준비) · `brand-services`(국제브랜드·카드사 선택 서비스: 호텔 발레·공항 라운지·공항 커피 등 → `paymorevent/data/brand-services.json`, 서울 호텔 발레는 `hotels/valet.json`에도 자동 추가) · `card-terms`(상품설명서 표준 정리 → `paymorevent/data/card-terms.json`) · `card-products`(검토 대기열, 자동 반영 안 함).
  - 무엇을 먼저 모을지는 `data/collect-queue.json`(수집 대기열, `tools/data/queue.py`로 생성·커밋). 수집 파일에 대기열 key를 `queueKey`로 적으면 다음 실행 때 건너뜁니다. 카드사·도메인 목록과 서비스 분류는 `inbox.py`의 `ISSUERS`·`CARD_DOMAINS`·`SERVICE_CATS`에서 고칩니다.
  - **여러 에이전트 조율**: ChatGPT·Pickle·Claude가 함께 모읍니다. 시작 전에 대기열(`todo`만)·`data/inbox/`의 key·열린 PR(`gh pr list --state open`) 셋을 확인하는 규칙과 에이전트별 파일·브랜치 접미사(Pickle은 `-pickle`)는 `docs/data-update.md` 9장에 있습니다. **무엇이 됐고 무엇이 안 됐는지(사유·재시도 방법)는 공용 현황판 `docs/agent-sync.md`에 모입니다** — 시작 전에 잠금·실패 로그를 보고, 끝나면 `data/agent-notes/<내 파일>.json`에 적고 `python tools/data/agent_sync.py`로 갱신합니다. 수집 PR을 머지한 뒤 `automerge.py`가 대기열을 따로 만들어 그 파일만 담은 PR을 곧바로 머지합니다(대기열이 낡아 같은 항목을 또 모으는 일 방지).
- `main` 브랜치에 merge되면 GitHub Actions(`.github/workflows/deploy.yml`)가 GitHub Pages로 자동 배포합니다.
- **매일 개선**: Claude가 매일 한 건 이상 개선·확장을 골라 PR → 머지 → 배포 확인까지 진행합니다. 사이트별 목적·고르는 기준·후보·한 일은 `docs/roadmap.md`에 있고, 작업할 때마다 그 파일을 같이 고칩니다.

## 폴더 구조
```
index.html            ungjup.html로 이동만 함
ungjup.html           차트 (지수별 줍줍 구간·줍줍LV, 참고자료)
holdings.html         관심종목 (시세·등락률·줍줍LV·뉴스)
dividend.html         배당 (보유 종목별 예상 배당금·배당률, 월별 배당, 금융소득종합과세 한도)
wealth.html           이전 주소에서 관심종목으로 이동
assets/css/style.css  공통 스타일·색상 변수 (색은 :root 변수에서만 변경)
assets/css/ungjup.css 차트 페이지 스타일
assets/css/portfolio.css 관심종목 페이지 스타일 (배당 페이지도 목록·시트·타일에 함께 씀)
assets/css/dividend.css 배당 페이지 스타일
assets/js/main.js     공통 스크립트
assets/js/quotes.js   Mr. Stocks 차트(ungjup.html) 맨 위 명언 배너 (관심종목·배당에는 없음)
assets/img/quotes/    명언 배너 인물 사진(출처·라이선스는 CREDITS.md)
assets/js/ungjup.js   차트 (캔버스, 외부 라이브러리 없음)
assets/js/covered.js  차트 하단 '커버드콜 vs 본주' 기간별 총수익 비교
assets/js/watchlist.js 관심종목 페이지
assets/js/dividend.js  배당 페이지
assets/js/travel.js    Mr. Travel (혜택 · 여행지 지도 · 여행준비)
travel/               Mr. Travel 페이지와 데이터 (benefits.json은 배포 때 생성, places.json·world.json은 직접 관리)
tools/travel/benefits.py Mr. Cards 데이터 → travel/benefits.json
tools/travel/prep.py     Mr. Cards·Hotels 데이터 → travel/prep.json (여행준비)
tools/travel/world.mjs   세계지도 → travel/world.json (지도 바꿀 때만)
tools/data/inbox.py      수집 파일(data/inbox) 검사·배포 때 합치기
tools/data/automerge.py  수집 PR(ai/chatgpt/data-*) 검사 후 자동 머지·배포 실행
tools/data/queue.py      수집 대기열 → data/collect-queue.json
tools/data/agent_sync.py 에이전트 현황판 → docs/agent-sync.md · data/agent-status.json
data/agent-notes/     에이전트별 작업 기록(chatgpt·claude·pickle.json — 자기 파일만 고침)
tools/ungjup/build.py 데이터 생성기 (Yahoo Finance → data/ungjup/*.json)
tools/ungjup/extras.py 종목 검색 목록(symbols.json)·종목별 뉴스(news.json) 생성
tools/ungjup/dividends.py 종목별 최근 12개월 주당 배당금(dividends.json) 생성
tools/ungjup/covered.py   커버드콜 vs 본주 종가·분배금(covered.json) 생성
data/watchlist.json   기본 관심종목 목록 (종목명과 티커)
data/dividend_extra.json (선택) 배당 데이터를 꼭 계산할 추가 티커 목록 ["SCHD", "005930.KS"]
data/ungjup/          생성된 지수 데이터, 종목별 시세·LV(holdings_lv.json), 줍줍LV 기준표(lv_model.json), symbols.json, news.json
assets/img/           이미지
```

## 작업 규칙
**작업 전·후 공통 (모든 AI 도구)**: 시작 전에 `docs/agent-sync.md`·`data/agent-status.json`(잠금·실패 로그·다음 시작점)·`data/collect-queue.json`(`todo`만)·`data/inbox/`의 key·열린 PR(`gh pr list --state open`)을 확인합니다. 끝나면 `data/agent-notes/<내 이름>.json`(chatgpt·claude·pickle)에 한 일·실패·잠금을 적고 `python tools/data/agent_sync.py`로 현황판을 갱신해 같은 PR에 넣습니다. 브랜치·파일 접미사 규칙과 기록 형식은 `docs/data-update.md` 9장에 있습니다.

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
- **금융소득종합과세 한도**(보유 종목 아래, `dividend.js`의 `ftItems`·`ftCompute`, 2026년 지급분 국내 세법): 보유 종목의 세전 연 배당금을 분류해 2,000만원 판정 금액·남은 한도와, 넘으면 비교과세(종합과세 방식 vs 금융소득 전체×14%) 기준 5월 추가 세금(지방세 포함 추정)을 보여 줍니다. 입력: 예금·채권 이자, 국내상장 해외·기타 ETF 매도 차익, 다른 종합소득 과세표준(모두 만원). 설정은 브라우저 `mrstocks.dividend.fintax`에만 저장.
  - 분류(`autoKind`, 종목별로 바꿀 수 있음): 국내 주식(배당가산 대상) · 리츠·인프라 · **국내 커버드콜 ETF**(국내 옵션 이익 비과세 → 과세 비중만 합산, 기본값은 기초지수 배당 연 2% ÷ 분배율로 추정 `KR_DIV_YIELD`, 증권사 '과세표준'으로 고칠 수 있음) · 국내상장 ETF(해외지수 커버드콜 포함 전액 과세) · 해외 주식·ETF(ROC 포함 전액, 외국납부세액공제 추정). ETF는 이름 앞 운용사 브랜드(`ETF_BRAND`), 해외 여부는 `FOREIGN_RX`로 판단.
  - 계좌가 ISA·연금이면 제외, 국내 주식은 '고배당기업 분리과세 신청'을 켜면 2,000만원 판정에서 빼고 14·20·25·30% 누진으로 따로 계산.
  - 세율 상수: 원천징수 14%, 배당가산율 `GROSS` 10%(2027년 지급분부터 11%로 바꿀 것), 기본세율 `BRACKETS`, 고배당 분리과세 `SEP`. 세법이 바뀌면 이 상수와 아래 안내 문구(`renderFtNotes`)를 같이 고치세요.

## 커버드콜 vs 본주 (차트 하단)
- 묶음: 코스피200(KODEX 200 · KODEX 200타겟위클리커버드콜 · TIGER 200타겟위클리커버드콜) · 나스닥100(QQQ · GPIQ · JEPQ · QQQI) · S&P500(SPY · JEPI · SPYI). 화면 종목명은 상장 정식 명칭 그대로 씁니다(휴대폰에서는 종목명이 한 줄 전체를 쓰고 길면 줄바꿈). 종목·묶음은 `tools/ungjup/covered.py`의 `GROUPS`만 고치면 됩니다(색은 `covered.js`의 `COLORS` 순서, 한 묶음 최대 5개). `asset`은 위 지수 카드 id로, 그 카드를 고르면 같은 묶음이 열립니다(사용자가 다른 묶음을 직접 고르면 따라가지 않음).
- `covered.py`는 `build.py` 마지막 단계에서 실행되어 `data/ungjup/covered.json`(배포 때 생성, 커밋 안 함)을 만듭니다: 묶음 안에서 **가장 먼저 상장한 커버드콜**의 상장일부터 본주 거래일에 맞춘 종가(배당 미반영)와 배당락일 분배금. 늦게 상장한 종목은 상장 전이 `null`이고 `first`(첫 거래일 위치)를 따로 가지므로, 종목을 새로 넣어도 다른 종목의 비교 기간이 줄지 않습니다. 화면은 기간 시작일에 아직 상장 전인 종목을 그래프에서 빼고 목록에 "상장이라 이 기간은 비교 못 해요", 표에 '–'로 보여 줍니다. 커버드콜 하나를 못 받으면 그 종목만 빼고(본주를 못 받으면 묶음 전체를 지난 데이터로 유지), 파일이 없으면 화면에서 이 구역을 숨깁니다.
- 화면(`assets/js/covered.js`): 기간(1·3·6개월·올해·1·3년·상장후, 함께 거래된 이력이 모자라면 비활성) → 총수익 선 그래프 → 종목별 총수익·본주 대비 %p·주가·분배금 몫·최대낙폭 → 기간별 총수익 표(열을 누르면 그래프 기간 변경). 총수익은 분배금을 배당락일 종가에 재투자한 세전 기준, 미국 ETF는 달러 기준. 선택은 브라우저 `mrstocks.cc`에 저장.
- **줍줍구간 배당 재매수**(기간 버튼 옆 on/off, `mrstocks.cc`의 `dip`): 켜면 묶음의 모든 종목을 "분배금을 바로 사지 않고 연 3%(`covered.js`의 `RATE`, 달력일 복리) 현금으로 모았다가, 위 지수 카드의 진한 핑크 줍줍 구간(zone 2)인 날 종가에 모아 둔 현금을 전부 산다(구간 안에서 받은 분배금은 그날 바로), 끝의 남은 현금은 이자 포함 평가"로 다시 계산합니다(`dipSim`). 그래프에 줍줍 구간을 핑크로 칠하고, 종목별로 바로 재투자 대비 %p · 줍줍 매수 횟수 · 남은 현금 비중을 보여 주며 기간별 표도 같은 방식으로 바뀝니다. 줍줍 구간은 `covered.py`가 같은 배포에서 `build.py`가 쓴 `data/ungjup/<asset>.json`의 `z`를 읽어 `dip`(공통 거래일 위치 `[시작, 끝]` 범위)으로 넣습니다. 없으면 스위치가 비활성.

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
- **머리줄 새로고침 버튼**(`main.js`, 테마 버튼 왼쪽): 누르면 캐시를 건너뛰고(`?v=시각`, `cache: no-store`) 서버의 최신 데이터 파일을 다시 받아 지금 화면을 그대로 다시 그립니다. 결과는 토스트로 알려 주고, 이미 최신이면 GitHub Actions 배포 페이지(지금 다시 계산) 링크를 보여 줍니다.
  - 페이지 스크립트는 데이터를 `window.MS.getJSON(url)`로 불러오고, `datarefresh` 이벤트를 받으면 `e.detail.tasks.push(Promise)`로 다시 그리는 작업을 넣으세요. 이벤트 연결은 한 번만 하세요(다시 그릴 때 중복되지 않게).
- **배포 버전 도장**: 배포 때 `tools/stamp_version.py`가 모든 HTML에 `<meta name="mrs-build">`와 CSS·JS 주소의 `?v=커밋`을 붙이고 `version.json`을 만듭니다. `main.js`가 페이지를 열 때·탭으로 돌아올 때·새로고침 버튼을 누를 때 `version.json`과 비교해, 브라우저에 옛 페이지가 남아 있으면 한 번 자동으로 새로 불러옵니다. 그러니 HTML에 `?v=2` 같은 버전을 직접 붙이지 마세요.
- 다크/라이트 모드는 오른쪽 위 버튼으로 바꾸며 `<html data-theme>`과 localStorage에 저장됩니다. 색을 추가할 때는 `style.css`의 다크 블록 두 곳(시스템 설정용, `data-theme="dark"`용)에 모두 넣으세요.

## 로컬 미리보기
```
python3 -m http.server 8000
```
브라우저에서 http://localhost:8000 을 엽니다.
