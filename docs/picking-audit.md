# Mr. Cards 피킹률·혜택 전수 검사

> `python3 tools/data/picking_audit.py --md docs/picking-audit.md`가 만든 검사 결과입니다. 손으로 고치지 말고 다시 생성하세요.
> 화면과 같은 순서(`catalog-snapshot.json` → `verified-card-rules.json.gz` → `terms-rules.json.gz` → `picking-review.json`)로 계산하고, `pickingOptions()`(lib/catalog-model.ts)를 그대로 옮겨 쓴 사본입니다.

- 검사일 2026-11-28 11:27 · 카드 1,552장 · 요율 모델 있음 341장 · 피킹률 계산됨 187장 · 상품설명서 정리본 763장 · 요율 확인 대기(rewardCoveragePending) 660장

## A1 수수료 면제를 요율에 더한 카드(가정과 원문 확인) — 6건

- 클래시 트래블카드 (`nh-90010544`) {"rate": "해외 기본 적립", "value": 4.25, "waiver": 1.25, "waiverMinimumSpend": 0, "rateMinimumSpend": 0, "note": "면제 %가 같은 적립률에 더해져 표시"}
- 클래시 트래블카드 (`nh-90010544`) {"rate": "해외 우대 적립", "value": 3.23, "waiver": 1.25, "waiverMinimumSpend": 0, "rateMinimumSpend": 1000001, "note": "면제 %가 같은 적립률에 더해져 표시"}
- 신한카드 SOL트래블 (`shinhan-202406130001`) {"rate": "해외 일시불 적립", "value": 1.68, "waiver": 1.18, "waiverMinimumSpend": 0, "rateMinimumSpend": 0, "note": "면제 %가 같은 적립률에 더해져 표시"}
- 카드의정석 EVERY MILE SKYPASS (`woori-102488`) {"rate": "해외 기본+추가 적립 · 월 100만원까지", "value": 5.3, "waiver": 1.3, "waiverMinimumSpend": 0, "rateMinimumSpend": 0, "note": "면제 %가 같은 적립률에 더해져 표시"}
- 트래블월렛 우리카드 (`woori-102722`) {"rate": "해외 수수료 면제 · 무실적", "value": 1.4, "waiver": 1.4, "waiverMinimumSpend": 0, "rateMinimumSpend": 0, "note": "면제 %가 같은 적립률에 더해져 표시"}
- 트래블월렛 우리카드 (`woori-102722`) {"rate": "해외 신용 트래블 포인트 적립", "value": 2.2, "waiver": 1.4, "waiverMinimumSpend": 0, "rateMinimumSpend": 400000, "note": "면제 %가 같은 적립률에 더해져 표시"}

## A2 전월실적 조건 영역과 혜택 영역이 다른 카드 — 0건

없음.

## A3 피킹률 5% 초과(한도·근거 확인) — 8건

- CHALLENGE BAG KB국민카드 (`kb-04409`) {"label": "OK캐쉬백 11%", "value": 11.0, "spend": 400000, "kind": "rate", "cap": 50000}
- 반려愛카드(강아지) (`kb-04260`) {"label": "반려동물", "value": 6.67, "spend": 300000, "kind": "rate", "cap": 20000}
- zgm shopping카드 (`nh-90010505`) {"label": "전월 150만원 최적 배분", "value": 5.33, "spend": 1500000.0, "kind": "plan", "cap": null}
- zgm 할인카드 (`nh-90010515`) {"label": "전월 40만원 최적 배분", "value": 6.17, "spend": 400000.0, "kind": "plan", "cap": null}
- 올바른FLEX카드 (`nh-90010051`) {"label": "전월 30만원 최적 배분", "value": 6.0, "spend": 533095.2380952381, "kind": "plan", "cap": null}
- 아모레퍼시픽 신한카드 (`shinhan-202102250002`) {"label": "아모레퍼시픽 적립", "value": 6.0, "spend": 400000, "kind": "rate", "cap": 24000}
- 카드의정석 EVERY MILE SKYPASS (`woori-102488`) {"label": "해외 기본+추가 적립 · 월 100만원까지", "value": 5.3, "spend": null, "kind": "rate", "cap": null}
- 캐시노트 BUSINESS 현대카드 (`hyundai-smecn`) {"label": "캐시노트플러스", "value": 6.6, "spend": 500000, "kind": "rate", "cap": 33000}

