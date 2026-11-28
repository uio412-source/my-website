# 데이터 수집 표준 작업 (Mr. Cards · Mr. Hotels · Mr. Travel)

외부 AI(ChatGPT 예약 작업, Codex 등)나 사람이 카드·호텔·여행 데이터를 모아 올 때 따르는 **유일한** 방법입니다.

- 큰 DB 파일(`paymorevent/data/*.json`, `cards.json.gz`, `hotels/*.json`, `travel/*.json`)은 **절대 직접 고치지 않습니다.**
- `data/inbox/<종류>/YYYY-MM-DD-<출처>.json` 파일을 **새로 추가**하는 PR만 올립니다.
- PR이 열리면 GitHub Actions(`수집 데이터 양식 검사`)가 양식을 검사하고(틀리면 빨간 X와 한국어 오류), `main`에 머지되면 배포 때 `tools/data/inbox.py merge`가 화면용 DB에 합칩니다.
- `ai/chatgpt/data-*` 브랜치 PR은 **자동 머지**됩니다(`수집 PR 자동 머지`): 마지막 커밋 10분 뒤 `data/inbox` 새 파일만 있고 양식 검사를 통과하면 머지·배포. 그래서 **커밋을 다 올린 뒤에 PR을 여세요.** 기존 파일 수정·삭제나 inbox 밖 파일이 섞이면 자동 머지하지 않고 PR에 이유를 댓글로 남깁니다.
- 같은 항목을 다음에 다시 수집하면(같은 `id`·같은 카드사+제목) **나중 파일 값이 이깁니다.** 매번 그 출처의 현재 내용 전체를 다시 담아도 됩니다.
- 무엇을 먼저 모을지는 `data/collect-queue.json`(수집 대기열)에 있습니다. → **10장 실행 한도와 순서**
- ChatGPT·Pickle·Claude가 함께 모읍니다. **작업을 시작하기 전에 9장 조율 규칙(대기열 · `data/inbox/` · 열린 PR 확인)을 먼저 보고 겹치지 않는 항목만 고릅니다.**
- 무엇이 됐고 **무엇이 안 됐는지**는 공용 현황판 `docs/agent-sync.md`·`data/agent-status.json`에 모입니다. 시작 전에 현황판 3·4장(잠금·실패 로그)을 보고, 끝나면 `data/agent-notes/<내 파일>.json`에 적고 `python tools/data/agent_sync.py`로 갱신합니다. → **9장**

로컬 검사: `python tools/data/inbox.py validate` · 대기열 다시 만들기: `python tools/data/queue.py` · 현황판 갱신: `python tools/data/agent_sync.py`

---

## 1. 종류와 쓰임

| 폴더(`type`) | 내용 | 어디에 쓰이나 |
|---|---|---|
| `card-events` | 카드사 이벤트, 신규 발급 캐시백 | Mr. Cards 카드사 이벤트·발급이벤트, Travel 혜택·여행준비 |
| `hotel-events` | 호텔 체인 프로모션 | Mr. Hotels 이벤트, 여행준비 ② |
| `travel-events` | 항공사·면세점·여행 예약 사이트·공항 **자체** 이벤트 | 여행준비 ①③④ |
| `brand-services` | 국제브랜드(Visa·Mastercard·AMEX·UnionPay) 등급 서비스 + **카드사 선택 서비스**(호텔 발레·공항 라운지·공항 발레·공항 커피·리무진 등) | Mr. Hotels 발레파킹(서울 호텔 자동 연결), 여행준비 ③⑤, 카드 상세(예정) |
| `card-terms` | **상품설명서** 표준 정리(연회비·실적·제외 항목·혜택 표) | Mr. Cards 카드 상세(전월실적·실적/혜택 제외·혜택 표, 7장 '화면에 쓰이는 조건') |
| `card-products` | 신상품·단종 알림 | 검토 대기열 |

## 2. 공통 규칙

- 파일 이름: `YYYY-MM-DD-<영문 소문자 출처>.json` (예: `2026-11-21-hana.json`, `2026-11-21-koreanair.json`). **출처(카드사·회사) 하나당 파일 하나.** 같은 날 다른 에이전트도 모았다면 9장대로 뒤에 자기 접미사를 붙입니다(`2026-11-21-hana-pickle.json`).
- `collectedAt`: 수집한 날, `collector`: 도구 이름(`ChatGPT`·`Pickle`·`Claude`).
- 금액은 **원 단위 정수**: 3천원 → `3000`, 1.5만원 → `15000`, 30만원 이상 → `300000`. 비율·마일 같은 혜택 크기는 문자열(`"10%"`, `"1.5마일"`).
- 날짜는 `YYYY-MM-DD`. 모르면 `null`, 목록이 없으면 `[]`. **추측·계산해서 채우지 않습니다.**
- 출처 주소는 **공식 도메인**만(카드사·국제브랜드·호텔 체인·항공사·면세점). 블로그·커뮤니티·비교 사이트 금지(발급 캐시백 모음 3곳만 예외).
- 문장은 안내문 표기를 살리되 광고 문구(이모지, "놓치지 마세요")는 뺍니다.
- `id`: 영문 소문자·숫자·하이픈, 64자 이내. 같은 대상이면 다음 수집 때도 **같은 id**를 씁니다.

## 3. 카드사 이벤트 `card-events`

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

**광고성 이벤트는 모으지 않음**: 카드를 써서 받는 혜택이 아니라 제휴사 상품 가입·조회·상담을 권하는 이벤트(보험 가입·보험료 조회·보장분석 상담, 대출·리볼빙·분할납부·투자·연금·노란우산 같은 금융상품, 통신·인터넷·멤버십·구독 가입, 여행사 패키지(하나투어·모두투어·노랑풍선·참좋은여행·롯데관광), 해외직구 쿠폰(알리익스프레스·테무), 가전 구독·구매, 토익·YBM 등 교육)는 Mr. Cards·Mr. Travel 화면에 아예 보이지 않습니다(`paymorevent/lib/ad-events.ts` · `tools/travel/ads.py`). 기부·운세·마케팅 수신 동의·MD 추천·라이브커머스 같은 홍보·정보성 글도 같습니다. 수집할 때는 카드 사용 혜택(캐시백·할인·적립·무이자·응모·자동납부)부터 담고, 광고성 이벤트는 **모으지 않아도 됩니다**(모아도 화면에 안 나옴). 이미 내는 보험료·요금을 카드로 **자동납부·자동이체**하는 이벤트는 광고가 아니라 생활 혜택이니 그대로 담습니다.

