# 🤝 GPT · Claude · Pickle 공용 작업 현황판

_자동 생성 2026-11-26 21:26 KST · `python tools/data/agent_sync.py` · 기계용 JSON은 [`data/agent-status.json`](../data/agent-status.json)_

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
| [#133](https://github.com/uio412-source/my-website/pull/133) | Pickle | data: 수집 2026-11-26 5차 (KB Visa Infinite 선택서비스 · BC·KB 상품설명… | 2026-11-26 21:25 | 3파일 · data/inbox/card-terms 2 · data/inbox/bran… | 머지 |
| [#131](https://github.com/uio412-source/my-website/pull/131) | Pickle | docs: 현황판 갱신 (2026-11-26 Pickle — #130 드래곤시티 별칭 해결) | 2026-11-26 18:21 | 3파일 · data/ 2 · docs/ 1 | 머지 |
| [#130](https://github.com/uio412-source/my-website/pull/130) | Pickle | Mr. Hotels 발레: 서울 드래곤 시티 용산 3개 호텔 정식 표기 별칭 추가 | 2026-11-26 18:12 | 5파일 · data/ 3 · docs/ 1 · hotels/ 1 | 머지 |
| [#129](https://github.com/uio412-source/my-website/pull/129) | Pickle | docs: 수집 대기열·공용 현황판 갱신 (2026-11-26 Pickle 4차) | 2026-11-26 18:05 | 4파일 · data/ 3 · docs/ 1 | 머지 |
| [#128](https://github.com/uio412-source/my-website/pull/128) | Pickle | data: 수집 2026-11-26 (롯데 VISA Infinite·MasterCard Titanium 선… | 2026-11-26 18:02 | 3파일 · data/inbox/brand-services 2 · data/inbox/… | 머지 |
| [#127](https://github.com/uio412-source/my-website/pull/127) | Claude | Mr. Pay: 맨 위 혜택 배너 (온누리 할인율 · 네이버 페이스사인 · 토스 페이스페이) | 2026-11-26 17:57 | 10파일 · pay/ 3 · assets/ 2 · data/ 2 외 2곳 | 머지 |
| [#126](https://github.com/uio412-source/my-website/pull/126) | Claude | Mr. Pay: 매장·시장 단위 겹쳐 보기 — 마인웍스처럼 온누리 + 네이버 페이스사인 되는 곳 | 2026-11-26 15:45 | 10파일 · assets/ 2 · data/ 2 · docs/ 2 외 4곳 | 머지 |
| [#125](https://github.com/uio412-source/my-website/pull/125) | Claude | Mr. Pay 화면: 가맹점(온누리 + 토스페이·네이버 얼굴결제 겹쳐 보기) · 브랜드 | 2026-11-26 15:01 | 15파일 · assets/ 3 · pay/ 3 · 루트 3 외 4곳 | 머지 |
| [#124](https://github.com/uio412-source/my-website/pull/124) | Claude | Mr. Pay: 온누리 가맹점 DB 만들기(상가정보로 업종 보강) + 월 1회 새 판 확인 | 2026-11-26 14:59 | 4파일 · .github/ 2 · tools/pay 1 · 루트 1 | 머지 |
| [#123](https://github.com/uio412-source/my-website/pull/123) | Claude | Mr. Travel 여행지: 입국 조건 다시 확인 + 한시 무비자 기한 + 공식 신청 링크 | 2026-11-26 14:15 | 8파일 · assets/ 2 · data/ 2 · docs/ 2 외 2곳 | 머지 |
| [#122](https://github.com/uio412-source/my-website/pull/122) | Claude | Mr. Cards 바닥글에 DB 작업 진행률 작은 상자 | 2026-11-26 11:47 | 14파일 · paymorevent/ 4 · data/ 3 · docs/ 3 외 3곳 | 머지 |
| [#121](https://github.com/uio412-source/my-website/pull/121) | ChatGPT | data: 수집 2026-11-26 (카드 이벤트·IBK 코웨이 상품 변경) | 2026-11-26 09:20 | 3파일 · data/inbox/card-events 2 · data/inbox/car… | 머지 |
| [#120](https://github.com/uio412-source/my-website/pull/120) | Pickle | Mr. Hotels 발레: 안내문 표기 별칭 2개 추가 | 2026-11-26 02:59 | 1파일 · hotels/ 1 | 머지 |
| [#119](https://github.com/uio412-source/my-website/pull/119) | Pickle | docs: 수집 대기열·공용 현황판 갱신 (2026-11-26 Pickle) | 2026-11-26 02:54 | 4파일 · data/ 3 · docs/ 1 | 머지 |
| [#118](https://github.com/uio412-source/my-website/pull/118) | Pickle | data: 수집 2026-11-26 (NH·롯데·KB 브랜드 선택서비스 8 · KB 상품설명서 5종) | 2026-11-26 02:51 | 4파일 · data/inbox/brand-services 3 · data/inbox/… | 머지 |
| [#117](https://github.com/uio412-source/my-website/pull/117) | Claude | Mr. Cards 텍스트 정리: 이벤트 이름 찌꺼기·안내 한 줄·원문 반복 줄 | 2026-11-25 22:48 | 12파일 · paymorevent/ 7 · data/ 2 · docs/ 2 외 1곳 | 머지 |
| [#116](https://github.com/uio412-source/my-website/pull/116) | Claude | Mr. Stocks 텍스트 정리: 배당 세금 안내 접기·한 줄씩 | 2026-11-25 22:39 | 8파일 · assets/ 2 · data/ 2 · docs/ 2 외 1곳 | 머지 |
| [#115](https://github.com/uio412-source/my-website/pull/115) | Claude | Mr. Hotels 텍스트 정리: 이벤트 조건 2줄·발레 카드 목록 접기·안내 한 줄 | 2026-11-25 22:36 | 9파일 · assets/ 4 · data/ 2 · docs/ 2 외 1곳 | 머지 |
| [#114](https://github.com/uio412-source/my-website/pull/114) | Claude | Mr. Travel 텍스트 정리: 원문 요약 문장 빼고 목록은 더 보기로 | 2026-11-25 22:32 | 7파일 · assets/ 2 · data/ 2 · docs/ 2 외 1곳 | 머지 |
| [#113](https://github.com/uio412-source/my-website/pull/113) | Claude | 광고성 이벤트 판단 보강 — Mr. Cards 전체와 Mr. Travel에서 빼기 | 2026-11-25 22:27 | 14파일 · paymorevent/ 5 · docs/ 3 · tools/travel … | 머지 |
| [#112](https://github.com/uio412-source/my-website/pull/112) | Claude | docs: Claude 잠금 — 광고성 이벤트·전체 사이트 텍스트 정리 작업 중 | 2026-11-25 22:22 | 3파일 · data/ 2 · docs/ 1 | 머지 |
| [#111](https://github.com/uio412-source/my-website/pull/111) | Claude | 도구: 현황판 agent_sync.py — gh pr list가 막히면 REST로 PR 이력 읽기 | 2026-11-25 22:12 | 5파일 · data/ 2 · docs/ 2 · tools/data 1 | 머지 |
| [#110](https://github.com/uio412-source/my-website/pull/110) | Claude | Mr. Cards: 광고성 이벤트를 '기타 광고'로 분류하고 내 카드 이벤트에서 제외 | 2026-11-25 22:09 | 9파일 · docs/ 3 · paymorevent/ 3 · data/ 2 외 1곳 | 머지 |
| [#109](https://github.com/uio412-source/my-website/pull/109) | Pickle | fix: 발레파킹 '확인 중' 목록에서 해결된 우리카드 항목 제거 | 2026-11-25 19:56 | 1파일 · hotels/ 1 | 머지 |
| [#108](https://github.com/uio412-source/my-website/pull/108) | Pickle | Mr. Cards: MG·우리 신규 카드 한도 칸 중복 표기 정리 | 2026-11-25 19:50 | 2파일 · paymorevent/ 2 | 머지 |

_(최근 25건만. 전체는 `data/agent-status.json`의 `recentPRs`.)_

## 3. 지금 진행 중 · 잠금 · 다음 시작점

### 잠금 (작업 중인 영역 — 끝나면 `lock`을 `null`로 비웁니다)

_지금 잠근 영역이 없습니다._

### 열린 PR

| PR | 에이전트 | 브랜치 | 만든 시각 | 영역(파일) | 내용 |
|---|---|---|---|---|---|
| [#132](https://github.com/uio412-source/my-website/pull/132) | ChatGPT | `ai/chatgpt/data-2026-11-26-card-t…` | 2026-11-26 21:23 | 1파일 · data/inbox/card-terms 1 | data: 수집 2026-11-26 (BC 로스트아크 상품설명서) |

### 수집 대기열 (`data/collect-queue.json`, built 2026-11-26)

대기열은 만든 시점 기준입니다. `data/inbox/`에 key가 있으면 이미 한 항목이니 그 key는 빼고 고릅니다. `built`가 최근 수집 PR보다 이르면 inbox에 이미 있는 key가 `todo`로 남아 있을 수 있습니다 — 그럴 때는 `python tools/data/queue.py`로 갱신해 PR 하나로 올립니다.

- **다음 시작점** — cards `samsung-aap1483` · brandPrograms `shinhan-mastercard-titanium`
- **남은 카드** 1406 / 1447종 · **브랜드 프로그램** todo 58 · valet-only 4 / 94개 · **이벤트 출처** 한 번이라도 모은 곳 9 / 30곳
- **최근 수집일** — card-terms 2026-11-26 · brand-services 2026-11-26 · card-events 2026-11-26 · hotel-events 없음 · travel-events 없음 · card-products 2026-11-26

### 에이전트별 마지막 반영

| 에이전트 | 기록 파일 | 마지막 머지 PR | 반영 시각 | 다시 볼 것(open/workaround) |
|---|---|---|---|---|
| ChatGPT | `data/agent-notes/chatgpt.json` | #121 data: 수집 2026-11-26 (카드 이벤트·IBK 코… | 2026-11-26 09:20 | 0건 |
| ChatGPT Dot | **없음 — 만들어 주세요** | - | - | 0건 |
| Claude | `data/agent-notes/claude.json` | #127 Mr. Pay: 맨 위 혜택 배너 (온누리 할인율 · 네이버… | 2026-11-26 17:57 | 1건 |
| Pickle | `data/agent-notes/pickle.json` | #133 data: 수집 2026-11-26 5차 (KB Visa I… | 2026-11-26 21:25 | 13건 |

## 4. 실패 · 보류 · 제외 로그 (같은 삽질 금지)

상태 — `open` 다시 볼 것 · `workaround` 다른 경로로 처리함 · `resolved` 해결됨

### 다시 볼 것 (open) — 10건

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

### 다른 경로로 처리 (workaround) — 4건

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

### 해결됨 (resolved) — 5건

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