## A4 요율 일부만 있고 모델 완성 표시가 없는 카드 — 51건

- 스폰지밥 체크카드 (`ibk-103828`) {"rates": 1, "picking": null, "benefits": 2}
- 이지캐시백 카드(체크) (`ibk-756655`) {"rates": 1, "picking": null, "benefits": 2}
- Easy auto 티타늄카드 (`kb-09246`) {"rates": 1, "picking": 0.2, "benefits": 2}
- 노리2 체크카드(Global) (`kb-07972`) {"rates": 6, "picking": null, "benefits": 2}
- 노리2 체크카드(KB Pay) (`kb-07964`) {"rates": 7, "picking": null, "benefits": 2}
- 노리2 체크카드(Play) (`kb-07986`) {"rates": 6, "picking": null, "benefits": 2}
- 노리2 학생증체크카드 (`kb-07998`) {"rates": 7, "picking": null, "benefits": 2}
- NH농협 올바른LIFE카드(적립형) (`nh-90010008`) {"rates": 1, "picking": null, "benefits": 2}
- Trip to 로카 (`lotte-P14430-A14430`) {"rates": 2, "picking": null, "benefits": 2}
- Trip to 로카 (`lotte-P15667-A15667`) {"rates": 2, "picking": null, "benefits": 2}
- Trip to 로카 (`lotte-P15668-A15668`) {"rates": 2, "picking": null, "benefits": 2}
- Trip to 로카 (`lotte-P15669-A15669`) {"rates": 2, "picking": null, "benefits": 2}
- Trip to 로카 (`lotte-P15678-A15678`) {"rates": 2, "picking": null, "benefits": 2}
- KTX 삼성카드 (`samsung-aap1864`) {"rates": 3, "picking": null, "benefits": 2}
- SFC THE iD. 1st (`samsung-aap1887`) {"rates": 1, "picking": null, "benefits": 2}
- T 라이트 삼성카드 (`samsung-aap1613`) {"rates": 2, "picking": null, "benefits": 2}
- THE iD. 1st (`samsung-aap1886`) {"rates": 1, "picking": null, "benefits": 2}
- TRADERS CLUB 삼성카드 (`samsung-aap1781`) {"rates": 2, "picking": null, "benefits": 2}
- taptap SHOPPING (`samsung-aap1668`) {"rates": 3, "picking": null, "benefits": 2}
- 국민행복 삼성체크카드 V2 (`samsung-abp1689`) {"rates": 2, "picking": null, "benefits": 2}
- 국민행복 삼성카드 V2 (`samsung-aap1688`) {"rates": 4, "picking": null, "benefits": 2}
- 다이소 삼성카드 (`samsung-aap1653`) {"rates": 3, "picking": 1.0, "benefits": 2}
- 번개장터 삼성카드 (`samsung-aap1873`) {"rates": 2, "picking": 2.0, "benefits": 2}
- 삼성 BIZ iD BENEFIT 카드 (`samsung-aap1758`) {"rates": 3, "picking": null, "benefits": 2}
- 삼성 SFC iD SELECT UP 카드 (`samsung-aap1914`) {"rates": 3, "picking": 2.0, "benefits": 2}
- 삼성 iD GLOBAL 카드 (`samsung-aap1824`) {"rates": 5, "picking": null, "benefits": 2}
- 삼성 iD SELECT UP 카드 (`samsung-aap1913`) {"rates": 3, "picking": 2.0, "benefits": 2}
- 삼성 iD 해외 3.5 카드 (`samsung-aap1921`) {"rates": 2, "picking": 3.5, "benefits": 2}
- Air Money (`cu-1040`) {"rates": 1, "picking": null, "benefits": 2}
- E1 우리카드 (`woori-103564`) {"rates": 1, "picking": null, "benefits": 1}
- KREAM Platinum 우리카드 (`woori-104156`) {"rates": 2, "picking": null, "benefits": 2}
- KREAM 체크카드 (`woori-103117`) {"rates": 2, "picking": null, "benefits": 2}
- LG전자 우리카드 (`woori-102535`) {"rates": 1, "picking": null, "benefits": 2}
- SK인텔릭스 우리카드 (`woori-102859`) {"rates": 1, "picking": null, "benefits": 1}
- ZEROSE 우리카드 (`woori-500047`) {"rates": 1, "picking": null, "benefits": 2}
- 교원웰스 우리카드Ⅱ (`woori-103737`) {"rates": 1, "picking": null, "benefits": 1}
- 넥센타이어 우리카드 Ⅱ (`woori-102724`) {"rates": 1, "picking": null, "benefits": 1}
- 바디프랜드 우리카드 Ⅱ (`woori-102858`) {"rates": 1, "picking": null, "benefits": 2}
- 우리WON모바일 체크카드 (`woori-103687`) {"rates": 1, "picking": null, "benefits": 2}
- 우리WON모바일 카드 (`woori-103457`) {"rates": 1, "picking": null, "benefits": 1}
- 청호나이스 우리카드Ⅱ (`woori-103725`) {"rates": 1, "picking": null, "benefits": 2}
- 카드의정석 LCK 우리체크 (`woori-103116`) {"rates": 1, "picking": 0.2, "benefits": 2}
- 카드의정석2 ROUTINE (`woori-500045`) {"rates": 2, "picking": null, "benefits": 2}
- 카드의정석2 SOLID (`woori-500107`) {"rates": 1, "picking": 1.2, "benefits": 2}
- 쿠쿠 우리카드 (`woori-102857`) {"rates": 1, "picking": null, "benefits": 2}
- 하이마트 우리카드 (`woori-102734`) {"rates": 1, "picking": null, "benefits": 2}
- 현대렌탈케어 우리카드Ⅱ (`woori-103738`) {"rates": 1, "picking": null, "benefits": 1}
- 트래블GO 체크카드 (`hana-18062`) {"rates": 1, "picking": null, "benefits": 2}
- 트래블로그 체크카드 (`hana-15406`) {"rates": 1, "picking": null, "benefits": 2}
- 국민행복 현대체크카드 (`hyundai-phhcc`) {"rates": 1, "picking": null, "benefits": 2}
- 현대카드X (`hyundai-xpe4`) {"rates": 1, "picking": null, "benefits": 2}