인정 도메인: shinhancard.com kbcard.com samsungcard.com hyundaicard.com wooricard.com hanacard.co.kr lottecard.co.kr nonghyup.com bccard.com paybooc.co.kr ibk.co.kr pay.naver.com kakaopay.com card-gorilla.com toss.im tossbank.com banksalad.com

## 4. 호텔 체인 프로모션 `hotel-events`

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

## 5. 항공사·면세점·여행 이벤트 `travel-events`

카드사가 아니라 **항공사·면세점·여행 예약 사이트·공항이 직접** 여는 이벤트입니다(카드사 제휴 이벤트는 `card-events`).

```json
{
  "type": "travel-events",
  "vendorType": "airline",
  "vendor": "대한항공",
  "collectedAt": "2026-11-21",
  "collector": "ChatGPT",
  "listUrls": ["https://www.koreanair.com/..."],
  "events": [
    {
      "id": "koreanair-202611-winter-sale",
      "title": "겨울 국제선 특가",
      "summary": "동남아 왕복 최저 29만원부터",
      "startsAt": "2026-11-20",
      "endsAt": "2026-12-10",
      "conditions": ["홈페이지·앱 예약", "탑승 기간 2027.01.05~03.31"],
      "url": "https://www.koreanair.com/...",
      "cardIssuers": ["삼성카드"],
      "promoCode": "WINTER26"
    }
  ]
}
```

| 항목 | 규칙 |
|---|---|
| `vendorType` | `airline` 항공사 · `dutyfree` 면세점 · `ota` 여행 예약 사이트(트립닷컴·아고다 등) · `airport` 공항 |
| `cardIssuers` | (선택) 특정 카드사 결제 조건이 붙으면 그 카드사 |
| `promoCode` | (선택) 할인 코드 |

## 6. 국제브랜드·카드사 선택 서비스 `brand-services`

상품설명서·'국제브랜드 서비스 안내' PDF에 있는 **호텔 발레파킹, 공항 라운지, 공항 발레, 공항 커피, 리무진·철도, KTX 주차** 같은 특수 혜택입니다. 카드사 × 브랜드 × 등급(예: 삼성카드 Mastercard World)마다 **프로그램 하나**로 정리합니다.

```json
{
  "type": "brand-services",
  "issuer": "삼성카드",
  "collectedAt": "2026-11-21",
  "collector": "ChatGPT",
  "programs": [
    {
      "id": "samsung-american-express-platinum-elite",
      "queueKey": "samsung-american-express-platinum-elite",
      "brand": "American Express",
      "tier": "PLATINUM ELITE",
      "provider": "issuer_selection",
      "docTitle": "아멕스 프리미엄 서비스 이용 안내",
      "url": "https://static11.samsungcard.com/wcms/personal/files/2604_AMEX_E_004.pdf",
      "docDate": "2026-04-15",
      "validThrough": "2026-12-31",
      "cards": ["American Express® Reserve"],
      "services": [
        {
          "category": "hotel_valet",
          "title": "호텔 발렛파킹 서비스",
          "minimumSpend": 500000,
          "grace": "발급월+1개월까지 실적 무관",
          "monthlyLimit": 5,
          "quotaScope": "hotel_airport",
          "sharedWith": "인천공항 발렛파킹과 통합 월 5회",
          "freeHours": 3,
          "holderOnly": true,
          "useRequired": true,
          "hotels": [
            {"name": "그랜드 워커힐 서울", "city": "서울"},
            {"name": "JW 메리어트 호텔 서울", "city": "서울"},
            {"name": "파크 하얏트 부산", "city": "부산"}
          ],
          "hotelRules": [{"name": "JW 메리어트 호텔 서울", "receiptMin": 50000, "monthlyLimit": null, "note": null}],
          "conditions": ["객실·식음료 매장 이용(연회장 제외) 본인 방문", "당일 영수증 제시"]
        },
        {
          "category": "airport_lounge",
          "title": "공항 라운지 서비스",
          "minimumSpend": 0,
          "annualLimit": 5,
          "guestCount": 1,
          "coverage": "전 세계 PP 라운지 (본인+동반 1인)",
          "conditions": ["카드 발급 후 PP 카드 신청"]
        }
      ]
    }
  ]
}
```

| 항목 | 규칙 |
|---|---|
| `id` / `queueKey` | `<카드사 영문>-<브랜드>-<등급>` (대기열 `brandPrograms[].key`와 같게). 같은 등급인데 카드마다 조건이 다르면 뒤에 `-<카드 영문>`을 붙여 따로 |
| `provider` | `issuer_selection` 카드사가 고른 선택 서비스(발레·라운지 대부분) · `international_network` 브랜드 기본 서비스 |
| `docDate` | 안내문 기준일(여신금융협회 **심의필 날짜**, 없으면 파일명·표지 날짜). **올해·작년 문서만** 씁니다 |
| `cards` | 안내문에 적힌 **대상 카드 이름 전부**(카드사 표기 그대로) |
| `services[].category` | `hotel_valet` 호텔 발레 · `airport_valet` 공항 발레 · `airport_lounge` 공항 라운지 · `airport_coffee` 공항 커피 · `airport_limousine` 리무진·철도 · `airport_fasttrack` 패스트트랙·입국 · `airport_parking` 공항·KTX 주차 · `hotel_benefit` 호텔 객실·F&B 할인 · `dining` · `golf` · `concierge` · `insurance` · `travel_booking` · `other` |
| `minimumSpend` | 실적 조건(원). 실적 무관이면 `0`. '직전 3개월 월평균'처럼 기준이 다르면 금액은 넣고 `conditions`에 기준을 적기 |
| `monthlyLimit` 등 | 횟수. **'이용횟수 제한 없이'면 `null`** + conditions에 적기 |
| `quotaScope` | `per_hotel` 호텔별 · `hotel_shared` 호텔 통합 · `hotel_airport` 호텔·공항 통합 · `per_service` 서비스별 · `shared_group` 기타 통합(→ `sharedWith`에 설명) |
| `hotels` | `hotel_valet`은 **필수**. 대상 호텔 **전체**(서울·지방 모두)를 안내문 표기 그대로 + `city`. 서울 호텔은 배포 때 발레파킹 화면에 자동 연결됩니다 |
| `hotelRules` | 호텔별 예외만: 영수증 최소 금액 `receiptMin`(원), 호텔별 횟수, 메모 |
| `useRequired` | `hotel_valet`: 당일 **투숙·식음료 매장 이용**이 있어야 무료면 `true`(대부분). 안내문에 **'호텔 이용과 관계없이' 등 이용 없이 무료라고 적혀 있을 때만** `false`. 모르면 `true`. 발레파킹 화면의 '조건 없이 무료만'은 `false`인 곳만 보여 줍니다 |

