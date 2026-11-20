# 데이터 수집 표준 작업 (Mr. Cards · Mr. Hotels)

외부 AI(ChatGPT 예약 작업, Codex 등)나 사람이 카드사·호텔 이벤트를 모아 올 때 따르는 **유일한** 방법입니다.

- 큰 DB 파일(`paymorevent/data/events.json`, `cards.json.gz`, `hotels/events.json`)은 **절대 직접 고치지 않습니다.**
- 대신 `data/inbox/<종류>/YYYY-MM-DD-<출처>.json` 파일을 **새로 추가**하는 PR만 올립니다.
- PR이 열리면 GitHub Actions(`수집 데이터 양식 검사`)가 양식을 검사하고, `main`에 머지되면 배포 때 `tools/data/inbox.py merge`가 화면용 DB에 자동으로 합칩니다.
- 같은 이벤트를 다음에 다시 수집하면(같은 `id`나 같은 카드사+제목) 새 파일 값이 이깁니다. 그러니 매번 **현재 진행 중인 것 전체**를 다시 담아도 됩니다.

로컬 검사: `python tools/data/inbox.py validate`

---

## 1. 폴더와 파일 이름

| 폴더 | 내용 | 사이트 반영 |
|---|---|---|
| `data/inbox/card-events/` | 카드사 이벤트 + 신규 발급 캐시백 | 배포 때 자동 |
| `data/inbox/hotel-events/` | 호텔 체인 프로모션 | 배포 때 자동 |
| `data/inbox/card-products/` | 카드 상품 신규·변경·단종 | **검토 대기열**(자동 반영 안 함) |

파일 이름: `YYYY-MM-DD-<영문 소문자 출처>.json` — 예: `2026-11-21-hana.json`, `2026-11-21-marriott.json`.
카드사 하나당 파일 하나, 호텔 체인 하나당 파일 하나.

## 2. 카드 이벤트 `card-events`

```json
{
  "type": "card-events",
  "issuer": "하나카드",
  "collectedAt": "2026-11-21",
  "collector": "ChatGPT",
  "listUrls": ["https://m.hanacard.co.kr/MPAEVT100M.web"],
  "events": [
    {
      "id": "hana-202611-aliexpress-15usd",
      "kind": "card",
      "title": "알리익스프레스 최대 $15 즉시할인",
      "summary": "최대 $15 즉시할인",
      "category": "해외/여행",
      "startsAt": "2026-11-19",
      "endsAt": "2026-12-03",
      "entryRequired": false,
      "cards": [],
      "conditions": ["알리익스프레스 앱에서 하나카드로 결제", "1인 1회"],
      "url": "https://m.hanacard.co.kr/MPAEVT100M.web",
      "cashbackAmount": null,
      "channel": "카드사 공식"
    }
  ]
}
```

| 항목 | 규칙 |
|---|---|
| `issuer` | `신한카드` `KB국민카드` `삼성카드` `현대카드` `우리카드` `하나카드` `롯데카드` `NH농협카드` `BC카드` `IBK기업은행` 중 하나 |
| `collectedAt` | 수집한 날 `YYYY-MM-DD` |
| `collector` | 수집 도구 이름 (`ChatGPT`) |
| `listUrls` | 실제로 열어 본 공식 이벤트 목록 주소 |
| `id` | `<카드사 영문>-<YYYYMM 시작월>-<영문 요약>` 소문자·숫자·하이픈. 카드사 영문: shinhan kb samsung hyundai woori hana lotte nh bc ibk |
| `kind` | `card` 카드사 이벤트 / `cashback` **새로 발급**하면 주는 캐시백·연회비 환급 |
| `title` | 카드사 제목 그대로, 60자 이내. 광고 문구(🎁, "놓치지 마세요")는 뺌 |
| `summary` | 혜택 한 줄 60자 이내. 숫자 위주: `최대 10만원 캐시백`, `해외 3% 할인`, `응모 시 추첨 100명 스타벅스` |
| `category` | `응모형` `해외/여행` `포인트/캐시백` `국세 / 지방세` `통신사 등 제휴` `기타` |
| `startsAt` / `endsAt` | `YYYY-MM-DD`. 시작일 모르면 `null`. **끝나는 날이 없는 상시 안내는 넣지 않음.** 이미 끝난 것도 넣지 않음 |
| `entryRequired` | 응모·참여 신청 버튼을 눌러야 하면 `true` |
| `cards` | 대상 카드 이름(카드사 표기 그대로). 카드사 전체 대상이면 `[]` |
| `conditions` | 받는 조건 0~6줄, 각 100자 이내. 대상·실적·지급 시기·제외만. 안내 문구 금지 |
| `url` | 이벤트 상세 주소(없으면 목록 주소). https, 공식 도메인만 |
| `cashbackAmount` | 원 단위 정수(최대 금액). 현금성이 아니면 `null` |
| `cashbackIsMaximum` | (선택) 금액이 "최대"면 `true` |
| `channel` | (선택) 발급 경로. 기본 `카드사 공식`. 플랫폼 이벤트면 `네이버페이` `카카오페이` `페이북` `토스` 등 |

인정 도메인: shinhancard.com kbcard.com samsungcard.com hyundaicard.com wooricard.com hanacard.co.kr lottecard.co.kr nonghyup.com bccard.com paybooc.co.kr ibk.co.kr pay.naver.com kakaopay.com card-gorilla.com toss.im tossbank.com banksalad.com

## 3. 호텔 이벤트 `hotel-events`