## A5 (참고) 혜택별 실적이 달라 요율 모델이 일부 영역만 덮는 카드 — 6건

- KT 할부 S 삼성카드 (`samsung-aap1839`) {"benefitMinSpend": 400000, "rateMinSpend": 800000, "rates": 2}
- T 라이트 삼성카드 (`samsung-aap1613`) {"benefitMinSpend": 400000, "rateMinSpend": 800000, "rates": 2}
- U+ 라이트 삼성카드 (`samsung-aap1893`) {"benefitMinSpend": 400000, "rateMinSpend": 800000, "rates": 2}
- 현대카드MY BUSINESS X E-seller (`hyundai-xmbes`) {"benefitMinSpend": 500000, "rateMinSpend": 1000000, "rates": 1}
- 현대카드MY BUSINESS X F&B (`hyundai-xmbfb`) {"benefitMinSpend": 500000, "rateMinSpend": 1000000, "rates": 1}
- 현대카드MY BUSINESS X Retail (`hyundai-xmbrt`) {"benefitMinSpend": 500000, "rateMinSpend": 1000000, "rates": 1}

## B1 상품설명서 정리본은 있는데 피킹률이 비는 카드 — 614건

- BC 바로 ZONE 카드 (`bc-104520`) {"issuer": "BC 바로카드", "termBenefits": 10, "minimumSpend": 300000, "rates": 0, "pending": true, "benefits": 2}
- BC 바로 에어마스터 (`bc-104452`) {"issuer": "BC 바로카드", "termBenefits": 3, "minimumSpend": 500000, "rates": 0, "pending": false, "benefits": 2}
- BC 바로 에어맥스 (`bc-104453`) {"issuer": "BC 바로카드", "termBenefits": 8, "minimumSpend": 500000, "rates": 0, "pending": false, "benefits": 2}
- KT SUPER DC BC 바로카드 (`bc-104063`) {"issuer": "BC 바로카드", "termBenefits": 3, "minimumSpend": 400000, "rates": 0, "pending": true, "benefits": 2}
- KT 마이알뜰폰 BC 바로카드 (`bc-103127`) {"issuer": "BC 바로카드", "termBenefits": 2, "minimumSpend": 300000, "rates": 0, "pending": true, "benefits": 2}
- MACAO 카드 (`bc-101010`) {"issuer": "BC 바로카드", "termBenefits": 3, "minimumSpend": 300000, "rates": 0, "pending": true, "benefits": 2}
- kt DC PLUS 카드 (`bc-103125`) {"issuer": "BC 바로카드", "termBenefits": 2, "minimumSpend": 300000, "rates": 0, "pending": true, "benefits": 2}
- 로스트아크 카드 (`bc-101686`) {"issuer": "BC 바로카드", "termBenefits": 3, "minimumSpend": 0, "rates": 0, "pending": true, "benefits": 2}
- 모두의그린카드 (`bc-105424`) {"issuer": "BC 바로카드", "termBenefits": 5, "minimumSpend": 300000, "rates": 0, "pending": true, "benefits": 2}
- 밥바라밥 페이북머니 체크카드 (`bc-102095`) {"issuer": "BC 바로카드", "termBenefits": 4, "minimumSpend": 200000, "rates": 0, "pending": true, "benefits": 2}
- 신세계 SEVEN FLEX (`bc-101883`) {"issuer": "BC 바로카드", "termBenefits": 5, "minimumSpend": 300000, "rates": 0, "pending": true, "benefits": 2}
- 신세계 리워드 플러스 (`bc-101877`) {"issuer": "BC 바로카드", "termBenefits": 6, "minimumSpend": 300000, "rates": 0, "pending": true, "benefits": 2}
- 신세계 콰트로 플러스 (`bc-101874`) {"issuer": "BC 바로카드", "termBenefits": 5, "minimumSpend": 300000, "rates": 0, "pending": true, "benefits": 2}
- 신세계 클리어 플러스 (`bc-101881`) {"issuer": "BC 바로카드", "termBenefits": 8, "minimumSpend": 200000, "rates": 0, "pending": true, "benefits": 2}
- 케이뱅크 히든카드 (`bc-105000`) {"issuer": "BC 바로카드", "termBenefits": 3, "minimumSpend": 400000, "rates": 1, "pending": true, "benefits": 2}
- 페이북카드 (`bc-105052`) {"issuer": "BC 바로카드", "termBenefits": 5, "minimumSpend": 400000, "rates": 2, "pending": true, "benefits": 2}
- BLISS Mileage (`ibk-104506`) {"issuer": "IBK기업은행", "termBenefits": 2, "minimumSpend": 500000, "rates": 0, "pending": false, "benefits": 2}
- BLISS.5 (IBK) SKYPASS (`ibk-033103`) {"issuer": "IBK기업은행", "termBenefits": 2, "minimumSpend": 0, "rates": 0, "pending": false, "benefits": 2}
- BLISS.5 (IBK) TOP (`ibk-034721`) {"issuer": "IBK기업은행", "termBenefits": 2, "minimumSpend": 0, "rates": 0, "pending": false, "benefits": 2}
- BOC(福) (`ibk-104417`) {"issuer": "IBK기업은행", "termBenefits": 1, "minimumSpend": 500000, "rates": 0, "pending": false, "benefits": 1}
- Hola IYTC 국제청소년증 체크카드 (`ibk-756147`) {"issuer": "IBK기업은행", "termBenefits": 2, "minimumSpend": 200000, "rates": 0, "pending": true, "benefits": 2}
- I-Campus(일상생활형) (`ibk-104311`) {"issuer": "IBK기업은행", "termBenefits": 2, "minimumSpend": 300000, "rates": 0, "pending": true, "benefits": 2}
- I-Mileage(대한항공마일리지) (`ibk-103401`) {"issuer": "IBK기업은행", "termBenefits": 4, "minimumSpend": 500000, "rates": 0, "pending": true, "benefits": 2}
- I-Travel (`ibk-104084`) {"issuer": "IBK기업은행", "termBenefits": 1, "minimumSpend": 500000, "rates": 0, "pending": false, "benefits": 2}
- I-기후동행카드 (`ibk-104073`) {"issuer": "IBK기업은행", "termBenefits": 3, "minimumSpend": 0, "rates": 1, "pending": true, "benefits": 2}
- I-어디로든그린카드 (`ibk-103214`) {"issuer": "IBK기업은행", "termBenefits": 3, "minimumSpend": 0, "rates": 0, "pending": true, "benefits": 2}
- K22 Mileage SKYPASS (`ibk-103039`) {"issuer": "IBK기업은행", "termBenefits": 2, "minimumSpend": 500000, "rates": 0, "pending": false, "benefits": 2}
- K22 Point (`ibk-103038`) {"issuer": "IBK기업은행", "termBenefits": 2, "minimumSpend": 500000, "rates": 0, "pending": false, "benefits": 2}
- Olleh Super DC카드 (`ibk-755847`) {"issuer": "IBK기업은행", "termBenefits": 1, "minimumSpend": 300000, "rates": 0, "pending": true, "benefits": 2}
- 부자되세요 더 마일리지(체크) (`ibk-756228`) {"issuer": "IBK기업은행", "termBenefits": 1, "minimumSpend": 300000, "rates": 0, "pending": true, "benefits": 2}
- 안녕 체크카드 (`ibk-756202`) {"issuer": "IBK기업은행", "termBenefits": 3, "minimumSpend": 200000, "rates": 0, "pending": true, "benefits": 2}
- 알토스카드 (`ibk-101642`) {"issuer": "IBK기업은행", "termBenefits": 1, "minimumSpend": 0, "rates": 0, "pending": true, "benefits": 2}
- 용인시민카드(신용) (`ibk-756176`) {"issuer": "IBK기업은행", "termBenefits": 1, "minimumSpend": 300000, "rates": 0, "pending": true, "benefits": 2}
- 용인시민카드(체크) (`ibk-756189`) {"issuer": "IBK기업은행", "termBenefits": 1, "minimumSpend": 200000, "rates": 0, "pending": true, "benefits": 2}
- 이지캐시백 카드(체크) (`ibk-756655`) {"issuer": "IBK기업은행", "termBenefits": 2, "minimumSpend": 300000, "rates": 1, "pending": false, "benefits": 2}
- 인피니트 스카이패스 카드 (`ibk-225018`) {"issuer": "IBK기업은행", "termBenefits": 2, "minimumSpend": 0, "rates": 0, "pending": false, "benefits": 2}
- 일상의 기쁨(신용) (`ibk-927222`) {"issuer": "IBK기업은행", "termBenefits": 1, "minimumSpend": 500000, "rates": 0, "pending": true, "benefits": 2}
- 일상의 기쁨(체크) (`ibk-927235`) {"issuer": "IBK기업은행", "termBenefits": 1, "minimumSpend": 300000, "rates": 0, "pending": true, "benefits": 2}
- 참! 좋은 kt wiz카드(신용) (`ibk-755889`) {"issuer": "IBK기업은행", "termBenefits": 1, "minimumSpend": 0, "rates": 0, "pending": false, "benefits": 2}
- 참! 좋은 kt wiz카드(체크) (`ibk-755892`) {"issuer": "IBK기업은행", "termBenefits": 1, "minimumSpend": 0, "rates": 0, "pending": false, "benefits": 2}
- 참! 좋은 다이소카드(체크) (`ibk-756309`) {"issuer": "IBK기업은행", "termBenefits": 1, "minimumSpend": 200000, "rates": 0, "pending": true, "benefits": 2}
- 하이틴즈(Hi TEENS Check) (`ibk-100026`) {"issuer": "IBK기업은행", "termBenefits": 1, "minimumSpend": 100000, "rates": 0, "pending": true, "benefits": 2}
- AK KB국민카드 (`kb-04444`) {"issuer": "KB국민카드", "termBenefits": 2, "minimumSpend": 300000, "rates": 0, "pending": false, "benefits": 2}
- ALL point 카드 (`kb-09162`) {"issuer": "KB국민카드", "termBenefits": 10, "minimumSpend": 0, "rates": 0, "pending": true, "benefits": 2}
- ALL 카드 (`kb-09922`) {"issuer": "KB국민카드", "termBenefits": 5, "minimumSpend": 0, "rates": 1, "pending": true, "benefits": 2}
- BeV Ⅲ 카드 (`kb-09310`) {"issuer": "KB국민카드", "termBenefits": 18, "minimumSpend": 500000, "rates": 0, "pending": true, "benefits": 2}
- BeV Ⅴ카드 (스카이패스형) (`kb-09306`) {"issuer": "KB국민카드", "termBenefits": 26, "minimumSpend": 500000, "rates": 0, "pending": false, "benefits": 2}
- BeV Ⅴ카드 (포인트형) (`kb-09305`) {"issuer": "KB국민카드", "termBenefits": 26, "minimumSpend": 500000, "rates": 0, "pending": true, "benefits": 2}
- E1 LPG KB국민카드 (`kb-04459`) {"issuer": "KB국민카드", "termBenefits": 7, "minimumSpend": 500000, "rates": 0, "pending": true, "benefits": 2}
- EV 카드 (`kb-00230`) {"issuer": "KB국민카드", "termBenefits": 5, "minimumSpend": 400000, "rates": 0, "pending": false, "benefits": 2}
- Easy on카드 (`kb-09244`) {"issuer": "KB국민카드", "termBenefits": 6, "minimumSpend": 500000, "rates": 0, "pending": false, "benefits": 2}
- Easy shopping카드 (`kb-09064`) {"issuer": "KB국민카드", "termBenefits": 8, "minimumSpend": 500000, "rates": 0, "pending": false, "benefits": 2}
- GS SHOP KB국민카드 (`kb-04431`) {"issuer": "KB국민카드", "termBenefits": 4, "minimumSpend": 400000, "rates": 0, "pending": true, "benefits": 2}
- HERITAGE Classic[스카이패스형] (`kb-09139`) {"issuer": "KB국민카드", "termBenefits": 7, "minimumSpend": 500000, "rates": 0, "pending": false, "benefits": 1}
- HERITAGE Exclusive (`kb-09129`) {"issuer": "KB국민카드", "termBenefits": 15, "minimumSpend": 0, "rates": 0, "pending": true, "benefits": 2}
- HERITAGE Reserve [포인트형] (`kb-09127`) {"issuer": "KB국민카드", "termBenefits": 13, "minimumSpend": 0, "rates": 0, "pending": false, "benefits": 1}
- HERITAGE Reserve[스카이패스형] (`kb-09128`) {"issuer": "KB국민카드", "termBenefits": 12, "minimumSpend": 0, "rates": 0, "pending": false, "benefits": 1}
- KB국민 펫코노미 카드 (`kb-04404`) {"issuer": "KB국민카드", "termBenefits": 4, "minimumSpend": 300000, "rates": 0, "pending": false, "benefits": 2}
- KB라이프 딱좋은 요즘 건강 KB카드 (`kb-09579`) {"issuer": "KB국민카드", "termBenefits": 2, "minimumSpend": 400000, "rates": 0, "pending": false, "benefits": 2}
- KT 할부 Plus KB국민카드 (`kb-01507`) {"issuer": "KB국민카드", "termBenefits": 2, "minimumSpend": 300000, "rates": 0, "pending": false, "benefits": 2}
- … 외 554건 (--detail 로 전체 표)

