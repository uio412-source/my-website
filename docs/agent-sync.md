# 🤝 GPT · Claude · Pickle 공용 작업 현황판

_자동 생성 2026-11-25 19:32 KST · `python tools/data/agent_sync.py` · 기계용 JSON은 [`data/agent-status.json`](../data/agent-status.json)_

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
| [#101](https://github.com/uio412-source/my-website/pull/101) | Claude | Mr. Cards 내 혜택 개편: 카드별 묶음 · +/− 접기 · 텍스트 줄이기 · 카드 찾기 개선 | 2026-11-25 19:31 | 7파일 · paymorevent/ 5 · docs/ 1 · 루트 1 | 머지 |
| [#100](https://github.com/uio412-source/my-website/pull/100) | Claude | Mr. Cards: 새 메뉴 '내 혜택' — 내 카드 등록 + 받을 수 있는 이벤트 모아 보기 | 2026-11-25 19:13 | 14파일 · paymorevent/ 11 · assets/ 1 · docs/ 1 외 … | 머지 |
| [#99](https://github.com/uio412-source/my-website/pull/99) | ChatGPT | data: 수집 2026-11-25 (BC 모두의카드 실적 제외 정정) | 2026-11-25 15:09 | 1파일 · data/inbox/card-terms 1 | 머지 |
| [#97](https://github.com/uio412-source/my-website/pull/97) | ChatGPT | data: 수집 2026-11-25 (BC 바로 모두의카드 1종) | 2026-11-25 14:06 | 1파일 · data/inbox/card-terms 1 | 머지 |
| [#98](https://github.com/uio412-source/my-website/pull/98) | Claude | Mr. Hotels 발레: 표기만 다른 같은 카드를 한 장으로 묶고 카드 DB 연결 보강 | 2026-11-25 13:58 | 6파일 · paymorevent/ 2 · assets/ 1 · docs/ 1 외 2곳 | 머지 |
| [#96](https://github.com/uio412-source/my-website/pull/96) | ChatGPT Dot | data: 수집 2026-11-25 (BC 바로 모두의카드 1종) | 2026-11-25 13:54 | 1파일 · data/inbox/card-terms 1 | 닫힘 |
| [#95](https://github.com/uio412-source/my-website/pull/95) | Pickle | data: 수집 대기열 갱신 (2026-11-25 Pickle 3차) | 2026-11-25 11:51 | 1파일 · data/ 1 | 머지 |
| [#94](https://github.com/uio412-source/my-website/pull/94) | Pickle | data: 수집 2026-11-25 (신한 브랜드 선택서비스 6 · BC 상품설명서 4종, Pickle 3… | 2026-11-25 11:50 | 2파일 · data/inbox/brand-services 1 · data/inbox/… | 머지 |
| [#93](https://github.com/uio412-source/my-website/pull/93) | Pickle | docs: 로드맵에 차트 요약 칸 삭제(#92) 기록 | 2026-11-25 10:35 | 1파일 · docs/ 1 | 머지 |
| [#91](https://github.com/uio412-source/my-website/pull/91) | Pickle | Mr. Cards: 하나 CLUB H가 '상품권 가능'으로 분류되던 오류 수정 | 2026-11-25 10:31 | 4파일 · paymorevent/ 2 · docs/ 1 · 루트 1 | 머지 |
| [#92](https://github.com/uio412-source/my-website/pull/92) | Pickle | Mr. Stocks: 차트 상단 요약 칸(줍줍LV·현재가·RSI·200일선) 삭제 | 2026-11-25 10:31 | 3파일 · assets/ 2 · 루트 1 | 머지 |
| [#90](https://github.com/uio412-source/my-website/pull/90) | Pickle | Mr. Stocks: 명언 배너를 차트(ungjup.html)에만 남김 | 2026-11-25 10:23 | 4파일 · 루트 3 · docs/ 1 | 머지 |
| [#89](https://github.com/uio412-source/my-website/pull/89) | Pickle | Mr. Stocks: 명언 배너에 말한 사람 사진 추가 | 2026-11-25 10:16 | 10파일 · assets/ 8 · docs/ 1 · 루트 1 | 머지 |
| [#88](https://github.com/uio412-source/my-website/pull/88) | Pickle | data: 대기열 자동 갱신을 PR 머지 방식으로 수정 | 2026-11-25 10:13 | 3파일 · docs/ 1 · tools/data 1 · 루트 1 | 머지 |
| [#87](https://github.com/uio412-source/my-website/pull/87) | Pickle | data: 멀티 에이전트 조율 규칙과 수집 대기열 갱신(중복 수집 방지) | 2026-11-25 10:10 | 6파일 · tools/data 3 · data/ 1 · docs/ 1 외 1곳 | 머지 |
| [#86](https://github.com/uio412-source/my-website/pull/86) | Pickle | Mr. Hotels: 발레파킹 서울 호텔 별칭 추가, 같은 등급 안내문 머지 규칙 수정 | 2026-11-25 10:03 | 5파일 · docs/ 2 · hotels/ 1 · tools/data 1 외 1곳 | 머지 |
| [#85](https://github.com/uio412-source/my-website/pull/85) | Pickle | data: 수집 2026-11-25 2차 (KB·신한·롯데 발렛·라운지 서비스, BC 상품설명서) | 2026-11-25 09:19 | 4파일 · data/inbox/brand-services 3 · data/inbox/… | 머지 |
| [#84](https://github.com/uio412-source/my-website/pull/84) | ChatGPT | data: 수집 2026-11-25 (card-events) | 2026-11-25 09:16 | 6파일 · data/inbox/card-events 6 | 머지 |
| [#83](https://github.com/uio412-source/my-website/pull/83) | Pickle | data: 수집 2026-11-25 (삼성·하나 발렛·라운지 서비스, KB·BC 상품설명서) | 2026-11-25 08:46 | 4파일 · data/inbox/brand-services 2 · data/inbox/… | 머지 |
| [#79](https://github.com/uio412-source/my-website/pull/79) | Pickle | Mr. Travel: 가짜 종료일 상시 처리, 라운지 문장 경계 자르기, 안내문 혜택 제외 | 2026-11-25 08:00 | 5파일 · tools/travel 2 · travel/ 2 · assets/ 1 | 머지 |
| [#78](https://github.com/uio412-source/my-website/pull/78) | Pickle | Mr. Stocks: 국내·해외 종가 날짜 분리 표기, 상장 200일 미만 고점 라벨 수정 | 2026-11-25 07:59 | 1파일 · assets/ 1 | 머지 |
| [#80](https://github.com/uio412-source/my-website/pull/80) | Pickle | Mr. Hotels: 대표 이미지 캐시·공통 배너 제외, 휴업 호텔 목록/발레 카운트 정리 | 2026-11-25 07:59 | 4파일 · assets/ 2 · hotels/ 1 · tools/hotels 1 | 머지 |
| [#81](https://github.com/uio412-source/my-website/pull/81) | Pickle | 공통: 파비콘·OG 미리보기·robots·404 추가, README 현행화 | 2026-11-25 07:59 | 22파일 · 루트 8 · assets/ 5 · hotels/ 4 외 2곳 | 머지 |
| [#82](https://github.com/uio412-source/my-website/pull/82) | Pickle | Mr. Cards: 혜택 표 머리글·율 파서 수정, 이벤트 엔티티·상시 종료일 정리, 12.5MB 스냅샷 … | 2026-11-25 07:59 | 18파일 · paymorevent/ 14 · tools/data 2 · docs/ 1… | 머지 |
| [#77](https://github.com/uio412-source/my-website/pull/77) | Pickle | chore: 매번 실패하던 gemini-cli.yml 워크플로 삭제 | 2026-11-25 00:22 | 1파일 · .github/ 1 | 머지 |

_(최근 25건만. 전체는 `data/agent-status.json`의 `recentPRs`.)_

## 3. 지금 진행 중 · 잠금 · 다음 시작점

### 잠금 (작업 중인 영역 — 끝나면 `lock`을 `null`로 비웁니다)

| 에이전트 | 영역 | 브랜치 | PR | 시작 | 지난 시간 | 메모 |
|---|---|---|---|---|---|---|
| Pickle | `docs/`, `tools/data/`, `data/agent-notes/` | `ai/pickle/agent-sync-board` | - | 2026-11-25 19:26 | 1시간 안 | 공용 현황판·충돌방지 도구 구축 — 이 PR이 머지되면 비웁니다 |

_6시간이 넘은 잠금은 이미 끝난 작업일 수 있습니다. 내 것이면 `lock`을 비우고, 남의 것이면 그 에이전트 기록을 봅니다._

### 열린 PR

_열린 PR이 없습니다._

### 수집 대기열 (`data/collect-queue.json`, built 2026-11-25)

대기열은 만든 시점 기준입니다. `data/inbox/`에 key가 있으면 이미 한 항목이니 그 key는 빼고 고릅니다. `built`가 최근 수집 PR보다 이르면 inbox에 이미 있는 key가 `todo`로 남아 있을 수 있습니다 — 그럴 때는 `python tools/data/queue.py`로 갱신해 PR 하나로 올립니다.

- **다음 시작점** — cards `samsung-aap1483` · brandPrograms `shinhan-mastercard-titanium`
- **남은 카드** 1410 / 1431종 · **브랜드 프로그램** todo 73 · valet-only 4 / 94개
- **최근 수집일** — card-terms 2026-11-25 · brand-services 2026-11-25 · card-events 2026-11-25 · hotel-events 없음 · travel-events 없음 · card-products 없음

### 에이전트별 마지막 반영

| 에이전트 | 기록 파일 | 마지막 머지 PR | 반영 시각 | 다시 볼 것(open/workaround) |
|---|---|---|---|---|
| ChatGPT | `data/agent-notes/chatgpt.json` | #99 data: 수집 2026-11-25 (BC 모두의카드 실적 … | 2026-11-25 15:09 | 0건 |
| ChatGPT Dot | **없음 — 만들어 주세요** | - | - | 0건 |
| Claude | `data/agent-notes/claude.json` | #101 Mr. Cards 내 혜택 개편: 카드별 묶음 · +/− 접… | 2026-11-25 19:31 | 0건 |
| Pickle | `data/agent-notes/pickle.json` | #95 data: 수집 대기열 갱신 (2026-11-25 Pickl… | 2026-11-25 11:51 | 2건 |

## 4. 실패 · 보류 · 제외 로그 (같은 삽질 금지)

상태 — `open` 다시 볼 것 · `workaround` 다른 경로로 처리함 · `resolved` 해결됨

### 다시 볼 것 (open) — 1건

- **2026-11-25 · Pickle · samsung-aap1483 삼성카드 taptap O 등 삼성 상품설명서(대기열 맨 앞 10종)**
  - 사유: 삼성 카드 상세가 Nuxt 런타임으로 그려져 HTML에 상품설명서 PDF 링크가 없음. static11.samsungcard.com/.../YYMM_<코드>.pdf 파일명 추측 4건 모두 404 → 2회 실패로 중단
  - 재시도: ① 카드 상세를 브라우저로 렌더한 뒤 네트워크 응답(_next/data·api)에서 PDF 주소를 찾기 ② 삼성카드 고객센터 > 상품공시실 목록을 열어 카드명으로 검색해 내려받기 ③ 그래도 없으면 이 줄에 날짜만 더하고 다음 카드로

### 다른 경로로 처리 (workaround) — 1건

- **2026-11-25 · Pickle · BC 상품설명서 6건(101874·101877·101881·101883·104063·104453)**
  - 사유: PDF가 이미지로만 되어 있어 텍스트 추출이 안 됨
  - 대신 이렇게: 공식 상품 페이지 본문으로 대체 확인(내용 일치 확인함). 글자 추출이 꼭 필요하면 OCR이 필요하고, 보통은 상품 페이지 본문으로 충분

### 해결됨 (resolved) — 4건

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
