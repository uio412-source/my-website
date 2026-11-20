# Paymorevent 페이모먼트

국내 카드상품, 카드사 이벤트, 호텔 체인 혜택을 하나의 카탈로그로 검색하는 정보 서비스입니다.

## 데이터 기준

2026-10-05 공식 공개 자료 기준 22개 카드사·은행, 1,536개 상품코드 기록(신용 1,111 / 체크 425), 혜택 5,390개, 이벤트 및 공식 목록 21개를 수록합니다. 제휴·디자인·채널별 상품코드 변형을 포함합니다. 현재 발급 가능한 국내 전체 상품의 전수 검증 완료를 의미하지 않습니다.

- `data/cards.json`: 전체 규격화 상품 상세. 본인카드 최저 명목 연회비와 브랜드별 원문, 혜택별 조건, 실적/혜택 제외, 공식 출처 및 문서 링크.
- `data/events.json`: 기간이 확인된 개별 이벤트와 공식 목록을 구분합니다.
- `data/coverage.json`: 기관별 공개 목록 수집 범위와 제한.
- `data/provenance.json`: 원자료 출처와 연구 그룹 기록.
- `data/summaries.json`, `public/catalog-snapshot.json`: 검색 및 목록용 요약과 전체 혜택 검색 문자열.
- `data/revision.json`: 상세·이벤트 스냅샷 해시. 운영 DB 갱신 판단에 사용합니다.

미확인 금액은 null입니다. 전월실적 제외와 할인·적립 제외를 분리하며, 가족카드 연회비나 조건부 면제를 본인 기본 연회비로 사용하지 않습니다. 발급 대상이 제한된 상품은 상세에서 자격을 표시합니다. 혜택 해시태그는 원자료와 긍정적인 혜택 설명을 바탕으로 정규화합니다.

## 실행 및 저장

Vinext / React / Cloudflare Worker / D1(SQLite) 구성입니다.

```bash
pnpm install
pnpm dev
pnpm exec tsc --noEmit
pnpm build
```

D1 스키마 변경은 `db/schema.ts`와 `drizzle/*.sql`의 생성된 마이그레이션으로 관리합니다. 런타임은 스키마를 생성하지 않습니다. API는 버전 해시가 바뀔 때 저장된 공식 스냅샷을 D1에 upsert하고, 상품·이벤트·해시태그를 유지합니다. 목록 초기 응답은 24개이며 전체 검색 목록을 즉시 불러옵니다. 상품 상세는 `/api/cards/:id`로 읽습니다.

## 갱신

새 공식 자료를 수집·검증한 연구 그룹 JSON에 대해 다음 명령으로 규격화 파일을 재생성한 뒤 타입 검사, 빌드, DB/상세 API 검증을 거쳐 배포합니다.

```bash
python scripts/merge-catalog.py /absolute/research-directory
```

자동 수집 스케줄은 설정되어 있지 않습니다. 출처 확인일과 이벤트 기간을 UI에 표시하며, 종료 여부는 한국 시간의 현재 날짜로 판단합니다. 공식 이벤트 목록 자체에는 할인율이나 임의의 종료일을 부여하지 않습니다.

카드 발급과 혜택 제공은 해당 카드사·호텔에서 이루어집니다. Paymorevent는 독립 정보 서비스입니다.

## 상세 페이지와 이미지

목록의 상품명·이미지·상세 보기는 브라우저 기본 링크로 같은 창의 `/cards/:id`로 이동합니다. 클라이언트 라우터의 Flight 요청을 기다리지 않습니다. 카드의 빈 영역도 상세 링크의 클릭 영역이며, 해시태그 버튼은 별도로 유지합니다. 개별 URL 직접 접속을 지원하며 상세 표는 서버에서 렌더링됩니다. 상세 페이지는 배포된 공식 자료 스냅샷을 읽으므로 목록 API 초기화나 팝업에 의존하지 않습니다.

공식 카드 이미지는 `public/cards/`에 저장하고 `data/card-images.json`의 ID별 공용 경로로 목록과 상세에서 재사용합니다. 확보하지 못한 이미지의 값은 null이며, 이를 임의의 카드 이미지로 대체하지 않습니다. `public/brands/`의 결제 브랜드 로고는 목록과 상세에서 공통 컴포넌트로 표시합니다. `data/brand-assets.json`에 출처를 보존합니다. 국내전용은 특정 결제망을 뜻하지 않으므로 공용 안내 배지로 표시합니다.

혜택은 할인·적립률, 전월실적, 한도·횟수 표로 정리하고, 긴 원문과 전체 조건은 각 행의 펼치기에서 보존합니다. 모바일에서는 표의 혜택 행을 세로 항목으로 표시합니다.

빌드 후 `node scripts/check-card-pages.mjs`는 브라우저 미리보기 없이 실제 Worker의 상세 경로·404·공용 로고·카드 이미지 응답을 검증합니다.

`app/responsive.css`는 기본 스타일 뒤에서 PC·태블릿·모바일 레이아웃을 조정합니다. 넓은 PC 목록은 3열, 중간 화면은 2열, 760px 이하는 1열입니다. 1,100px 미만에서는 조건 필터를 별도 패널에서 표시합니다. 상세 혜택 표는 760px 이하에서 세로 항목으로 바뀌며, 480px 이하에서는 터치 영역·글자 크기·안전 영역을 조정합니다.

## Card database source snapshots

The full card records and extracted official-document corpus are tracked losslessly as `data/cards.json.gz` and `data/document-research.json.gz`. This avoids the source repository's per-object size limit. The editable JSON copies are ignored; card-data scripts restore missing copies automatically. To restore them explicitly, run `node scripts/ensure-card-data.mjs`. The build runner synchronizes edited copies back into the compressed snapshots before publishing. Runtime data still uses the existing compressed `card-seed.json`; after card edits, run `node --import ./scripts/typescript-paths.mjs scripts/rebuild-database.mjs` and `node --import ./scripts/typescript-paths.mjs scripts/refresh-presentation-data.mjs` before building. Document source text is retained in full; customer search summaries omit document bodies.
