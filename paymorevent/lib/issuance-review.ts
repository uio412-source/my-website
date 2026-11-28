// Eligibility reviews are not produced by the scraper. Pin to the campaign
// URL, dates and captured excerpt; changed or new rows need a fresh review.
export type Lookback =
  | {kind: 'all'}
  | {kind: 'fixed'; from: string; through: string}
  | {kind: 'before-start'; months: number}
  | {kind: 'rolling'; months: number};

export type ReviewedRules = {
  issuer: string;
  coverage: 'partial' | 'complete';
  payment?: {scope: 'issuer-all' | 'personal-credit'; window: Lookback};
  reward?: Lookback;
  cancellation?: Lookback;
  holder?: 'no-current-holder';
  targetUnused?: {product: string};
  note?: string;
};

type ReviewedCampaign = ReviewedRules & {
  url: string;
  startsAt: string;
  endsAt: string;
  excerpt: string;
};

const november = {startsAt: '2026-11-01', endsAt: '2026-11-30'} as const;
export const REVIEWED_CAMPAIGNS: Readonly<Record<string, ReviewedCampaign>> = {
  'ajd-408': {
    ...november, url: 'https://www.ajd.co.kr/card/event/detail/408',
    excerpt: '행사 시작일 직전 6개월 동안 롯데 개인 신용카드 결제이력(가족카드 결제건, 후불교통카드, 하이패스, 보험료, 아파트관리비, 체크플러스 카드의 신용승인 등)이 있는 회원은 혜택 지급 대상에서 제외됩니다.',
    issuer: '롯데카드', coverage: 'partial',
    payment: {scope: 'personal-credit', window: {kind: 'before-start', months: 6}},
  },
  'ajd-394': {
    ...november, url: 'https://www.ajd.co.kr/card/event/detail/394',
    excerpt: '이벤트 시작일 직전 6개월간 (2026.05.01 ~ 2026.10.31) 우리카드 신용카드 결제이력이 없는 회원',
    issuer: '우리카드', coverage: 'partial',
    payment: {scope: 'personal-credit', window: {kind: 'fixed', from: '2026-05-01', through: '2026-10-31'}},
  },
  'ajd-389': {
    ...november, url: 'https://www.ajd.co.kr/card/event/detail/389',
    excerpt: '모든 현대카드 결제 이력 없는 회원',
    issuer: '현대카드', coverage: 'partial',
    payment: {scope: 'issuer-all', window: {kind: 'all'}},
  },
  'naver-20261027002805865293': {
    ...november,
    url: 'https://card.pay.naver.com/home/promotion?cardCompanyId=CCBC&promotionId=20261027002805865293',
    excerpt: '[이벤트 지급제외 대상] * 이벤트 기간 내 응모를 완료하지 않은 고객(응모는 취소 및 변경 불가) * 혜택 지급이전에 행사대상카드를 해지/다른카드로 교체/ 이용정지/ 분실/ 연체/ 카드폐기/ 반송 등의 사유로 정상적으로 보유하지 않은 회원 * 이벤트 시작일 기준, 직전 2년내(24년 10월 이벤트 ~ 26년 10월 이벤트) IBK의 다른 이용유도이벤트 혜',
    issuer: 'IBK기업은행', coverage: 'partial',
    note: 'IBK 다른 이용유도 이벤트 2년 이력 확인 · 지급 기준 전문 미확인',
  },
};
