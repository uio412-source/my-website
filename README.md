# my-website — Mr. Stocks · Mr. Cards · Mr. Hotels · Mr. Travel

카드·주식·호텔·여행 정보를 한 저장소에서 만드는 정적 웹사이트입니다(HTML/CSS/JS + Mr. Cards만 React/Vite). `main` 브랜치에 merge되면 **GitHub Pages로 자동 배포**됩니다.

- 배포 주소: `https://uio412-source.github.io/my-website/`
- 작업 규칙: [AGENTS.md](AGENTS.md) · 수집 데이터 양식: [docs/data-update.md](docs/data-update.md)

## 사이트

| 사이트 | 주소 | 화면 | 데이터 |
|---|---|---|---|
| **Mr. Stocks** | `/ungjup.html` | 줍줍 지표 차트(QQQ·SPY·GLD·코스피200·비트코인) | `data/ungjup/*.json` (배포 때 `tools/ungjup/build.py`가 갱신) |
| | `/holdings.html` | 관심종목 시세·등락률·줍줍LV·뉴스 | `data/watchlist.json`, `data/ungjup/holdings_lv.json` |
| | `/dividend.html` | 보유 종목 예상 배당금·배당률 | `data/ungjup/dividends.json` |
| **Mr. Cards** | `/paymorevent/` | 카드 검색·상세(혜택 표·피킹률), 발급이벤트, 카드사 이벤트 | `paymorevent/public/catalog-snapshot.json`, `paymorevent/data/events.json` |
| | `/paymorevent/cards/<id>/`, `/paymorevent/events/<id>/` | 카드·이벤트 상세 정적 페이지 | 빌드 때 `paymorevent/scripts/publish-detail-pages.mjs`가 생성 |
| **Mr. Hotels** | `/hotels/` | 전세계 → 나라 → 도시 → 동네 지도 호텔 검색, 등급별 혜택 | `hotels/directory.json`, `hotels/areas.json`, `hotels/map.json`, `hotels/images.json` |
| | `/hotels/events.html` | 호텔 체인 공식 프로모션 | `hotels/events.json` |
| | `/hotels/valet.html` | 카드별 무료 발레파킹 서울 호텔 | `hotels/valet.json` |
| **Mr. Travel** | `/travel/index.html` | 카드사 해외·여행 혜택(공통·나라별·트래블카드) | `travel/benefits.json` (배포 때 `tools/travel/benefits.py`) |
| | `/travel/places.html` | 세계지도 나라별 성수기·항공권·호텔 시세 | `travel/places.json`, `travel/world.json` |
| | `/travel/prep.html` | 여행준비 5단계(항공권·호텔·이동·면세점·라운지) | `travel/prep.json` (배포 때 `tools/travel/prep.py`) |

## 데이터 수집·생성

수집기는 `data/inbox/<종류>/YYYY-MM-DD-<출처>.json` 파일만 추가하고, 배포 때 `tools/data/inbox.py merge`가 화면용 DB로 합칩니다(양식은 [docs/data-update.md](docs/data-update.md)). 합친 결과는 배포본에만 들어가고 저장소에는 커밋하지 않습니다.

| 스크립트 | 만드는 것 | 실행 시점 |
|---|---|---|
| `tools/ungjup/build.py` | `data/ungjup/*.json` (차트·관심종목·배당·뉴스) | 매일 06:40·16:40 배포 |
| `tools/data/inbox.py merge` | 카드사 이벤트·호텔 이벤트·여행 이벤트·브랜드 서비스 | 매 배포 |
| `tools/travel/benefits.py` | `travel/benefits.json` | 매 배포 |
| `tools/travel/prep.py` | `travel/prep.json` | 매 배포 |
| `tools/hotels/images.py` | `hotels/images.json` (대표 이미지 캐시) | 매 배포 |
| `tools/data/queue.py` | `data/collect-queue.json` (무엇을 먼저 모을지) | 수집 PR 머지 뒤 자동 |
| `tools/data/agent_sync.py` | `docs/agent-sync.md` · `data/agent-status.json` (에이전트별 최근 PR·잠금·실패 로그) | 기록을 바꿀 때(사람·에이전트) |
| `paymorevent` `npm run build` | Mr. Cards 정적 사이트·카드/이벤트 상세 페이지 | 매 배포 |

직접 갱신할 때:

```
pip install numpy pandas
python tools/ungjup/build.py
python tools/data/inbox.py merge
python tools/travel/benefits.py
python tools/travel/prep.py
```

Mr. Cards는 `paymorevent/`에서:

```
npm ci
npm run build
```

## 배포

`.github/workflows/deploy.yml`이 `main` push와 매일 06:40·16:40(KST)에 데이터를 갱신한 뒤 GitHub Pages로 올립니다. 수집 데이터 PR은 `.github/workflows/data-check.yml`이 양식을 검사하고, `ai/chatgpt/data-` 브랜치 PR은 `tools/data/automerge.py`가 검사 후 자동 머지합니다.

처음 한 번만: **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로, **Settings → Branches**에서 `main`에 *Require a pull request before merging*을 켭니다(AI 도구가 `main`에 직접 올리지 못하게).

## 여러 AI가 함께 작업할 때

GPT·Claude·Pickle이 같은 저장소를 번갈아 고칩니다. 서로 겹치지 않게 하려고 공용 현황판을 씁니다(세부는 [docs/data-update.md](docs/data-update.md) 9장).

- **시작 전**: [docs/agent-sync.md](docs/agent-sync.md)와 `data/agent-status.json`을 봅니다 — 최근 PR 이력, 지금 잠긴 영역, 열린 PR, **실패·보류 로그(사유·재시도 방법)**, 수집 대기열 다음 시작점.
- **끝나면**: `data/agent-notes/<내 파일>.json`(chatgpt·claude·pickle — 자기 파일만 고침)에 한 일·실패·잠금을 적고 `python tools/data/agent_sync.py`를 실행해 현황판을 갱신합니다. 두 산출물은 스크립트가 만드니 손으로 고치지 않습니다.
- 브랜치·수집 파일 이름은 에이전트별 접미사로 나뉩니다(`ai/chatgpt/…`·`ai/claude/…`·`ai/pickle/…`, Pickle은 `-pickle`).

## 함께 편집하기

Claude·ChatGPT 같은 AI 도구에 이 저장소를 연결하고 "AGENTS.md를 따라서 ○○를 바꾸고 PR을 만들어 줘"라고 요청합니다(현황판 규칙은 위 '여러 AI가 함께 작업할 때'). PR에서 변경을 확인하고 Merge하면 1~2분 안에 사이트에 반영됩니다(진행은 **Actions** 탭).