발레파킹(`hotel_valet`)을 `hotels/valet.json`에 넣는 규칙(`tools/data/inbox.py`의 `merge_valet`):

- **서울 호텔 이름 연결**: `hotels`의 서울 호텔 이름을 `hotels/valet.json` 호텔의 `name`·`aliases`와 맞춰 id로 바꿉니다. 안내문 표기가 목록과 다르면(예: `레스케이프 호텔` ↔ `레스케이프 서울 명동`) **호텔의 `aliases`에 그 표기를 추가**해야 연결됩니다. 못 찾은 이름·결과에서 빠진 카드 이름은 배포 로그에 남습니다.
- **같은 등급, 다른 카드 묶음**: 카드사·브랜드·등급이 같아도 안내문마다 대상 호텔이 다르면(예: KB Mastercard World `-02` BeV III 39곳 / `-05` HERITAGE Classic 13곳) **각각 따로** 남겨 카드마다 자기 안내의 호텔만 보여 줍니다.
- **같은 안내문을 다시 수집**: 같은 `id`이거나 대상 호텔·조건이 똑같은 안내문이면 한 프로그램으로 합치고, **대상 호텔이 더 많은(더 포괄적인) 안내가 남습니다**(예전에는 파일 순서상 나중에 온 좁은 안내가 넓은 안내를 덮었음). 합칠 때는 카드 목록을 이름 기준으로 합칩니다.

## 7. 상품설명서 정리 `card-terms`

카드 상품설명서(PDF)를 **카드 상세 화면과 같은 표 구조**로 옮깁니다: `구분 | 적용처 | 혜택 | 한도·조건`.

```json
{
  "type": "card-terms",
  "issuer": "신한카드",
  "collectedAt": "2026-11-21",
  "collector": "ChatGPT",
  "cards": [
    {
      "cardId": "shinhan-201509030001",
      "queueKey": "shinhan-201509030001",
      "name": "신한카드 Mr.Life",
      "cardType": "credit",
      "status": "active",
      "url": "https://www.shinhancard.com/pconts/html/card/apply/credit/1188220_2207.html",
      "termsUrl": "https://www.shinhancard.com/pconts/download/card/....pdf",
      "docDate": "2026-01-02",
      "annualFee": [{"brand": "Visa", "amount": 18000}, {"brand": "국내전용", "amount": 15000}],
      "brands": ["Visa", "국내전용"],
      "minimumSpend": 300000,
      "spendBasis": "전월 1일~말일 일시불·할부 승인 기준",
      "grace": "발급월 다음 달 말까지 실적 무관",
      "spendExclusions": ["아파트 관리비", "상품권 구매", "국세·지방세", "단기카드대출"],
      "benefitExclusions": ["무이자할부", "상품권"],
      "brandPrograms": ["shinhan-visa-platinum"],
      "benefits": [
        {
          "group": "생활",
          "label": "공과금",
          "place": "전기·가스·통신요금 자동납부",
          "value": "10%",
          "valueType": "할인",
          "minimumSpend": 300000,
          "tiers": [{"spend": 300000, "cap": 3000}, {"spend": 500000, "cap": 7000}, {"spend": 1000000, "cap": 10000}],
          "cap": null,
          "capScope": "월",
          "shared": "생활 통합 한도",
          "limits": null,
          "conditions": ["건당 1만원 이상"]
        }
      ]
    }
  ]
}
```

| 항목 | 규칙 |
|---|---|
| `cardId` | 대기열 `cards[].key`(=카드 DB id). 새 카드면 `null` |
| `annualFee` | 브랜드별 연회비(원). 가족카드·VIP 등은 넣지 않음 |
| `spendExclusions` / `benefitExclusions` | 안내문의 '실적 제외'·'혜택 제외'를 **항목 하나씩** 쪼갬(각 60자 이내) |
| `benefits[]` | 상품설명서 혜택 표의 **한 줄 = 한 개**. 같은 혜택이 가맹점마다 율이 다르면 줄을 나눔 |
| `label` | 구분 칸: 짧은 이름(커피·대중교통·해외·주유) |
| `place` | 적용처: 가맹점·업종 목록(안내문 표기) |
| `value` / `valueType` | `"10%"`·`"1,000원"`·`"리터당 60원"`·`"1.5마일"` / `할인`·`적립`·`캐시백`·`무료`·`면제`·`제공` |
| `tiers` | 실적 구간별 한도. 30만원 이상 3천원 → `{"spend": 300000, "cap": 3000}` |
| `cap` / `capScope` | 구간 없이 한 가지 한도면 `cap`(원) + `월`·`연`·`일`·`건` |
| `shared` | '통합 한도'로 묶인 혜택들은 **같은 이름**으로 |
| `brandPrograms` | 이 카드에 붙는 `brand-services` 프로그램 id(호텔 발레·라운지 등은 거기에) |
| `status` / `discontinuedAt` / `discontinuationSourceUrl` | `discontinued`는 **신규 발급이 실제로 끝난** 기존 카드만. 정확한 `cardId`와 시행을 명시하는 발급사 공식 상세 공지 주소가 필수입니다. 명시된 시행일만 `YYYY-MM-DD`로 기록하고, 종료 사실만 확인되면 날짜는 `null` 또는 생략합니다. 시행 전 공지는 8장 대기열에만 둡니다. |