## B2 정리본 혜택 표가 카드 DB보다 자세한 카드 — 341건

- BC 바로 On＆Off 카드 (`bc-102040`) {"cardBenefits": 2, "termBenefits": 5}
- BC 바로 ZONE 카드 (`bc-104520`) {"cardBenefits": 2, "termBenefits": 10}
- BC 바로 에어맥스 (`bc-104453`) {"cardBenefits": 2, "termBenefits": 8}
- 모두의그린카드 (`bc-105424`) {"cardBenefits": 2, "termBenefits": 5}
- 밥바라밥 페이북머니 체크카드 (`bc-102095`) {"cardBenefits": 2, "termBenefits": 4}
- 신세계 SEVEN FLEX (`bc-101883`) {"cardBenefits": 2, "termBenefits": 5}
- 신세계 리워드 플러스 (`bc-101877`) {"cardBenefits": 2, "termBenefits": 6}
- 신세계 콰트로 플러스 (`bc-101874`) {"cardBenefits": 2, "termBenefits": 5}
- 신세계 클리어 플러스 (`bc-101881`) {"cardBenefits": 2, "termBenefits": 8}
- 신세계 푸빌라 (`bc-102603`) {"cardBenefits": 2, "termBenefits": 5}
- 페이북카드 (`bc-105052`) {"cardBenefits": 2, "termBenefits": 5}
- I-Mileage(대한항공마일리지) (`ibk-103401`) {"cardBenefits": 2, "termBenefits": 4}
- ALL point 카드 (`kb-09162`) {"cardBenefits": 2, "termBenefits": 10}
- ALL 카드 (`kb-09922`) {"cardBenefits": 2, "termBenefits": 5}
- BeV Ⅲ 카드 (`kb-09310`) {"cardBenefits": 2, "termBenefits": 18}
- BeV Ⅴ카드 (스카이패스형) (`kb-09306`) {"cardBenefits": 2, "termBenefits": 26}
- BeV Ⅴ카드 (포인트형) (`kb-09305`) {"cardBenefits": 2, "termBenefits": 26}
- E1 LPG KB국민카드 (`kb-04459`) {"cardBenefits": 2, "termBenefits": 7}
- EV 카드 (`kb-00230`) {"cardBenefits": 2, "termBenefits": 5}
- Easy on카드 (`kb-09244`) {"cardBenefits": 2, "termBenefits": 6}
- Easy shopping카드 (`kb-09064`) {"cardBenefits": 2, "termBenefits": 8}
- GS SHOP KB국민카드 (`kb-04431`) {"cardBenefits": 2, "termBenefits": 4}
- HERITAGE Classic[스카이패스형] (`kb-09139`) {"cardBenefits": 1, "termBenefits": 7}
- HERITAGE Exclusive (`kb-09129`) {"cardBenefits": 2, "termBenefits": 15}
- HERITAGE Reserve [포인트형] (`kb-09127`) {"cardBenefits": 1, "termBenefits": 13}
- HERITAGE Reserve[스카이패스형] (`kb-09128`) {"cardBenefits": 1, "termBenefits": 12}
- KB국민 펫코노미 카드 (`kb-04404`) {"cardBenefits": 2, "termBenefits": 4}
- My WE:SH 카드 (`kb-09923`) {"cardBenefits": 2, "termBenefits": 7}
- NEED Pay 카드 (`kb-09800`) {"cardBenefits": 2, "termBenefits": 7}
- On the Go 체크카드 (`kb-09701`) {"cardBenefits": 2, "termBenefits": 6}
- SK인텔릭스 올림 KB국민카드 (`kb-04418`) {"cardBenefits": 2, "termBenefits": 5}
- WE:SH All+ 카드 (`kb-09297`) {"cardBenefits": 2, "termBenefits": 6}
- WE:SH Travel (`kb-09561`) {"cardBenefits": 2, "termBenefits": 8}
- Wavve 카드 (`kb-04287`) {"cardBenefits": 2, "termBenefits": 4}
- YOU Prime 카드 (`kb-09771`) {"cardBenefits": 2, "termBenefits": 13}
- YOU Wish 카드 (`kb-09780`) {"cardBenefits": 2, "termBenefits": 8}
- Youth Club 체크카드 (`kb-04124`) {"cardBenefits": 2, "termBenefits": 8}
- 가온 올포인트 체크카드 (`kb-01998`) {"cardBenefits": 2, "termBenefits": 7}
- 가온 플래티늄바우처카드 (`kb-09200`) {"cardBenefits": 2, "termBenefits": 7}
- 교원 웰스 KB국민카드 (`kb-04417`) {"cardBenefits": 2, "termBenefits": 6}
- 굿데이카드 (`kb-09061`) {"cardBenefits": 2, "termBenefits": 5}
- 노리2 체크카드(Global) (`kb-07972`) {"cardBenefits": 2, "termBenefits": 14}
- 다담카드(비 OTP) (`kb-09169`) {"cardBenefits": 2, "termBenefits": 5}
- 두산베어스 KB체크카드 (`kb-02212`) {"cardBenefits": 2, "termBenefits": 5}
- 두산베어스 KB카드 (`kb-02219`) {"cardBenefits": 2, "termBenefits": 5}
- 마라톤카드 (`kb-09821`) {"cardBenefits": 2, "termBenefits": 5}
- 볼트업 KB EV 카드 (`kb-00236`) {"cardBenefits": 2, "termBenefits": 5}
- 사장님카드 (`kb-09291`) {"cardBenefits": 2, "termBenefits": 4}
- 샘 쏘영 체크카드 (`kb-01574`) {"cardBenefits": 2, "termBenefits": 6}
- 쏘영 체크카드 (`kb-01570`) {"cardBenefits": 2, "termBenefits": 6}
- 에버온 EV 카드 (`kb-00235`) {"cardBenefits": 2, "termBenefits": 5}
- 이마트II KB국민카드 (`kb-04361`) {"cardBenefits": 2, "termBenefits": 4}
- 직장인보너스체크카드 (`kb-01690`) {"cardBenefits": 2, "termBenefits": 10}
- 청춘대로 톡톡카드 (`kb-09174`) {"cardBenefits": 2, "termBenefits": 4}
- 첵첵 체크카드 (`kb-01914`) {"cardBenefits": 2, "termBenefits": 9}
- GS리테일 NH농협카드 (`nh-90010162`) {"cardBenefits": 2, "termBenefits": 4}
- ME+(미플러스)카드 (`nh-90000237`) {"cardBenefits": 2, "termBenefits": 5}
- NH 모두의카드(신용) (`nh-90010471`) {"cardBenefits": 3, "termBenefits": 10}
- NH 모두의카드(체크) (`nh-90010470`) {"cardBenefits": 2, "termBenefits": 6}
- NH1961체크카드 (`nh-90010117`) {"cardBenefits": 2, "termBenefits": 5}
- … 외 281건 (--detail 로 전체 표)

