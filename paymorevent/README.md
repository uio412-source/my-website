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

카드 검색은 `public/catalog-snapshot.json`을 사용합니다. 카드 상세는 `data/cards.json.gz`, 이벤트는 `data/events.json`을 기준으로 빌드합니다. 데이터를 갱신할 때 카드 목록과 상세의 ID가 일치해야 합니다.

GitHub Pages에서 제공하는 기능은 검색과 조회입니다. (호텔 혜택 메뉴는 2026-11에 제거했습니다.) 로그인·게시글·댓글·관리자 저장은 서버가 필요한 기능입니다.
