// 내 혜택: 등록한 카드(브라우저 mrcards.mine)로 지금 받을 수 있는 카드사 이벤트 모으기 (분야 '기타 광고'는 뺌)
// - 확인됨: 카드사 공지에 대상 카드로 이 카드(같은 상품의 브랜드·디자인 변형 포함)가 적혀 있거나, 카드사 전체 대상이고 종류·브랜드 조건도 맞음 (offerApplies)
// - 확인 필요: 같은 카드사 이벤트인데 공지에 대상 카드가 안 적혀 있음(제목·기간만 아는 이벤트가 대부분).
//   다른 카드 전용이거나, 문구상 체크카드 제외·체크카드 전용·특정 브랜드 전용이라 이 카드가 빠지는 건 뺍니다.
import type {Card, Offer} from './catalog-types';
import {cardFamilyKey, currentMonthOffer, issuerGroup, offerApplies, visibleOffer} from './catalog-model';
import {isDetailed, viewOf} from './event-view';

export type MineMatch = {o: Offer; sure: Card[]; maybe: Card[]};

/** 등록 카드 → 같은 상품의 변형(브랜드·디자인)까지. 이벤트가 변형 id로 대상 카드를 적어 둔 경우가 있어서 */
export function familyOf(card: Card, all: Card[]) {
  const k = cardFamilyKey(card);
  const out = all.filter(c => cardFamilyKey(c) === k);
  return out.length ? out : [card];
}

const BRAND_RX: [string, RegExp][] = [
  ['visa', /비자|visa/i], ['mastercard', /마스터\s*카드|mastercard|master\s*card/i], ['amex', /아멕스|amex|american\s*express|아메리칸\s*익스프레스/i],
  ['unionpay', /유니온\s*페이|unionpay|은련/i], ['jcb', /\bjcb\b/i],
];
const brandKey = (b: string) => { const k = b.toLowerCase().replace(/[\s._-]/g, ''); return /master|마스터/.test(k) ? 'mastercard' : /amex|americanexpress|아멕스/.test(k) ? 'amex' : /unionpay|유니온|은련/.test(k) ? 'unionpay' : k; };

/** '체크·법인·기프트카드 제외'처럼 제외 목록에 그 종류가 들어 있는지. '신용카드(체크·법인 제외)'는 신용카드가 대상이라 신용은 안 빠짐 */
const excluded = (kind: '체크' | '신용', text: string) =>
  new RegExp(`${kind}\\s*(?:카드)?\\s*(?:[·•,/및]\\s*[가-힣A-Za-z]{1,8}?(?:카드)?\\s*)*(?:카드)?\\s*(?:는|은)?\\s*제외`).test(text);
/** '롯데 개인 신용카드로 결제'처럼 개인 신용카드만 적힌 경우('신용·체크'가 같이 적혔으면 아님) */
const creditOnly = (text: string) => /개인\s*신용/.test(text) && !/신용\s*(?:카드)?\s*[·•/,및]\s*체크|체크\s*(?:카드)?\s*[·•/,및]\s*신용/.test(text);

/** 대상 카드가 안 적힌 이벤트에서, 문구로 이 카드가 빠지는지 */
export function textExcludes(card: Card, o: Offer) {
  const title = viewOf(o).title;
  const text = [o.title, o.benefitText, ...(isDetailed(o) ? (o.participation?.length ? o.participation : o.requirements) : [])].join(' ');
  if (card.type === 'debit') {
    if (excluded('체크', text) || creditOnly(text)) return true;                  // "체크·법인·기프트카드 제외", "개인 신용카드로 결제"
    if (viewOf(o).field === '무이자 할부') return true;                             // 체크카드는 할부가 없음
    if (/신용\s*카드\s*(?:회원\s*)?(?:전용|만)|신용\s*카드\s*(?:로|으로)\s*(?:결제|이용)/.test(title) && !/체크/.test(title)) return true;
  } else {
    if (excluded('신용', text)) return true;
    if (/체크\s*카드/.test(title) && !/신용/.test(title)) return true;           // "체크카드로 결제하면…"
  }
  if (/법인|기업|사업자/.test(card.name) && /법인[^.。\n]{0,24}제외/.test(text)) return true;
  // 브랜드를 아는 카드만: 제목에 다른 브랜드 이름이 있으면 그 브랜드 전용("Visa 카드로 해외 결제 시")
  const brands = new Set(card.brands.filter(b => b && b !== '국내전용').map(brandKey));
  const named = BRAND_RX.filter(([, rx]) => rx.test(title)).map(([k]) => k);
  if (brands.size && named.length && !named.some(k => brands.has(k))) return true;
  return false;
}

/** 지금 진행 중인 카드사 이벤트(발급 이벤트 제외) 중 등록 카드로 받을 수 있는 것 */
export function myEvents(mine: Card[], all: Card[], events: Offer[]): MineMatch[] {
  const fams = mine.map(c => ({c, fam: familyOf(c, all), g: c.issuerGroup ?? issuerGroup(c.issuer)}));
  const out: MineMatch[] = [];
  for (const o of events) {
    if (o.kind !== 'card' || !visibleOffer(o) || !currentMonthOffer(o)) continue;
    if (viewOf(o).field === '기타 광고') continue; // 보험·금융상품·가입 유도·여행사 패키지 같은 광고성 이벤트는 빼고 (lib/event-view.ts AD_RX)
    const g = issuerGroup(o.issuer);
    const sure: Card[] = [], maybe: Card[] = [];
    const open = !o.cardTarget && !o.cardIds?.length && !o.cardNames?.length; // 대상 카드가 안 적힌 이벤트
    for (const {c, fam, g: cg} of fams) {
      if (cg !== g) continue;
      if (fam.some(v => offerApplies(v, o))) sure.push(c);
      else if (open && !textExcludes(c, o)) maybe.push(c);
    }
    if (sure.length || maybe.length) out.push({o, sure, maybe});
  }
  // 카드사가 같은 행사를 두 번 올린 경우(같은 제목·마감일) 하나만 — 확인된 쪽을 남김
  const seen = new Map<string, number>();
  const kept: MineMatch[] = [];
  for (const m of out) {
    const k = m.o.issuer + '|' + viewOf(m.o).title + '|' + m.o.endsAt;
    const i = seen.get(k);
    if (i === undefined) { seen.set(k, kept.length); kept.push(m); }
    else if (!kept[i].sure.length && m.sure.length) kept[i] = m;
  }
  return kept;
}