**화면에 쓰이는 조건** (배포 때 `paymorevent/scripts/card-terms.mjs`가 카드 상세에 붙임, 로그에 붙인 수·안 붙인 카드가 나옴)
- `name`·`cardType`이 카드 DB(`cardId`) 카드와 같아야 붙습니다(카드사명·괄호·'카드'는 빼고 비교). 다른 카드를 적었으면 통째로 안 씁니다.
- **혜택 줄에는 실제 업종·가맹점을 적습니다(2026-11-28 규칙).** `label`은 구분 칸(커피·국내형 백화점·공항 라운지), `place`는 적용처(가맹점·업종 이름). "선택 옵션 대상 업종"·"… 자세히보기"·"대상 업종"처럼 **읽어서 무엇을 받는지 알 수 없는 줄은 넣지 마세요.** 선택형 카드는 옵션별로 줄을 나누고(예: 앤마일리지 해외형 1줄 + 국내형 백화점·주유·커피·편의점·택시 5줄), 통합 한도는 `shared`에 같은 이름으로 적어 한 칸으로 합칩니다. 서비스(라운지·발렛·커피)는 `value` "무료", `limits`에 "전월 30만원 이상 · 월 1회"처럼 조건을 적습니다.
- **`minimumSpend`는 카드 전체의 전월실적입니다.** 일부 서비스만 조건이 있으면(예: 공항 라운지 전월 30만원) `0`으로 두고 그 줄의 `limits`·`conditions`에 적으세요. 카드 전체가 무실적이면 `0` — 그래야 화면의 '결제별 인정'이 `?` 대신 ✓(실적을 따지지 않음)로 나옵니다.
- **전월실적**·**실적 제외**·**혜택 제외**는 정리본 값을 씁니다. 단, 카드 `minimumSpend`가 `0`인데 카드 DB 혜택에 실적 조건이 있으면 0은 버립니다 — '공통 기준 참조'처럼 실적이 다른 곳에 적혀 있으면 그 금액을 찾아 적으세요(모르면 `null`).
- **혜택 표**는 정리본이 카드 DB 혜택을 60% 넘게 담고 있거나 두 배 넘게 자세할 때만 정리본으로 바꿉니다. 상품설명서 혜택 표를 **빠짐없이** 옮겨야 화면에 쓰입니다(일부만 옮기면 기존 표 유지).
- 칸에는 `limits`와 30자 이하 조건 2개까지, 나머지 조건은 원문의 '혜택 조건'에 접어 둡니다. `shared`가 같은 줄은 한도 칸을 세로로 합칩니다.
- 이 정리본에서 **피킹률 요율 모델**을 기계 변환하는 기준·검수 방법은 14장에 있습니다(`tools/data/terms_to_rules.py`·`picking_audit.py`). 정리본을 고치면 다음 배포에서 변환 결과도 `terms-rules.json.gz`로 다시 만들 수 있습니다.

## 8. 신상품·단종 알림 `card-products` (검토 대기열)

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
- `changed`·`discontinued`는 `cardId`(`paymorevent/data/catalog-snapshot.json`의 `id`) 필수
- `discontinued`에는 **신규 발급** 중단을 명시한 발급사 공식 상세 공지 `url`과, 문서에 시행일이 있으면 선택 필드 `discontinuedAt: "YYYY-MM-DD"`를 기록합니다. 날짜가 없는 확정 중단은 `null` 또는 생략. 공고일·수집일·마지막 신청일·기존 카드 유효기간을 대신 적거나 추정하지 않습니다. 마지막 신청일과 신규 발급 중단일이 다르면 날짜 필드는 **신규 발급 시행일**만 쓰고 신청일은 `note`에 구분합니다.
- 갱신·추가·분실/훼손 재발급 가능 여부는 신규 신청/발급과 다르므로 공지대로 `note`에 따로 남깁니다. 일시 접수 중지·판매 페이지 미노출·신규 발급 자체의 중단 여부 불명은 `discontinued`로 추정하지 않습니다. 특정 국제 브랜드·채널·신용/체크·버전만 해당되면 그 범위와 정확한 별도 카드 ID에만 사용하고, 별도 ID가 없으면 카드 전체에 적용하지 않습니다.
- 예정된 시행일도 검토 대기열에는 남길 수 있지만, 시행 전에는 화면에 **발급 중단**으로 표시하지 않습니다. 검토 후 확정된 상태의 수기 반영은 `paymorevent/data/verified-issuance-status.json`에서 정확한 카드 ID·이름·종류·발급사에 맞춰 할 수 있습니다. 여기에도 시행일과 공식 상세 공지 근거가 필요하며, 날짜만 모르는 확정 중단은 `null`입니다.

- 새 날짜 필드를 넣어도 사이트에 바로 반영되지 않습니다. 쌓인 대기열은 사람이 "카드 상품 대기열 반영해 줘"라고 요청할 때 카드 DB에 넣습니다.

## 9. 멀티 에이전트(ChatGPT · Pickle · Claude) 중복 방지 및 조율 규칙

같은 대기열을 여러 에이전트(ChatGPT 예약 작업 · Pickle · Claude)가 번갈아 가며 모읍니다. 같은 항목을 두 번 모으면 시간과 레코드를 버리고, 같은 이름의 파일이 겹치면 PR이 충돌합니다. **작업을 시작하기 전에 아래 넷을 확인하고, 겹치지 않는 항목만 고릅니다.**

