// 호텔 기능은 2026-11에 제거했습니다. 카드사 이벤트 중 호텔·리조트가 직접 주는 혜택
// (객실·다이닝·스파·멤버십 등급, 호텔 체인 할인, 프리미엄 카드 호텔 서비스)은 숨기고,
// 아고다·호텔스닷컴·트립닷컴 같은 여행 예약 사이트·여행사 할인과 골프장 이벤트는 남깁니다.
// 카드 발급 이벤트(kind: cashback)는 카드 이름에 호텔이 들어가도 카드 혜택이므로 남깁니다.
// 앱(pages/main.tsx)과 빌드 스크립트(scripts/publish-detail-pages.mjs)가 같은 기준을 씁니다.

// 호텔·리조트 이름과 호텔 자체 서비스. 예약 사이트 이벤트에 같이 나와도 숨깁니다.
const HOTEL_BRAND = /메리어트|marriott|본보이|bonvoy|힐튼|hilton|하얏트|hyatt|아코르|accor|\bIHG\b|웨스틴|westin|시그니엘|signiel|파르나스|parnas|풀만|pullman|머큐어|mercure|노보텔|novotel|조선\s*팰리스|그랜드\s*조선|롯데\s*호텔|신라\s*호텔|래디슨|radisson|밀레니엄\s*호텔|프리퍼드\s*호텔|소노\s*호텔|금호\s*리조트|특급\s*호텔|럭셔리\s*리조트|제휴\s*호텔|호텔\s*(?:식사권|F&B|다이닝|뷔페|라운지|서비스|멤버십)/i;
// 여행 예약 사이트·여행사·카드사 여행 몰. 호텔은 여러 상품 중 하나라 남깁니다.
const BOOKING_SITE = /아고다|agoda|호텔스닷컴|hotels\.com|익스피디아|expedia|트립닷컴|trip\.com|호텔패스|라쿠텐|rakuten|트래블|travel|하나투어|모두투어|여행도\s*가격\s*비교|제휴사별/i;
// 그 밖에 호텔·숙박이 주제인 이벤트
const HOTEL_TOPIC = /호텔|hotel|리조트|resort|숙박|투숙|객실/i;
const GOLF = /골프|golf|\bcc\b/i;
// "신한카드Haru(Hoshino Resort)"처럼 괄호까지 붙은 카드 이름
const CARD_NAME = /[\w가-힣]*카드[\w가-힣]*\s*\([^)]*\)/g;

/**
 * 이벤트가 무엇에 관한 것인지는 제목과 짧은 부제(보통 장소 이름)로 판단합니다.
 * 긴 혜택 설명은 여러 혜택을 나열하다 호텔 이름이 한 번 나오는 경우가 많아 보지 않습니다.
 * @param {{kind?: string; title?: string; benefitText?: string; description?: string; cardNames?: string[]}} offer
 */
export function isHotelOffer(offer) {
  if (offer.kind === 'hotel') return true;
  if (offer.kind === 'cashback') return false;
  const title = offer.title ?? '', benefit = offer.benefitText ?? '';
  let subject = benefit.length <= 60 && benefit !== title ? `${title} ${benefit}` : title;
  for (const name of offer.cardNames ?? []) subject = subject.replaceAll(name, ' ');
  subject = subject.replace(CARD_NAME, ' ');
  if (HOTEL_BRAND.test(subject)) return true;
  if (BOOKING_SITE.test([title, benefit, offer.description ?? ''].join(' '))) return false;
  return HOTEL_TOPIC.test(subject) && !GOLF.test(subject);
}

/** 호텔 자체 혜택을 뺀 이벤트 목록 */
export function withoutHotelOffers(offers) {
  return offers.filter(offer => !isHotelOffer(offer));
}
