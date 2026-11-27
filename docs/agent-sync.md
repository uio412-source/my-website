# 🤝 GPT · Claude · Pickle 공용 작업 현황판

_자동 생성 2026-11-27 10:17 KST · `python tools/data/agent_sync.py` · 기계용 JSON은 [`data/agent-status.json`](../data/agent-status.json)_

> **작업 시작 전에 이 파일과 `data/agent-status.json`, `data/collect-queue.json`(`todo`만), `data/inbox/`의 key, 열린 PR을 봅니다.**
> **끝나면 `data/agent-notes/<내 파일>.json`에 한 일·실패·다음 시작점을 적고 `python tools/data/agent_sync.py`를 돌립니다.**
> 이 파일과 `data/agent-status.json`은 스크립트가 만드니 손으로 고치지 마세요(다음 실행 때 덮어씁니다).

## 1. 에이전트별 이름표 — 브랜치·파일이 겹치지 않게

| 에이전트 | 기록 파일(내 것만 고침) | 브랜치 | 수집 파일 이름 | 수집 PR 자동 머지 |
|---|---|---|---|---|
| **ChatGPT** (예약 작업·Dot) | `data/agent-notes/chatgpt.json` | `ai/chatgpt/data-YYYY-MM-DD` | `YYYY-MM-DD-<출처>.json` (접미사 없음) | 됨(마지막 커밋 10분 뒤) |
| **Claude** | `data/agent-notes/claude.json` | `ai/claude/<작업내용>` | `YYYY-MM-DD-<출처>-claude.json` | 안 됨(사람·에이전트가 확인 후 머지) |
| **Pickle** | `data/agent-notes/pickle.json` | 수집 `ai/chatgpt/data-YYYY-MM-DD-pickle*` · 코드·문서 `ai/pickle/<작업내용>` | `YYYY-MM-DD-<출처>-pickle.json`, 같은 날 두 번째부터 `-pickle2`·`-pickle3` | 수집 PR만 됨 |

- **`-pickle`은 Pickle만, `-claude`는 Claude만 씁니다.** 접미사 없는 수집 파일은 ChatGPT 것입니다.
- 접미사는 영문 소문자·숫자·하이픈만. 같은 날 같은 출처를 둘이 모아도 파일 이름이 달라 겹치지 않습니다.
- Pickle의 수집 브랜치는 `ai/chatgpt/data-`로 시작해야 자동 머지 대상이 됩니다. 커밋을 다 올린 뒤 PR을 엽니다.
- 새 에이전트가 들어오면 `ai/<이름>/…` 브랜치와 `data/agent-notes/<이름>.json`을 씁니다(표에 줄을 더하세요).

### 영역 (같은 파일을 둘이 동시에 고치지 않기)

| 영역 | 기본 담당 | 규칙 |
|---|---|---|
| `data/inbox/**` | ChatGPT · Pickle (수집) | 파일 이름 접미사로 분리(위 표). 다른 에이전트가 같은 종류·출처를 모을 때도 접미사를 다르게 |
| `docs/roadmap.md` | 그날 작업한 에이전트 | 자기 작업이 끝날 때 한 일만 덧붙임(기존 줄 수정 금지) |
| `paymorevent/**` · `hotels/**` · `travel/**` · `assets/**` · `*.html` | Claude (코드) | 고치기 전에 잠금 표시. 같은 파일이 열린 PR에 있으면 그 PR이 머지된 뒤에 |
| `tools/data/**` · `docs/data-update.md` · `README.md` · `AGENTS.md` | 누구나 | 작은 변경만, 잠금 표시하고 한 PR에 한 가지 |
| `data/collect-queue.json` | `tools/data/queue.py`만 | 손으로 고치지 않음(수집 PR 머지 뒤 자동 갱신) |
| `data/agent-notes/<에이전트>.json` | 그 에이전트만 | 남의 파일은 읽기만 |
| `docs/agent-sync.md` · `data/agent-status.json` | `tools/data/agent_sync.py`만 | 손으로 고치지 않음 |

## 2. 최근 PR · 업데이트 이력 (KST)