1. **대기열** `data/collect-queue.json` — `status`가 `todo`인 것만 고릅니다. `done`은 수집 완료, `valet-only`는 발레파킹만 넣어 둔 프로그램(라운지·공항 서비스가 남음)입니다. 파일 맨 위 `lastCollected`(종류별 최근 수집일)와 `nextStart`(종류별 다음 시작 key)에서 이어서 시작합니다. `eventSources`마다 붙은 `lastCollected`는 그 출처를 마지막으로 모은 날입니다(수집 파일 `listUrls`의 공식 도메인 기준, 호텔은 이벤트 `url`, `null`이면 아직 한 번도 안 모음) — 오래된 출처부터 챙기세요.
2. **받은편지함** `data/inbox/**` — 파일 이름과 그 안의 `queueKey`·`cardId`·`id`를 모두 봅니다. 대기열이 낡았을 수 있으므로(자동 갱신이 아직 안 돌았거나 실패) 대기열에 `todo`로 남아 있어도 inbox에 key가 있으면 이미 한 항목입니다.
3. **열린 PR** — `gh pr list --state open --json number,title,headRefName,files`로 다른 에이전트가 지금 올려 둔 PR이 건드리는 파일 이름과 key를 봅니다. 그 PR이 다루는 항목은 이번에 빼고, 머지된 뒤 다음 실행에서 이어 갑니다.
4. **공용 현황판** `docs/agent-sync.md` · `data/agent-status.json` — 3장(잠금·열린 PR·다음 시작점)과 4장(실패·보류 로그)을 봅니다. 내가 하려는 항목이 4장에 `open`으로 있으면 같은 방법을 다시 시도하지 말고 거기 적힌 재시도 방법부터 씁니다.
5. **피킹률 검수** — 카드 혜택·요율을 넣거나 고치는 작업이면 `python3 tools/data/picking_audit.py`로 전수 검사하고 A1~A5·B1·B2를 확인합니다(14장 '피킹률·혜택 데이터 검수').

- 고르지 않고 건너뛴 항목은 PR 본문 '건너뜀'·'다음 시작점'에 대기열 key로 적습니다. 같은 곳에서 같은 실패(로그인 필요·스크립트로만 그려짐 등)를 다음 에이전트가 반복하지 않습니다.
- 수집한 항목은 `card-terms`의 `cardId`·`queueKey`, `brand-services`의 `queueKey`에 **대기열 key 그대로** 적습니다. 빠뜨리면 수집했는데도 대기열에 `todo`로 남아 다음 실행에서 또 모읍니다(검사 로그에 `안내:` 줄로 나옵니다).

### 에이전트별 파일·브랜치 이름

| 에이전트 | 브랜치 | 파일 이름 |
|---|---|---|
| ChatGPT 예약 작업 | `ai/chatgpt/data-YYYY-MM-DD` | `YYYY-MM-DD-<출처>.json` |
| Pickle | `ai/chatgpt/data-YYYY-MM-DD-pickle`, 같은 날 두 번째부터 `-pickle2`·`-pickle3` | `YYYY-MM-DD-<출처>-pickle.json`, `…-pickle2.json` |
| Claude·그 밖의 에이전트 | `ai/<에이전트>/data-YYYY-MM-DD` | `YYYY-MM-DD-<출처>-<에이전트>.json` |

- **Pickle은 브랜치·파일 이름에 반드시 `-pickle`을 붙이고, 다른 에이전트는 `-pickle`을 쓰지 않습니다.** 같은 날 같은 출처를 둘이 함께 모아도 파일이 겹치지 않습니다.
- 접미사는 영문 소문자·숫자·하이픈만 씁니다(파일 이름 `YYYY-MM-DD-<영문 소문자 출처>.json`).
- Pickle도 브랜치를 `ai/chatgpt/data-`로 시작하게 해 자동 머지 대상이 되게 하되, **커밋을 다 올린 뒤에 PR을 엽니다**(자동 머지는 마지막 커밋 10분 뒤에 봅니다).
- 코드·문서를 고치는 PR(Pickle의 `ai/pickle/…` 등)은 자동 머지 대상이 아닙니다. 사람이 보고 머지합니다.
- 에이전트별 기록 파일: ChatGPT `data/agent-notes/chatgpt.json` · Claude `data/agent-notes/claude.json` · Pickle `data/agent-notes/pickle.json`.

### 공용 현황판 (무엇이 됐고 무엇이 안 됐는지 서로 보기)

작업 전 확인만으로는 **"왜 안 됐는지"**가 다음 에이전트에게 전해지지 않습니다. 그래서 현황판을 함께 씁니다.

| 파일 | 무엇 | 누가 씁니까 |
|---|---|---|
| `docs/agent-sync.md` | 사람이 읽는 현황판 — 규칙표 · 최근 PR 이력 · 잠금 · 실패/보류 로그 · 다음 시작점 | `agent_sync.py`만(손으로 고치지 않음) |
| `data/agent-status.json` | 기계가 읽는 같은 내용(JSON) | `agent_sync.py`만 |
| `data/agent-notes/<에이전트>.json` | 그 에이전트의 기록(잠금·한 일·실패) | **자기 파일만** 고침(남의 파일은 읽기만) |

- **기록하는 법**: `data/agent-notes/<내 파일>.json`에서
  - `lock` — 작업을 시작할 때 `areas`(예: `["paymorevent/"]`)·`branch`·`since`를 적고, PR을 머지하면 `null`로 비웁니다. 남이 잠근 영역은 그 PR이 머지된 뒤에 손댑니다.
  - `runs` — 한 일(`at`·`kind`·`summary`·`pr`·`queueKeys`).
  - `skipped` — **실패·보류·제외**(`target`·`reason`·`retry`). `status`는 `open`(다시 볼 것)·`workaround`(다른 경로로 처리함)·`resolved`(해결됨, `ref`에 해결 PR·커밋). 해결돼도 지우지 말고 `resolved`로 바꿉니다(이력이 남아야 같은 삽질을 막습니다).