```json
{
  "type": "hotel-events",
  "collectedAt": "2026-11-21",
  "collector": "ChatGPT",
  "events": [
    {
      "id": "marriott-global-bonus-2026q4",
      "program": "marriott",
      "brand": "Marriott Bonvoy",
      "title": "숙박마다 보너스 포인트",
      "benefit": "2박마다 1,000P · 최대 10,000P",
      "kind": "포인트",
      "register": true,
      "stayFrom": "2026-11-01",
      "stayTo": "2027-01-31",
      "endsAt": "2027-01-31",
      "region": "전 세계",
      "points": ["투숙 전 등록 필수", "공식 채널 예약만 인정"],
      "url": "https://www.marriott.com/ko/offers.mi"
    }
  ]
}
```

| 항목 | 규칙 |
|---|---|
| `program` | `marriott` `hilton` `ihg` `accor` `hotelux` `other`(하얏트·국내 독립 호텔) |
| `kind` | `포인트` `할인` `서울 패키지` `무료 숙박` `기타` |
| `register` | 사전 등록 필요하면 `true` |
| `stayFrom` / `stayTo` | 투숙 기간(모르면 `null`) |
| `endsAt` | 마지막 투숙일과 예약 마감 중 **늦은 날** |
| `points` | 1~5줄, 각 80자 이내. 꼭 알아야 할 조건만 |
| `url` | 체인 공식 프로모션 주소 |

인정 도메인: marriott.com hilton.com ihg.com accor.com hyatt.com hotelux.com josunhotel.com shillahotels.com lottehotel.com parnas.co.kr ambatel.com

## 4. 카드 상품 변경 `card-products` (검토 대기열)

```json
{
  "type": "card-products",
  "issuer": "삼성카드",
  "collectedAt": "2026-11-21",
  "collector": "ChatGPT",
  "changes": [
    {
      "change": "new",
      "name": "삼성카드 taptap O2",
      "cardType": "credit",
      "url": "https://www.samsungcard.com/...",
      "annualFee": "국내 1만원 · 해외겸용 1만원",
      "minimumSpend": 300000,
      "benefits": [
        {"title": "커피 50% 할인", "detail": "스타벅스 50% 결제일할인, 월 1만원 한도", "rate": "50%", "cap": "월 1만원", "minimumSpend": 300000}
      ]
    }
  ]
}
```

- `change`: `new` 신상품 / `changed` 혜택·연회비 변경 / `discontinued` 발급 중단
- `changed`·`discontinued`는 `cardId`(`paymorevent/public/catalog-snapshot.json`의 `id`) 필수
- 사이트에 바로 반영되지 않습니다. 쌓인 대기열은 사람이 "카드 상품 대기열 반영해 줘"라고 요청할 때 카드 DB에 넣습니다.

## 5. 수집 순서 (매 실행)

1. 아래 공식 목록을 차례로 연다. 로그인이 필요하거나 열리지 않으면 그 출처는 건너뛰고 PR 본문에 적는다.
2. **진행 중·예정** 이벤트만 고른다. 끝난 것, 기간 없는 상시 안내, 공지·당첨자 발표는 뺀다.
3. 금액·기간·조건은 **상세 페이지 원문**에서 옮긴다. 추측하거나 계산해서 채우지 않는다. 모르면 `null`/`[]`.
4. 출처별로 파일 하나를 만든다.
5. 브랜치 `ai/chatgpt/data-YYYY-MM-DD`에서 PR 하나로 올린다(직접 `main` 푸시 금지).

| 카드사 | 공식 이벤트 목록 |
|---|---|
| 신한카드 | https://www.shinhancard.com/mob/MOBFW11011N/MOBFW11011C02.shc |
| KB국민카드 | https://card.kbcard.com/BON/DVIEW/HBBMCXCRVNEC0001 |
| 삼성카드 | https://www.samsungcard.com/personal/event/ing/UHPPBE1403M0.jsp |
| 현대카드 | https://www.hyundaicard.com/cpb/ev/CPBEV0101_06.hc |
| 우리카드 | https://pc.wooricard.com/dcpc/yh1/bnf/bnf01/H1BNF201S00.do |
| 하나카드 | https://m.hanacard.co.kr/MPAEVT100M.web |
| 롯데카드 | https://www.lottecard.co.kr/app/LPBNFDA_V100.lc |
| NH농협카드 | https://card.nonghyup.com/servlet/IpCb0005M.act |
| BC카드 | https://bccard.com/app/card/EvntBnftSubMainActn.do |
| 발급 캐시백 모음 | https://card.pay.naver.com/home/promotion · https://card-hub.kakaopay.com · https://web.paybooc.co.kr |

| 호텔 | 공식 프로모션 |
|---|---|
| Marriott | https://www.marriott.com/ko/offers.mi |
| Hilton | https://www.hilton.com/en/offers/ |
| IHG | https://www.ihg.com/content/kr/ko/offers |
| Accor | https://all.accor.com/a/ko/deals-corner.html |
| Hyatt | https://world.hyatt.com/content/gp/ko/offers.html |

## 6. PR 양식

- 제목: `data: 이벤트 수집 YYYY-MM-DD`
- 본문:

```
## 수집 결과
| 출처 | 진행 중 | 새로 추가 | 건너뜀(이유) |
|---|---|---|---|
| 하나카드 | 18 | 18 | |
| 신한카드 | 0 | 0 | 목록이 스크립트로만 보여 읽지 못함 |

작업 도구: ChatGPT 예약 작업
```

## 7. 하지 말 것

- `data/inbox/` 밖의 파일 수정, 기존 inbox 파일 수정·삭제
- 공식이 아닌 블로그·커뮤니티·뉴스 출처
- 개인 맞춤 혜택(로그인해야 보이는 쿠폰), 개인정보
- 양식에 없는 항목 추가 (검사에서 실패합니다)