| PR | 에이전트 | 내용 | 반영 시각 | 영역(파일) | 상태 |
|---|---|---|---|---|---|
| [#200](https://github.com/uio412-source/my-website/pull/200) | Pickle | data: 수집 2026-11-27 30차 (신한카드 상품설명서 10종) | 2026-11-27 10:16 | 1파일 · data/inbox/card-terms 1 | 머지 |
| [#199](https://github.com/uio412-source/my-website/pull/199) | Pickle | docs: 수집 대기열·공용 현황판 갱신 (2026-11-27 Pickle #198 반영) | 2026-11-27 10:11 | 4파일 · data/ 3 · docs/ 1 | 머지 |
| [#198](https://github.com/uio412-source/my-website/pull/198) | Pickle | data: 수집 2026-11-27 29차 (신한카드 상품설명서 10종) | 2026-11-27 10:10 | 1파일 · data/inbox/card-terms 1 | 머지 |
| [#197](https://github.com/uio412-source/my-website/pull/197) | Pickle | docs: 수집 대기열·공용 현황판 갱신 (2026-11-27 Pickle #196 반영) | 2026-11-27 10:04 | 4파일 · data/ 3 · docs/ 1 | 머지 |
| [#196](https://github.com/uio412-source/my-website/pull/196) | Pickle | data: 수집 2026-11-27 28차 (신한카드 상품설명서 10종) | 2026-11-27 10:03 | 1파일 · data/inbox/card-terms 1 | 머지 |
| [#195](https://github.com/uio412-source/my-website/pull/195) | Pickle | docs: 수집 대기열·공용 현황판 갱신 (2026-11-27 Pickle #194 반영) | 2026-11-27 09:58 | 4파일 · data/ 3 · docs/ 1 | 머지 |
| [#194](https://github.com/uio412-source/my-website/pull/194) | Pickle | data: 수집 2026-11-27 27차 (신한카드 상품설명서 10종) | 2026-11-27 09:57 | 1파일 · data/inbox/card-terms 1 | 머지 |
| [#193](https://github.com/uio412-source/my-website/pull/193) | Pickle | docs: 수집 대기열·공용 현황판 갱신 (2026-11-27 Pickle #192 반영) | 2026-11-27 09:51 | 4파일 · data/ 3 · docs/ 1 | 머지 |
| [#192](https://github.com/uio412-source/my-website/pull/192) | Pickle | data: 수집 2026-11-27 26차 (신한카드 상품설명서 10종) | 2026-11-27 09:50 | 1파일 · data/inbox/card-terms 1 | 머지 |
| [#191](https://github.com/uio412-source/my-website/pull/191) | Pickle | docs: 수집 대기열·공용 현황판 갱신 (2026-11-27 Pickle #190 반영) | 2026-11-27 09:45 | 4파일 · data/ 3 · docs/ 1 | 머지 |
| [#190](https://github.com/uio412-source/my-website/pull/190) | Pickle | data: 수집 2026-11-27 25차 (신한카드 상품설명서 10종) | 2026-11-27 09:44 | 1파일 · data/inbox/card-terms 1 | 머지 |
| [#189](https://github.com/uio412-source/my-website/pull/189) | Pickle | docs: 수집 대기열·공용 현황판 갱신 (2026-11-27 Pickle #188 반영) | 2026-11-27 09:38 | 4파일 · data/ 3 · docs/ 1 | 머지 |
| [#188](https://github.com/uio412-source/my-website/pull/188) | Pickle | data: 수집 2026-11-27 24차 (NH농협카드 상품설명서 10종) | 2026-11-27 09:37 | 1파일 · data/inbox/card-terms 1 | 머지 |
| [#187](https://github.com/uio412-source/my-website/pull/187) | Pickle | docs: 수집 대기열·공용 현황판 갱신 (2026-11-27 Pickle #186 반영) | 2026-11-27 09:32 | 4파일 · data/ 3 · docs/ 1 | 머지 |
| [#186](https://github.com/uio412-source/my-website/pull/186) | Pickle | data: 수집 2026-11-27 23차 (NH농협카드 상품설명서 10종) | 2026-11-27 09:31 | 1파일 · data/inbox/card-terms 1 | 머지 |
| [#185](https://github.com/uio412-source/my-website/pull/185) | Pickle | docs: 수집 대기열·공용 현황판 갱신 (2026-11-27 Pickle #184 반영) | 2026-11-27 09:25 | 4파일 · data/ 3 · docs/ 1 | 머지 |
| [#184](https://github.com/uio412-source/my-website/pull/184) | Pickle | data: 수집 2026-11-27 22차 (NH농협카드 상품설명서 10종) | 2026-11-27 09:24 | 1파일 · data/inbox/card-terms 1 | 머지 |
| [#183](https://github.com/uio412-source/my-website/pull/183) | Pickle | docs: 수집 대기열·공용 현황판 갱신 (2026-11-27 Pickle #182 반영) | 2026-11-27 09:18 | 4파일 · data/ 3 · docs/ 1 | 머지 |
| [#182](https://github.com/uio412-source/my-website/pull/182) | Pickle | data: 수집 2026-11-27 21차 (NH농협카드 상품설명서 10종) | 2026-11-27 09:17 | 1파일 · data/inbox/card-terms 1 | 머지 |
| [#181](https://github.com/uio412-source/my-website/pull/181) | Pickle | docs: 수집 대기열 갱신 (#179 반영) | 2026-11-27 09:12 | 1파일 · data/ 1 | 머지 |
| [#179](https://github.com/uio412-source/my-website/pull/179) | Pickle | data: 수집 2026-11-27 20차 (NH농협카드 상품설명서 10종) | 2026-11-27 09:11 | 1파일 · data/inbox/card-terms 1 | 머지 |
| [#180](https://github.com/uio412-source/my-website/pull/180) | Pickle | docs: 수집 대기열·공용 현황판 갱신 (2026-11-27 Pickle #179 반영) | 2026-11-27 09:09 | 3파일 · data/ 2 · docs/ 1 | 머지 |
| [#178](https://github.com/uio412-source/my-website/pull/178) | Pickle | docs: 수집 대기열·공용 현황판 갱신 (2026-11-27 Pickle #177 반영) | 2026-11-27 09:06 | 4파일 · data/ 3 · docs/ 1 | 머지 |
| [#177](https://github.com/uio412-source/my-website/pull/177) | Pickle | data: 수집 2026-11-27 19차 (NH농협카드 상품설명서 10종) | 2026-11-27 09:05 | 1파일 · data/inbox/card-terms 1 | 머지 |
| [#176](https://github.com/uio412-source/my-website/pull/176) | Pickle | docs: 수집 대기열·공용 현황판 갱신 (2026-11-27 Pickle #175 반영) | 2026-11-27 09:00 | 4파일 · data/ 3 · docs/ 1 | 머지 |

_(최근 25건만. 전체는 `data/agent-status.json`의 `recentPRs`.)_

## 3. 지금 진행 중 · 잠금 · 다음 시작점

### 잠금 (작업 중인 영역 — 끝나면 `lock`을 `null`로 비웁니다)

_지금 잠근 영역이 없습니다._

### 열린 PR

| PR | 에이전트 | 브랜치 | 만든 시각 | 영역(파일) | 내용 |
|---|---|---|---|---|---|
| [#173](https://github.com/uio412-source/my-website/pull/173) | ChatGPT | `ai/chatgpt/fix-accor-meapac-booki…` | 2026-11-27 08:46 | 1파일 · hotels/ 1 | fix(hotels): 아코르 아태 세일 예약 마감 정정 |

### 수집 대기열 (`data/collect-queue.json`, built 2026-11-27)

대기열은 만든 시점 기준입니다. `data/inbox/`에 key가 있으면 이미 한 항목이니 그 key는 빼고 고릅니다. `built`가 최근 수집 PR보다 이르면 inbox에 이미 있는 key가 `todo`로 남아 있을 수 있습니다 — 그럴 때는 `python tools/data/queue.py`로 갱신해 PR 하나로 올립니다.

- **다음 시작점** — cards `samsung-aap1483` · brandPrograms `shinhan-mastercard-titanium`
- **남은 카드** 1021 / 1447종 · **브랜드 프로그램** todo 50 · valet-only 3 / 94개 · **이벤트 출처** 한 번이라도 모은 곳 9 / 30곳
- **최근 수집일** — card-terms 2026-11-27 · brand-services 2026-11-27 · card-events 2026-11-27 · hotel-events 없음 · travel-events 없음 · card-products 2026-11-26

### 에이전트별 마지막 반영

| 에이전트 | 기록 파일 | 마지막 머지 PR | 반영 시각 | 다시 볼 것(open/workaround) |
|---|---|---|---|---|
| ChatGPT | `data/agent-notes/chatgpt.json` | - | - | 0건 |
| Claude | `data/agent-notes/claude.json` | #174 data: 수집 2026-11-27 (Claude · 하나카… | 2026-11-27 08:54 | 10건 |
| Pickle | `data/agent-notes/pickle.json` | #200 data: 수집 2026-11-27 30차 (신한카드 상품설… | 2026-11-27 10:16 | 33건 |

## 4. 실패 · 보류 · 제외 로그 (같은 삽질 금지)

상태 — `open` 다시 볼 것 · `workaround` 다른 경로로 처리함 · `resolved` 해결됨

### 다시 볼 것 (open) — 38건

- **2026-11-27 · Pickle · KB 나머지 상품설명서(kb-04285 스카이패스 티타늄·kb-09138 HERITAGE Classic·kb-09152 가온플래티늄·kb-09113/09114 KB Pay 챌린지·kb-09115/09116 AMEX Blue/Rose Gold)**
  - 사유: 마일리지·스탬프 표가 이미지이거나 여러 장에 걸쳐 있어 이번 회차에 확정하지 못함
  - 재시도: 표 페이지만 고해상도로 렌더해 값 확인 후 수집
- **2026-11-27 · Pickle · KB 상품설명서 3종(kb-09250 The Easy·kb-09561 WE:SH Travel·kb-09570 WE:SH Daily)**
  - 사유: 카드사가 지금 올려 둔 최신 판본이 2020-10-08·2024-09-23·2024-07-01 심의필이라 '올해·작년 문서' 규칙 밖
  - 재시도: 2025~2026년판이 올라오면 대기열 termsUrl(img2.kbcard.com/obj/card/download/<gdsno>__prdctOpmn_<날짜>.pdf)에서 교체
- **2026-11-27 · Pickle · KB 상품설명서 심의필 2024년 이전 6종(kb-09174 청춘대로 톡톡·kb-09061 굿데이·kb-09063 굿데이올림·kb-00235 에버온EV·kb-02065 국민행복·kb-02083 LG헬로비전Ⅱ)**
  - 사유: 카드사가 올린 최신 판본의 심의필이 2024년(또는 2022년)이라 '올해·작년 문서' 규칙 밖
  - 재시도: 2025~2026년판이 올라오면 img2.kbcard.com/obj/card/download/<gdsno>__prdctOpmn_<날짜>.pdf 에서 교체
- **2026-11-27 · Pickle · KB 상품설명서 이미지 PDF 6종(kb-07998 노리2 학생증·kb-09701 On the Go·kb-01664 노리·kb-09298 YOU Wish up·kb-09106 Biz Prime·kb-02066 국민행복체크)**
  - 사유: 텍스트 추출이 2~1,043자로 거의 안 됨(이미지 PDF), kb-02066은 혜택 표 없음
  - 재시도: fitz로 페이지를 PNG(폭 1400px)로 렌더해 눈으로 읽어 옮기기(회차당 2~3건씩)
- **2026-11-27 · Pickle · SC제일은행 가이드북 5종(sc-4420 신세계이마트·sc-4753 글로벌 체크·sc-5349 스페셜마일리지·sc-5944/5945 M/X CHECK·sc-6266 ZERO·sc-6273 대한항공 060·sc-6277 현대카드M)**
  - 사유: 카드별 혜택 표가 이미지이거나 여러 장에 흩어져 있어 이번 회차에 판독·정리하지 못함
  - 재시도: PDF 페이지를 PNG로 렌더해 표를 읽고 카드별로 나눠 수집
- **2026-11-27 · Pickle · hana-mastercard-world**
  - 사유: 같은 안내문의 호텔 객실·F&B 할인·골프·쇼핑 혜택은 hotel_benefit 등 별도 정리 필요
  - 재시도: 다음 회차에 다른 경로(상품설명서 PDF·상세 표)로 확인
- **2026-11-27 · Pickle · kb-01664 노리 체크 · kb-07998 노리2 학생증 · kb-02066 국민행복체크**
  - 사유: 이미지 PDF를 렌더해 봐도 혜택 표 판독이 어려움(kb-02066은 혜택 표 자체가 없음)
  - 재시도: 카드 상세 페이지의 혜택 표(텍스트)로 대체 수집
- **2026-11-27 · Pickle · kb-09298 YOU Wish up 체크카드**
  - 사유: 할인한도 표의 2구간(80만원) 칸이 병합돼 있어 구간별 한도를 확정할 수 없음
  - 재시도: 카드 상세 페이지 본문(할인한도 안내)으로 2구간 한도 확인
- **2026-11-27 · Pickle · kb-09821 마라톤카드 · kb-04131(요청 302 SCDSA002)**
  - 사유: 마라톤카드는 연회비 표가 이미지로만 있어 금액 확인 불가, kb-04131은 PDF가 아닌 안내 페이지 응답
  - 재시도: 마라톤카드는 홈페이지 카드 상세의 연회비 표(텍스트)로 확인, kb-04131은 카드 상세에서 상품설명서 링크 재확인
- **2026-11-27 · Pickle · nh-90010006**
  - 사유: nh-90000319 국민행복카드는 A/B/C 타입별 혜택이 한 페이지에 섞여 있어 제외
  - 재시도: 다음 회차에 다른 경로(상품설명서 PDF·상세 표)로 확인
- **2026-11-27 · Pickle · nh-90010033**
  - 사유: nh-90010003·nh-90000240 혜택 탭 없음, nh-90010461 영역별 적립률 표 판독 불가 — 상품공시실 PDF로 재확인
  - 재시도: 다음 회차에 다른 경로(상품설명서 PDF·상세 표)로 확인
- **2026-11-27 · Pickle · nh-90010058**
  - 사유: nh-90000239 국민연금증카드: 카드 상세에 혜택 표 없이 공통 확인사항만 있음 — 상품공시실 상품설명서로 재확인 필요
  - 재시도: 다음 회차에 다른 경로(상품설명서 PDF·상세 표)로 확인
- **2026-11-27 · Pickle · nh-90010490**
  - 사유: nh-90010565 이응패스-여민전: 카드 혜택 없이 지역화폐·교통패스 안내만 있음
  - 재시도: 다음 회차에 다른 경로(상품설명서 PDF·상세 표)로 확인
- **2026-11-27 · Pickle · nh-90010526**
  - 사유: nh-90010576 NH글로벌위드: 카드서비스 표 없이 상품안내장 링크만 — 다음 회차에 안내장 PDF 확인
  - 재시도: 다음 회차에 다른 경로(상품설명서 PDF·상세 표)로 확인
- **2026-11-27 · Pickle · nh-90010570**
  - 사유: nh-90000319·nh-90000320 국민행복카드: 국가 바우처 통합카드로 카드사 혜택 표 없음(피킹률 0 오표시 방지 위해 미수집)
  - 재시도: 다음 회차에 다른 경로(상품설명서 PDF·상세 표)로 확인
- **2026-11-27 · Pickle · nh-90010570 서울교육사랑카드**
  - 사유: 서비스 팩(쇼핑·일상·복지) 표가 병합 셀이라 영역별 월 할인한도를 개별 확인할 수 없음(온라인 쇼핑만 '월 1만원' 표기)
  - 재시도: 카드 상세의 팩별 상세 안내(또는 상품설명서 PDF)에서 영역별 할인한도 확인
- **2026-11-27 · Pickle · shinhan-201509030001**
  - 사유: 신한 상세 페이지는 실적·혜택 제외 항목을 항목화해 싣지 않아 제외 목록을 빈 배열로 두었음(상품설명서 PDF로 보완 필요)
  - 재시도: 다음 회차에 다른 경로(상품설명서 PDF·상세 표)로 확인
- **2026-11-27 · Pickle · 우리카드(95)·하나카드(111)·현대카드(100) 대기열 termsUrl**
  - 사유: 대기열이 가리키는 주소가 상품설명서가 아님 — 우리는 카드Clause HTML, 하나는 표준약관 PDF(credit_card_260512.pdf 45쪽), 현대는 브랜드 선택서비스 안내서
  - 재시도: 카드 상세(pc.wooricard.com·hanacard·hyundaicard)를 브라우저로 렌더해 '상품설명서' PDF 링크를 카드별로 다시 찾아 queue.py 입력 갱신
- **2026-11-27 · Pickle · 하나카드 선택서비스 5개 등급(hana-visa-platinum·mastercard-world-elite·amex-gold·amex-platinum-elite·amex-the-platinum)**
  - 사유: 카드 상세 7장(hana-9894·13913·17503·17766·17768·17811·10764)을 확인했으나 해당 등급 leaflet PDF가 없음(VP/ME/AG 계열 404). 2021년판 02768_20210208.pdf만 노출
  - 재시도: m.hanacard.co.kr/MKCDCM1000M.web?CD_PD_SEQ=… 페이지에 leaflet/[코드]/…pdf 링크가 있는 카드를 찾아 수집(현재 확인된 코드: MW·MP·MT·VS·VI·AP·UD)
- **2026-11-26 · Pickle · BC 인피니트 브랜드서비스 2026년판**
  - 사유: 공개된 BC INFINITE SERVICE GUIDE가 2025년판(2025-C1a-08892, 유효 2025-12-31)뿐이라 그대로 담고 validThrough 2025-12-31 표기
  - 재시도: vip.bccard.com의 2026년판 가이드 확인 후 같은 id(bc-visa-infinite)로 교체
- **2026-11-26 · Pickle · BC 플래티늄·다이아몬드 선택서비스 2026년판**
  - 사유: notice_20260522_1~3.pdf는 신구조문대비표라 2025(변경 전)·2026(변경 후) 열이 섞여 추출되고, vip.bccard.com 국내 발렛파킹 페이지는 2012년 문서라 쓸 수 없음
  - 재시도: vip.bccard.com 카드별 안내장 PDF 또는 개정 후 단일 판본을 받아 bc-mastercard-platinum·bc-visa-platinum 등으로 수집
- **2026-11-26 · Pickle · BC 후불하이패스 2종(bc-103132 SIM·bc-103183 카드형) 상품설명서**
  - 사유: 공개된 상품설명서가 2023-C1a-07886/07875(2023.07.18) 한 판본이고 혜택 표 없이 연회비(국내전용 2,000원)만 있음 — 올해·작년 문서 규칙 밖
  - 재시도: 카드사가 2025~2026년판을 올리면 같은 경로(bccard.com/down/individual/customer/<gdsno>.pdf)로 교체
- **2026-11-26 · Pickle · NH농협카드 Mastercard Platinum 안내문**
  - 사유: card.nonghyup.com/file/ebank/form/pdf/Mastercard_Platinum_250910.pdf 본문이 Mastercard World 안내문과 동일(심의필 2025-C1a-12536·12377)해 Platinum 자료로 쓸 수 없음
  - 재시도: NH농협카드 상품공시실에서 Platinum 전용 안내장을 찾아 교체. 없으면 대기열 key를 내리기
- **2026-11-26 · Pickle · NH농협카드 국제브랜드 안내문 2026년판**
  - 사유: 공개된 파일이 2025년판(심의필 2025-08-27·28, 유효 2025-12-31)뿐. 규칙상 작년 문서는 허용되어 그대로 담고 validThrough를 2025-12-31로 표기
  - 재시도: card.nonghyup.com/file/ebank/form/pdf/<Brand>_<Tier>_<YYMMDD>.pdf 규칙으로 2026년판 확인 후 같은 id로 교체
- **2026-11-26 · Pickle · card-events 롯데·NH농협·BC·IBK 이벤트 목록**
  - 사유: 이벤트 목록 표가 ajax로만 그려져 정적 HTML에 이벤트가 없음(bccard.com·card.nonghyup.com·lottecard.co.kr)
  - 재시도: 브라우저로 목록을 렌더한 뒤 상세 페이지까지 확인해 수집(66·67·68행 참고)
- **2026-11-26 · Pickle · samsung-aap1483 삼성카드 taptap O 등 삼성 상품설명서(대기열 맨 앞 10종)**
  - 사유: 삼성 카드 상세가 SPA(Nuxt)로 그려져 딥링크가 홈으로 리다이렉트. static11 파일명 추측 2026-11-26 6건(2606_MASTER_P/T/VISA_P/VISA_S/MASTER_WE/AMEX_G_005_all.pdf) 모두 404 — 기존 4건과 합쳐 10건 실패
  - 재시도: ① 카드 상세를 브라우저로 렌더한 뒤 네트워크 응답(_next/data·api)에서 PDF 주소를 찾기 ② 삼성카드 고객센터 > 상품공시실 목록을 열어 카드명으로 검색해 내려받기 ③ 그래도 없으면 이 줄에 날짜만 더하고 다음 카드로
- **2026-11-26 · Pickle · 롯데 VISA Signature·Mastercard World Elite / NH Visa·Platinum 계열 선택서비스**
  - 사유: 롯데는 <BRAND>_<TIER>_01_select_service_260514.pdf 규칙 밖(404). NH는 <Brand>_<Tier>_250910.pdf 형태가 302→/error/error.html
  - 재시도: 카드사 카드 상세 페이지에서 안내 PDF 링크를 직접 확인. 롯데는 VISA_INFINITE_01·MasterCard_TITANIUM_01만 규칙 확인됨
- **2026-11-26 · Pickle · 하나카드 나머지 등급 선택서비스(Visa/Signature/Infinite·Mastercard·AMEX 계열)**
  - 사유: m.hanacard.co.kr/leaflet/·/leaflet/MW/·/leaflet/index.do 모두 404(디렉터리 목록 없음). MW001~003만 수집됨
  - 재시도: 카드 상세 페이지를 브라우저로 렌더해 leaflet PDF 링크를 카드별로 확인(파일명 MW001_20260209.pdf 규칙은 디렉터리·등급 코드를 알아야 함)
- **2026-11-25 · Claude · 신한 The More(더모아) 등 카드 DB에 없는 인기 카드**
  - 사유: 내 카드 찾기에서 '더모아'를 쳐도 안 나옴 — catalog-snapshot.json에 카드가 없음(검색 문제 아님)
  - 재시도: card-products 수집(상품공시실)으로 판매 중 카드 누락 확인 후 카드 DB에 추가
  - 참고: roadmap 후보
- **- · Claude · Claude 세션 WebFetch — 우리카드·현대카드·롯데카드 상품설명서**
  - 사유: pc.wooricard.com PDF·상세는 오류 페이지/메인 화면만 옴, hyundaicard.com·image.lottecard.co.kr은 robots.txt 읽기 실패로 WebFetch 거부(셸은 허용 목록 밖). shinhancard.com 상세 페이지는 읽힘(연회비 칸은 JS 자리표시자)
  - 재시도: 우리·현대·롯데는 브라우저가 있는 에이전트(Pickle)가 맡기. Claude는 신한 상세 페이지부터
- **- · Claude · hana-17768 JADE First Centum · hana-17766 JADE Prime · hana-19217 JADE Prime 골드클럽 · hana-18242 카카오페이 트래블로그 체크 · hana-17668 토스하나 2.0 · hana-10764 CLUB1 200**
  - 사유: 심의필·준법심의 모두 2022~2024년(올해·작년 규칙 밖)
  - 재시도: 새 판이 올라오면 같은 페이지에서
- **- · Claude · hana-9894 CLUB Signature SKYPASS · hana-16910/16912/16764/16762/16760 Club Leaders 10·15·3·5·8 · hana-17017 K-패스 하나 신용 · hana-7969 1Q Special+**
  - 사유: 여신금융협회 심의필이 2020~2024년(올해·작년 규칙 밖)인데 같은 페이지에 2026년 준법심의(카드사 자체 개정 심의)가 있음 — 어느 날짜를 docDate로 볼지 규칙 확인 필요
  - 재시도: HJ가 준법심의 날짜를 기준일로 인정하면 같은 페이지(m.hanacard.co.kr/MKCDCM1000M.web?CD_PD_SEQ=…)에서 옮기기
- **- · Claude · kj-CDR20180228002 광주·전남愛사랑플래티늄 · kj-CDR20210929001 HONORS V2**
  - 사유: kjbank.com 카드 상세가 INBN_GDS_NO를 무시하고 1st플래티늄 플러스만 보여 줌, 상품설명서 링크는 href=#(스크립트), curl 프록시 403
  - 재시도: 브라우저로 상품공시(/ib20/mnu/BHPCSCN040802)·약관(BHPCSCN040803)에서 카드명으로 PDF 받기, 또는 m.kjbank.com/mweb/spa/goodsDetail/?pick=C0xx
- **- · Claude · lotte-P10351-A10351 다이아몬드 위버스카이 SKYPASS · lotte-P02914-A02914 플래티넘 위버스카이 SKYPASS**
  - 사유: image.lottecard.co.kr/UploadFiles/cardProvisionPath/<vtCdKndC>.pdf가 오래된 카드에선 2020년 브랜드 서비스 안내(UnionPay DIAMOND·AMEX PLATINUM ELITE). www·mo.lottecard.co.kr은 WebFetch robots 실패
  - 재시도: 브라우저로 카드 상세를 렌더해 '상품설명서' 링크 확인(cardProvisionPath/<심의번호>_<날짜>_<번호>.pdf 형태 추정)
- **- · Claude · lotte-P14724-A14724 디지로카 Monaco**
  - 사유: 상품설명서 cardProvisionPath/P14724-A14724.pdf는 찾았으나 글꼴이 깨져 심의필 날짜를 못 읽음(docDate 필수라 뺌). 대기열 termsUrl(VISA_PLATINUM_04_260514.pdf)은 상품설명서가 아니라 브랜드 서비스 안내
  - 재시도: PDF를 fitz로 PNG 렌더해 심의필 날짜를 눈으로 읽고 옮기기
- **- · Claude · shinhan-201507300001 The CLASSIC+ · shinhan-202408120002 The Premium PET · shinhan-202404220001 AK PLAZA Plus · shinhan-201907220001 11번가 · shinhan-202309010001 CJ ONE 프리즘 · shinhan-202103160001 IKEA Family**
  - 사유: 공식 상세 페이지의 심의필이 2021~2024년(2024.10.24·2024.06.18·2024.04.24·2023.12.28·2023.08.11·2021.04.20)이라 '올해·작년 문서' 규칙 밖
  - 재시도: 신한 상세 페이지 하단 심의필이 2025년 이후로 바뀌면 같은 페이지에서 옮기기
- **- · Claude · shinhan-202501310002 Point Plan 체크(SOL 모임) · shinhan-202609080001 FOCUS 신한카드 체크**
  - 사유: SOL 모임은 준법감시 심의필 2024.06.10(올해·작년 규칙 밖). FOCUS는 외국인 전용 체크카드인데 WebFetch 요약에서 심의필 날짜를 못 읽음
  - 재시도: SOL 모임은 새 판이 나오면, FOCUS는 상세 페이지 하단 심의필을 짧은 질문으로 다시 읽기
- **- · Claude · tools/data/inbox.py card-terms cardId 규칙**
  - 사유: ID 정규식이 소문자만 받아 대문자가 든 카드 DB id(lotte-P14715-A14715, kj-CDR…)를 cardId에 못 넣음 → cardId null + queueKey로 둠(머지는 이름으로 연결됨)
  - 재시도: check_card_terms에서 cardId만 카드 DB id 형식(대소문자)을 허용하도록 고치기

### 다른 경로로 처리 (workaround) — 5건

- **2026-11-27 · Pickle · 삼성카드 aap1910·신한카드 PC_26_01197 (Mastercard 프리미엄 서비스 안내)**
  - 사유: 발레·라운지 항목이 없고 국내 특급호텔 객실·F&B 할인 목록(각 44·43곳) 위주라 brand-services 양식으로 담지 않음
  - 대신 이렇게: hotel_benefit 카테고리로 호텔 목록을 담는 방식을 정한 뒤 다음 회차에 수집
- **2026-11-26 · Pickle · BC 상품설명서 이미지 PDF(로스트아크 101686·페이북머니 101681·102095·후불하이패스 103132·103183)**
  - 사유: 이미지 PDF 5종 중 3종(101686 로스트아크·101681 페이북머니·102095 밥바라밥)을 PNG로 렌더해 옮김. 나머지 2종(후불하이패스 103132·103183)은 2023-07-18 심의필 문서뿐이라(올해·작년 규칙 밖) 제외
  - 대신 이렇게: fitz로 페이지를 PNG(폭 1400px)로 렌더해 눈으로 읽어 옮긴다. BC 다운로드는 200이어도 본문이 HTML(302 안내)일 수 있으니 file 명령으로 실제 PDF 확인
  - 참고: #133
- **2026-11-26 · Pickle · BC·IBK 상품설명서 PDF 경로**
  - 사유: bccard.com/down/individual/customer/<gdsno>.pdf 는 BC 바로카드만 유효. IBK·MG 등 타 은행 gdsno(103039·104506·225018 등)는 302/HTML
  - 대신 이렇게: BC 바로카드 gdsno만 이 경로 사용. 다른 은행 카드는 해당 은행 카드 상세 페이지에서 PDF 링크 확인
- **2026-11-26 · Pickle · KB 선택서비스 Mastercard World Elite·Amex Gold·Amex The Platinum**
  - 사유: img2.kbcard.com/obj/card/download/00123~00134_stpul_20260511.pdf 11종을 전수 확인 — Amex는 Ultra(00123)·Platinum(00124), Mastercard는 World/Platinum/Diamond만 있고 World Elite·Amex Gold·The Platinum 약관 없음
  - 대신 이렇게: 대기열 해당 key는 내리는 편이 맞음(등급 자체 미운영)
- **2026-11-25 · Pickle · BC 상품설명서 6건(101874·101877·101881·101883·104063·104453)**
  - 사유: PDF가 이미지로만 되어 있어 텍스트 추출이 안 됨
  - 대신 이렇게: 공식 상품 페이지 본문으로 대체 확인(내용 일치 확인함). 글자 추출이 꼭 필요하면 OCR이 필요하고, 보통은 상품 페이지 본문으로 충분

### 해결됨 (resolved) — 6건

- **2026-11-26 · Pickle · 발레파킹 서울 호텔 이름 표기 불일치 3곳(노보텔 앰배서더 서울 용산·노보텔 스위트 앰배서더 서울 용산·이비스 스타일 앰배서더 서울 용산)**
  - 사유: #128 배포 로그에서 hotels/valet.json에 없는 표기로 나와 호텔 연결 실패
  - 해결 방법: 복합 호텔(서울드래곤시티)은 안내문 표기를 aliases에 그대로 넣기
  - 참고: #130 (별칭 3개 추가, 이후 배포 '못 찾음' 0건)
- **2026-11-25 · Claude · 발레파킹 — 같은 카드사·브랜드·등급 안내문이 여러 개일 때 화면에 하나만 남던 문제**
  - 사유: merge_valet이 issuer+brand+tier가 같으면 무조건 덮어써서 KB Mastercard World가 39곳짜리(BeV III) 대신 13곳짜리만 표시됐음
  - 해결 방법: 대상 호텔이 더 많은 안내문을 남기고 카드별로 자기 안내의 호텔만 표시하도록 수정
  - 참고: #86 · #98에서 해결
- **2026-11-25 · Pickle · bc-103112 — 대기열 이름(K-패스 카드)과 상품설명서 내용(BC 바로 모두의카드) 불일치**
  - 사유: PDF 본문이 '모두의카드' 혜택 안내라 카드명이 맞지 않아 보류했음. 실제로는 2026-10-28 약관 개정으로 이름이 바뀐 같은 카드였고 카드 ID가 유지됨
  - 해결 방법: 카드명이 다르면 먼저 카드사 약관 개정·명칭 변경 공지를 확인(카드 ID로 찾기)
  - 참고: ChatGPT #97(수집) · #99(전월실적 제외 정정)
- **2026-11-25 · Pickle · 발레파킹 서울 호텔 이름 표기 불일치 5곳(글래드 여의도·노보텔 앰배서더 동대문·레스케이프 호텔·코트야드 바이 메리어트 서울 타임스퀘어·코트야드 서울 타임스퀘어)**
  - 사유: 안내문 표기 그대로 넣어 hotels/valet.json에서 호텔을 못 찾음(4곳은 별칭 없음, 글래드 여의도는 목록에 없던 호텔)
  - 해결 방법: 호텔 이름이 안 맞으면 hotels/valet.json의 aliases에 안내문 표기를 넣기(새 호텔이면 ll 좌표와 함께 등록)
  - 참고: #86 (별칭 4개 추가·글래드 여의도 신규 등록, 못 찾음 0건)
- **2026-11-25 · Pickle · 신한 Titanium · AMEX Gold·PLATINUM ELITE·The Platinum 안내장**
  - 사유: 신한 카드 상세 8장을 확인했지만 해당 등급 안내장이 없음. 신한 AMEX는 PLATINUM·PLATINUM ELITE 공통 안내장 1종(유형1 클래식+급)만 운영
  - 해결 방법: 없는 안내장이므로 다시 찾지 말 것 — 대기열 key는 내리거나 valet-only로 두고 다른 등급으로 넘어가기
- **- · Claude · shinhan-201902270001 The BEST+ · shinhan-202603060001 The CLASSIC Air**
  - 사유: Claude 세션에서 shinhancard.com은 Bash curl 프록시 403, WebFetch는 권한 요청 시간 초과. 신한 프리미엄 카드 상세에는 상품설명서 PDF 링크가 없고 브랜드 가이드 PDF(pconts/download/card/MO_26_*)만 있음
  - 해결 방법: 브라우저가 있는 에이전트(Pickle)가 상세 페이지 본문(심의필 날짜)으로 옮기거나, 상품공시실에서 상품설명서 PDF 확인
  - 참고: 2026-11-27 Claude 2차 — shinhancard.com 상세 페이지 WebFetch로 읽힘(심의필 2026.09.17·2026.08.21)

## 5. 기록하는 법 — `data/agent-notes/<내 파일>.json`

```json
{
  "agent": "Pickle",
  "role": "데이터 수집 + 코드·문서 (Claude 기반)",
  "updatedAt": "2026-11-25T20:10:00+09:00",
  "lock": {
    "areas": [
      "docs/",
      "tools/data/"
    ],
    "branch": "ai/pickle/agent-sync-board",
    "pr": null,
    "since": "2026-11-25T19:40:00+09:00",
    "note": "공용 현황판 구축"
  },
  "runs": [
    {
      "at": "2026-11-25T11:50:00+09:00",
      "kind": "card-terms",
      "pr": 94,
      "summary": "BC 바로카드 4종 · 혜택 22줄",
      "queueKeys": [
        "bc-104453",
        "bc-104063"
      ]
    }
  ],
  "skipped": [
    {
      "at": "2026-11-25",
      "target": "samsung-aap1483 삼성 상품설명서",
      "status": "open",
      "reason": "카드 상세가 Nuxt 런타임 렌더링이라 PDF 링크가 HTML에 없음. 파일명 추측 4건 404",
      "retry": "상품공시실 목록에서 카드명으로 찾기"
    }
  ]
}
```

- `status`는 `open`·`workaround`·`resolved` 중 하나. 해결되면 지우지 말고 `resolved`로 바꾸고 `ref`에 해결한 PR을 적습니다(다음 에이전트가 이력으로 봅니다).
- `lock`은 작업을 시작할 때 적고, PR을 머지하면 `null`로 비웁니다. 남의 잠금 영역은 피합니다.
- 기록을 고친 뒤 `python tools/data/agent_sync.py`를 실행해 이 현황판과 `data/agent-status.json`을 함께 커밋합니다.