- **갱신**: 기록을 고친 뒤 `python tools/data/agent_sync.py`를 실행합니다. gh에서 PR 이력·열린 PR을 읽어 `docs/agent-sync.md`·`data/agent-status.json`을 다시 만들고, 마지막 줄에 몇 건이 모였는지 찍습니다. gh를 못 쓰는 환경이면 `--no-gh`로 기록·대기열만으로 만듭니다(PR 부분은 지난 값 유지).
- **꼭 남기는 것**: 같은 곳에서 두 번 실패했거나(안 열림·스크립트로만 그려짐·로그인 필요·404), 찾는 곳에 없어서 다른 경로로 처리했을 때. 다음 에이전트가 같은 페이지를 다시 열어 같은 실패를 반복하는 것이 가장 큰 낭비입니다.

### 대기열 갱신

- `data/collect-queue.json`은 **손으로 고치지 않습니다.** `python tools/data/queue.py`가 `data/inbox/`·카드 DB(`paymorevent/data/catalog-snapshot.json`)·`hotels/valet.json`을 읽어 다시 만듭니다. inbox에 key가 있으면 `done`, 발레파킹에만 있으면 `valet-only`가 됩니다.
- 수집 PR이 `main`에 머지되면 자동 머지(`tools/data/automerge.py`)가 대기열을 다시 만들어 `data/collect-queue.json`만 담은 PR을 곧바로 머지합니다(main은 PR로만 바뀝니다). 사람이 직접 돌릴 때는 `python tools/data/queue.py` 뒤에 `data/collect-queue.json`을 함께 올립니다.
- 대기열 key보다 자세한 key(예: `hyundai-visa-infinite-the-black`)를 수집하면 대기열의 기본 key(`hyundai-visa-infinite`)도 `done`으로 표시됩니다.

## 10. 실행 한도와 순서 (매일 한 번, 끝까지 마치기)

**하루 할 일** (한국시간 기준, 위에서부터 순서대로)

| 순서 | 언제 | 할 일 | 대기열 |
|---|---|---|---|
| 1 | 매일 | `card-events`: 카드사 9곳 + 발급 캐시백 3곳 **전부**. 새로 올라온 이벤트와 기간·조건·금액이 바뀐 것만 담음(이미 inbox에 같은 내용이 있으면 뺌) | `eventSources` (card-events) |
| 2 | 매일 | `card-products`: 카드사 9곳 **상품공시실**에서 신상품·판매 중단·혜택/연회비 변경만(8장). 바뀐 게 없으면 파일을 만들지 않음 | 아래 '상품공시실' |
| 3 | 매일 | `card-terms`: status가 `todo`인 카드를 위에서부터 **10종**(같은 카드사끼리 한 파일) | `cards` |
| 4 | 토요일만 | `travel-events`: 항공사 8곳·면세점 4곳·인천공항 | `eventSources` (travel-events) |
| 5 | 토요일만 | `brand-services`: status가 `todo`인 프로그램을 위에서부터, 같은 카드사끼리 묶어 **6~8개**. 남으면 `hotel-events` 5곳 | `brandPrograms` (todo → valet-only 순) |

**한 번 실행 예산** (넘지 않게 스스로 세면서 진행)

| 항목 | 평일 | 토요일 |
|---|---|---|
| 열어 보는 페이지·PDF | 45개 | 70개 |
| 새로 쓰는 레코드(이벤트·혜택 줄 합계) | 250개 | 350개 |
| 만드는 파일 | 20개 | 30개 |

- `card-events`는 카드 사용 혜택을 먼저 담고, 3장의 **광고성 이벤트**(보험·금융상품·가입 유도·여행사 패키지·해외직구 쿠폰·홍보성 글)는 모으지 않습니다(화면에 안 나옴).
- 예산의 **80%**를 쓰면 새 출처를 열지 말고, 지금까지 만든 파일을 검사 규칙(2장·각 장 표)에 맞춰 다시 보고 PR을 올립니다. 못 한 순서는 다음 날 같은 순서로 이어서 합니다.
- 한 출처에서 두 번 실패(안 열림·스크립트로만 그려짐·로그인 필요)하면 건너뛰고 PR 본문에 적습니다.
- 끝내지 못한 항목은 PR 본문 '다음 시작점'에 대기열 key로 적습니다.
- 대기열 `data/collect-queue.json`에서 **status가 `todo`이고, `data/inbox/` 아래 어떤 파일에도 그 key(`queueKey`·`cardId`·`id`)가 없고, 열린 PR도 건드리지 않는 것**만 고릅니다(9장). 이렇게 하면 실행이 끊겨도 다음 번에 자연스럽게 이어집니다.
- `card-terms`의 `cardId`·`queueKey`, `brand-services`의 `queueKey`는 **대기열 key 그대로** 적습니다. 빠뜨리면 다음 날 같은 걸 또 수집합니다.
- `valet-only`는 발레파킹만 손으로 넣어 둔 프로그램이라, 라운지·공항 서비스까지 채우러 다시 봐야 합니다.
- PR은 커밋을 다 올린 뒤에 엽니다(검사를 통과하면 10분 뒤 자동 머지).

**상품공시실** (`card-products`)
- 각 카드사 홈페이지 고객센터의 '상품공시실'(신용·체크카드 상품 목록, 판매 중단 상품, 상품설명서 개정 내역)을 엽니다. 실제로 연 주소는 PR 본문에 적습니다.
- `paymorevent/data/catalog-snapshot.json`에 없는 이름이면 `new`, 공시실에 '판매중단'으로 표시되고 DB에 있으면 `discontinued`, 상품설명서 개정으로 혜택·연회비·전월실적이 바뀌었으면 `changed`.
- 카드사: 신한카드 KB국민카드 삼성카드 현대카드 우리카드 하나카드 롯데카드 NH농협카드 BC카드

## 11. 찾는 요령

**상품설명서·브랜드 서비스 안내 찾기**
1. 대기열 `cards[].url`(카드 상세 페이지)을 열고 '상품설명서'·'상품안내장'·'국제브랜드 서비스' 링크(PDF)를 찾습니다. `termsUrl`이 있으면 그걸 먼저 엽니다.
2. 카드사별 위치

