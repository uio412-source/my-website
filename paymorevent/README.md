# Mr. Cards

(폴더 이름과 주소는 예전 이름인 `paymorevent`를 그대로 씁니다.)

카드상품 검색 · 발급이벤트 · 카드사 이벤트 세 가지를 제공하는 GitHub Pages 사이트입니다.

`main`에 변경을 병합하면 저장소의 GitHub Pages 워크플로가 빌드하고 `/my-website/paymorevent/`에 배포합니다. 카드 상세와 이벤트 상세는 개별 주소로 열 수 있습니다.

```bash
npm ci
npm run dev
npm run build
npm run theme   # app/*.css의 색을 바꾼 뒤 다크 모드 파일(app/mr-cards-dark.css) 다시 만들기
```

카드 검색 목록의 원본은 `public/catalog-snapshot.json`입니다. 카드 상세는 `data/cards.json.gz`, 이벤트는 `data/events.json`을 기준으로 빌드합니다. 데이터를 갱신할 때 카드 목록과 상세의 ID가 일치해야 합니다.

화면은 원본 대신 빌드할 때 원본에서 만든 가벼운 파일 두 개를 내려받습니다(`scripts/card-list.mjs`, 개발 서버에서도 같은 내용을 제공).

- `card-list.json`: 목록·필터·정렬, 상세 화면의 같은 카드 묶음과 연결 이벤트가 읽는 필드만 담습니다. 결제 항목별 인정 여부는 실적·혜택 판정만 남깁니다.
- `card-search.json`: 검색창이 대조하는 카드별 문구(`searchText`)입니다. 목록 화면만 받습니다.

목록이나 상세 화면에서 요약 카드의 새 필드를 읽게 되면 `scripts/card-list.mjs`의 `LIST_FIELDS`에 추가하세요. 빠진 필드는 요약 카드에서 비어 있습니다.

호텔 혜택 기능은 2026-11에 제거했습니다. 카드 검색의 호텔 칩·`#호텔` 해시태그·'호텔제휴' 필터를 없앴고, 호텔·리조트가 직접 주는 혜택 이벤트(호텔 체인 할인, 특급호텔 다이닝·스파, 객실 패키지, 호텔 멤버십 등급)는 `lib/hotel-offers.mjs`의 기준으로 이벤트 목록과 상세 주소에서 뺍니다. 아고다·호텔스닷컴·트립닷컴 같은 여행 예약 사이트 할인, 여행사·면세점·골프장 이벤트, 카드 발급 이벤트는 남깁니다. `events.json`은 그대로 두므로 기준만 고치면 되돌릴 수 있습니다.

GitHub Pages에서 제공하는 기능은 검색과 조회입니다. 로그인·게시글·댓글·관리자 저장은 서버가 필요한 기능입니다.