## C1 혜택 줄이 추상 문구만 있는 카드(대상 업종·가맹점 없음) — 1건

- 삼성카드 taptap O (`samsung-aap1483`) {"title": "옵션패키지 상세보기", "detail": "옵션패키지 상세보기"}

## C2 혜택은 인정인데 전월실적이 ?로 남은 칸 — 12건

- BC 바로 에어맥스 (`bc-104453`) {"items": ["관리비"], "minimumSpend": null, "무실적": false}
- 부자되세요 아파트카드(비씨) (`nh-90000371`) {"items": ["관리비"], "minimumSpend": null, "무실적": false}
- 그린카드(전국) (`im-310253`) {"items": ["상품권 가능", "관리비"], "minimumSpend": null, "무실적": true}
- 삼성 BIZ iD BENEFIT 카드 (`samsung-aap1758`) {"items": ["관리비"], "minimumSpend": 0, "무실적": false}
- 삼성 SFC iD ALL 카드 (`samsung-aap1728`) {"items": ["관리비"], "minimumSpend": 0, "무실적": false}
- 삼성 SFC iD ALL 카드 (포인트) (`samsung-aap1730`) {"items": ["관리비"], "minimumSpend": 0, "무실적": false}
- 삼성 iD ALL 카드 (`samsung-aap1727`) {"items": ["관리비"], "minimumSpend": 0, "무실적": false}
- 삼성 iD ALL 카드 (포인트) (`samsung-aap1729`) {"items": ["관리비"], "minimumSpend": 0, "무실적": false}
- 신한카드 The CLASSIC+ (`shinhan-201507300001`) {"items": ["관리비", "국세"], "minimumSpend": null, "무실적": true}
- the OPUS blue (`woori-500049`) {"items": ["상품권 가능", "국세", "지방세"], "minimumSpend": 0, "무실적": false}
- 하나 더 넥스트 멤버스 (`hana-18370`) {"items": ["관리비"], "minimumSpend": 500000, "무실적": false}
- 하나멤버스 1Q(원큐) 카드 Business (`hana-5230`) {"items": ["관리비"], "minimumSpend": 300000, "무실적": false}