| 카드사 | 상품설명서·브랜드 서비스가 있는 곳 |
|---|---|
| 신한카드 | 카드 상세 > 상품설명서 PDF(`www.shinhancard.com/pconts/download/card/…`) · 'Visa/Mastercard 서비스 안내' PDF |
| KB국민카드 | 카드 상세(`card.kbcard.com/CXPRICAC0076.cms?…cooperationcode=…`) > 상세혜택 > 티타늄·Visa 서비스 탭, 상품설명서 |
| 삼성카드 | `static11.samsungcard.com/wcms/personal/files/` 의 `*_MASTER_*`·`*_AMEX_*`·`*_VISA_*` PDF (파일명 앞 `26`·`2604`처럼 올해 것 우선) |
| 현대카드 | 카드 상세 > 상품설명서 · 프리미엄 서비스 안내 |
| 우리카드 | 카드 상세 > 상품설명서 · 이벤트(`prgevnt`) 페이지 |
| 하나카드 | `m.hanacard.co.kr/leaflet/` 의 PDF (예: `MW003_2026….pdf` = Mastercard World 공통서비스) |
| 롯데카드 | `image.lottecard.co.kr/webapp/file/` 의 브랜드 서비스 안내 PDF |
| NH농협카드 | 카드 상세 > 채움특별서비스(해외브랜드) · 상품설명서 |
| BC카드·은행 | `www.bccard.com/down/individual/…pdf`, 각 은행 카드 상세 |

3. 국제브랜드 공식 목록(호텔 발레 대상 호텔 등): Mastercard `mastercard.co.kr`의 'Premium Mastercard Services 2026' PDF, Visa·AMEX 한국 사이트. 카드사 안내와 다르면 **카드사 안내가 우선**(대부분 그렇게 적혀 있음).

**옮겨 적는 요령**
- 같은 카드의 안내문이 여러 판이면 **심의필 날짜가 가장 최근**인 것 하나만.
- 표의 '통합 월 n회'·'호텔별 월 n회'·'공항 발렛과 통합' 같은 말은 `quotaScope`·`sharedWith`로 꼭 옮깁니다(사용자가 가장 헷갈려 하는 부분).
- 호텔·가맹점 이름은 **안내문 표기 그대로**(줄이거나 영어로 바꾸지 않음). 지역 구분(서울·기타)은 `city`로.
- '전월 이용금액 30만원 이상', '발급월+1개월까지 유예', '본인 차량에 한해', '영수증 제시' 같은 조건은 해당 칸이나 `conditions`에.
- 금액 단위: '3천원' `3000`, '2만5천원' `25000`, '1백만원' `1000000`.

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


## 12. PR 양식

- 브랜치·파일 이름은 9장 '에이전트별 파일·브랜치 이름'을 따릅니다(Pickle은 `-pickle` 접미사). PR 하나. 제목: `data: 수집 YYYY-MM-DD (<오늘 한 일>)`
- 본문:

```
## 수집 결과
| 종류 | 출처 | 레코드 | 대기열 key |
|---|---|---|---|
| card-terms | 신한카드 | 카드 12종 · 혜택 97줄 | shinhan-201509030001 외 11 |
| brand-services | 삼성카드 | 프로그램 3 | samsung-mastercard-world … |

## 예산
페이지·PDF 21/25 · 레코드 132/150 · 파일 5/12

## 건너뜀
- 현대카드 상품설명서: 로그인 필요 (2회 실패)

## 다음 시작점
cards: kb-09246 부터 · brandPrograms: lotte-visa-platinum 부터

작업 도구: ChatGPT 예약 작업 / Pickle / Claude
```

## 13. 하지 말 것

- `data/inbox/` 밖의 파일 수정, 기존 inbox 파일 수정·삭제
- 공식이 아닌 출처(블로그·커뮤니티·뉴스·비교 사이트)
- 추측·계산으로 채운 값, 작년보다 오래된 안내문
- 개인 맞춤 혜택(로그인해야 보이는 쿠폰), 개인정보
- 양식에 없는 항목 추가 (검사에서 실패합니다)

## 14. 피킹률·혜택 데이터 검수 (모든 에이전트)

카드 상세의 **최고 피킹률**은 `paymorevent/lib/catalog-model.ts`의 `pickingOptions()`가 계산합니다. 화면은 카드 DB 원본이 아니라 아래 순서로 덮은 값을 씁니다(뒤에 있는 것이 이깁니다).

| 순서 | 파일 | 무엇 | 누가 쓰나 |
|---|---|---|---|
| 1 | `paymorevent/data/catalog-snapshot.json` | 카드 DB 원본(목록), `cards.json.gz`는 상세 원본 | 수집·생성 |
| 2 | `paymorevent/data/verified-card-rules.json.gz` | 손으로 검수한 카드 수정(혜택·요율·계획) | 사람·에이전트(근거 필수) |
| 3 | `paymorevent/data/terms-rules.json.gz` | 상품설명서 정리본에서 **기계 변환**한 요율 모델(요율이 없는 카드에만) | `python3 tools/data/terms_to_rules.py` |
| 4 | `paymorevent/data/picking-review.json` | 손 검수한 피킹률 보정(한도·통합 한도·실적 제외·요율 값) | 사람·에이전트 |

### 반드시 지키는 여섯 가지

1. **실적 조건 영역 ≠ 혜택 영역**: "국내 전월실적 100만원 초과 시 해외 4%"처럼 조건이 다른 영역에 걸려 있으면 그 요율에 `minimumSpendArea: '국내'`와 `minimumSpendAreaRewardUnits`(국내 실적에 붙는 기본 적립률, 예 1.2)를 적습니다. 그러면 계산은 **국내 실적 + 같은 금액을 혜택 영역에** 쓴 경우가 되고, 국내 실적에 붙는 기본 적립도 더합니다. 조건 금액을 혜택 영역에 그대로 쓴 것으로 계산하면 없는 피킹률이 나옵니다.
2. **수수료 면제(`feeWaiver`)는 적립률에 섞지 않기**: `rewardUnits`는 안내문의 적립·할인률만, 면제는 `feeWaiver`(rate·minimumSpend·공식 원문 URL·note·verified)로. 면제는 `verified`이고 `feeWaiver.minimumSpend <= 요율 minimumSpend`일 때만 더해집니다.
3. **`rewardRates` 일부 + `rewardModelComplete` 없이 두지 않기**: 한도가 걸린 요율이 있는데 완성 표시가 없으면 피킹률이 비거나 낮은 기본률만 나옵니다. 다 채웠으면 `true`, 아직이면 `rewardCoveragePending: true` + `rewardCoverageNote`.
4. **통합 한도를 영역별로 더하지 않기**: `shared`가 있는 카드(예: 생활 통합 월 1만원)는 `picking-review.json`의 `plans`로 배분합니다. `terms_to_rules.py`는 통합 한도·건당/횟수 제한 카드를 자동 변환에서 뺍니다.
5. **5% 초과는 근거와 함께**: 한도 없는 5% 초과, 캡을 다 채우는 비현실적 가정 금지. 5%를 넘으면 한도·구간·실적 조건을 `note`/`calculationValidation.evidence`에 적습니다.
6. **바꾼 뒤 전수 검사**: `python3 tools/data/picking_audit.py` → 새 A1·A2·A3가 없어야 합니다. 요약은 `docs/picking-audit.md`에 남깁니다.

### 검사 명령

```
python3 tools/data/inbox.py merge              # card-terms.json 만들기(배포와 같은 동작)
python3 tools/data/picking_audit.py            # 전수 검사 · 문제 목록 (A·B·C)
python3 tools/data/picking_audit.py --card nh-90010544   # 카드 하나 계산 과정
python3 tools/data/picking_audit.py --md docs/picking-audit.md   # 요약 저장
python3 tools/data/terms_to_rules.py --dry-run # 기계 변환 몇 장·어떤 값인지 미리보기(저장 안 함)
python3 tools/data/terms_to_rules.py           # terms-rules.json.gz 갱신
cd paymorevent && node scripts/label-audit.mjs # 화면 라벨·적용처·추상 문구·`?` 남은 카드 (실제 benefitRow)
node scripts/label-audit.mjs --card samsung-aap1452 --all    # 카드 하나 · 문제 줄 전부
```

### 검수 항목 (A는 오류·오해, B는 누락, C는 화면 표시·결제 판정)

| 코드 | 무엇을 보나 | 어떻게 처리하나 |
|---|---|---|
| A1 | 수수료 면제가 적립률에 더해져 부풀려 보이는 카드 | 면제가 실제 혜택이면 `feeWaiver`로 두고 가정 줄에 근거, 아니면 빼기 |
| A2 | 실적 조건 영역과 혜택 영역이 다른데 표시가 없는 카드 | `minimumSpendArea`+`minimumSpendAreaRewardUnits` 추가 |
| A3 | 피킹률 5% 초과 | 한도·구간 근거 확인, 없으면 계산에서 빼기 |
| A4 | 요율은 있는데 모델 완성 표시가 없어 피킹률이 비는 카드 | 요율 모델 채우기(`terms_to_rules.py` 또는 손 검수) |
| A5 | 혜택 표와 요율 모델의 실적 조건이 다른 카드 | 대개 혜택별 조건 차이(정상). 아니면 요율 `minimumSpend` 수정 |
| B1 | 상품설명서 정리본은 있는데 피킹률이 비는 카드 | `terms_to_rules.py`로 변환되면 반영, 안 되면 수동 검수 |
| B2 | 정리본 혜택 표가 카드 DB보다 자세한 카드 | 카드 상세는 정리본 표가 쓰이므로 참고만 |
| C1 | 혜택 줄이 추상 문구만 있는 카드("선택 옵션 대상 업종"·"옵션패키지 상세보기" 등, 업종·가맹점 없음) | 원문 서비스 안내를 읽어 대상 업종·가맹점·한도를 채우고, 못 채우면 줄을 빼기 |
| C2 | 혜택은 인정(`benefit: allowed`)인데 전월실적이 `?`(`spend: unknown`)로 남은 칸 | 무실적 카드면 `minimumSpend: 0`을 원문으로 확인(→ `spendFreeCard()`가 ✓로 채움), 실적 조건이 있으면 상품설명서의 실적 제외 목록을 읽어 `spend`를 정하기. 못 읽었으면 `note`에 남기기 |

### 새 카드 요율 모델을 넣는 길

- **정리본이 단순한 카드**(금전 혜택이 모두 `12%` 같은 단일 비율, 통합 한도·건당 제한 없음): `terms_to_rules.py`가 자동으로 넣습니다. 손대지 마세요.
- **통합 한도·건당 제한·혼합 표기(`최대 2만원`, `0.5~1.0%`, `리터당`)가 있는 카드**: 자동 변환이 건너뜁니다. 상품설명서 원문을 읽고 `verified-card-rules.json.gz`(요율·혜택·계획)나 `picking-review.json`(`plans`·`rules`)에 근거와 함께 적습니다.
- **실적 조건이 다른 영역인 카드**: `minimumSpendArea`·`minimumSpendAreaRewardUnits`를 반드시 채웁니다.

### 기록

- 검수 결과는 `data/agent-notes/<내 파일>.json`의 `runs`에 `kind: 'audit'`, 검사한 카드 수·새 문제 수·고친 카드 id로 남기고 `python tools/data/agent_sync.py`로 현황판을 갱신합니다.
- 다른 에이전트가 올린 PR을 검수했으면 그 PR 번호와 결론(통과/지적 사항)을 같이 적습니다. 지적한 카드는 같은 PR에서 고치지 말고, 그 에이전트(또는 다음 수집)가 고치게 남깁니다.
- 고치지 못한 카드는 `skipped`에 `target`(카드 id)·`reason`·`retry`를 적습니다. 다음 에이전트가 같은 카드를 다시 파지 않게 하려는 것입니다.
