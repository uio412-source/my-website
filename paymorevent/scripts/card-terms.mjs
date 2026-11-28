import {existsSync, readFileSync} from 'node:fs';
import {koreaDay, stoppedIssuance} from './issuance-status.mjs';

// 상품설명서 정리본(data/inbox/card-terms, docs/data-update.md 7장)을 카드 상세(card-data/<id>.json)에 붙입니다.
// data/card-terms.json은 배포 때 tools/data/inbox.py merge가 만듭니다(커밋 안 함). 없으면 아무것도 안 붙입니다.
// 에이전트가 모은 검토 전 자료라 단계적으로 씁니다:
//  - 카드 DB와 이름·신용/체크가 다르면(다른 카드를 적었을 수 있음) 붙이지 않음
//  - 혜택 표는 정리본이 카드 DB 혜택을 COVER 이상 담고 있거나, 카드 DB보다 두 배 넘게 자세할 때만 상품설명서 표로 바꿈
//    (일부만 옮긴 정리본은 기존 표 유지)
//  - 카드 전월실적 0은 카드 DB 혜택에 실적 조건이 없을 때만 씀(공통 기준을 못 읽고 0으로 적은 경우가 많음)

export const TERMS_FILE = new URL('../data/card-terms.json', import.meta.url);
export const COVER = 0.6;

export function readCardTerms(file = TERMS_FILE) {
  if (!existsSync(file)) return [];
  const data = JSON.parse(readFileSync(file, 'utf8'));
  return Array.isArray(data?.cards) ? data.cards : [];
}

const PREFIX = /^(?:신한카드|신한은행|신한|kb국민카드|kb국민|kb|nh농협카드|nh농협|nh|농협|하나카드|하나|롯데카드|롯데|삼성카드|삼성|현대카드|현대|우리카드|우리|bc\s*바로카드|bc\s*바로|bc카드|bc|sc제일은행|sc제일|광주은행|mg새마을금고)\s*/;
/** 카드사명·괄호·'카드'·'체크'·기호를 뺀 이름 ("KB국민 노리2 체크카드" = "노리2 체크카드(Global)") */
export function looseName(name) {
  return String(name ?? '').normalize('NFKC').toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(PREFIX, '').replace(/bc\s*바로/g, '')
    .replace(/카드|체크|신용/g, '').replace(/[^0-9a-z가-힣]/g, '');
}
export function sameCard(terms, card) {
  if (terms.cardType !== card.type) return false;
  const a = looseName(terms.name), b = looseName(card.name);
  // '신한카드 봄'·'신한카드 집'처럼 이름이 한 글자면 똑같을 때만
  return a === b ? a.length > 0 : a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a));
}

// 혜택 표 대조: 카드 DB 혜택 제목(없으면 설명 앞부분)의 낱말이 정리본(구분·적용처·조건)에 있으면 담은 것으로 봄.
// '할인서비스'·'생활영역'처럼 어느 혜택인지 알 수 없는 제목은 설명 앞부분 낱말로 봄
// 국제브랜드 서비스(Visa·Mastercard … 서비스)는 정리본에서 brand-services로 따로 모으므로 대조에서 뺌
const NOT_BENEFIT = /안내|유의|란\s*\?|연회비|실적\s*(?:제외|기준|안내|산정)|^\[|이용\s*방법|할부\s*서비스$|발급|가족카드|포인트\s*(?:사용|전환)|^기타$|제휴사$|(?:visa|master(?:card)?|amex|unionpay|upi|jcb|diners)\b.*서비스/i;
const STOP = /^(?:할인|적립|결제일|청구할인|현장할인|캐시백|서비스|혜택|이용|이용시|및|최대|제공|무료|특별할인|기본할인|기본|추가|포인트|포인트리|이용금액|이용액|금액|주요|업종|가맹점|이상|건당|결제|청구|일시불|할부|전월|실적|가능|대상|등|외|월|연|일|회|시|만원|천원|원|and|or|할인서비스|적립서비스|쿠폰서비스|부가서비스|생활|영역|생활영역|특화|특화할인|공통|일상|라이프|국내|해외|이용실적|한도|할인한도|적립한도|구분|내용|제공서비스|선택|서비스제공)$/;
const flat = text => String(text ?? '').normalize('NFKC').toLowerCase();
export function words(text) {
  return flat(text).replace(/[\d.,%]+/g, ' ').split(/[^0-9a-z가-힣]+/)
    .map(w => w.replace(/(?:의|에서|을|를|은|는|이용|할인|적립)$/, '')).filter(w => w.length >= 2 && !STOP.test(w));
}
export function coverage(terms, card) {
  const text = flat(terms.benefits.map(b => [b.group, b.label, b.place, b.limits, ...(b.conditions ?? [])].join(' ')).join(' ')).replace(/[^0-9a-z가-힣]/g, '');
  let considered = 0, covered = 0;
  for (const b of card.benefits ?? []) {
    if (NOT_BENEFIT.test(b.title ?? '')) continue;
    const ws = words(b.title);
    const more = ws.length ? [] : words(String(b.detail ?? '').slice(0, 100));
    if (!ws.length && !more.length) continue;
    considered++;
    if ((ws.length ? ws : more).some(w => text.includes(w))) covered++;
  }
  return {considered, covered, rate: considered ? covered / considered : 1};
}

const positiveSpend = card => [card.minimumSpend, ...(card.benefits ?? []).map(b => b.minimumSpend), ...(card.rewardRates ?? []).filter(r => r.verified).map(r => r.minimumSpend)]
  .some(v => typeof v === 'number' && v > 0);

const KEEP = ['name', 'docDate', 'collectedAt', 'url', 'termsUrl', 'spendBasis', 'grace', 'spendExclusions', 'benefitExclusions', 'benefits'];

/** 카드 상세에 붙일 정리본(없거나 맞지 않으면 null) */
export function termsFor(card, terms, today = koreaDay()) {
  if (!terms || !sameCard(terms, card) || !Array.isArray(terms.benefits) || !terms.benefits.length) return null;
  const cover = coverage(terms, card);
  const table = cover.rate >= COVER || terms.benefits.length >= 2 * cover.considered;
  const spend = terms.minimumSpend > 0 ? terms.minimumSpend : terms.minimumSpend === 0 && !positiveSpend(card) ? 0 : null;
  const out = Object.fromEntries(KEEP.filter(k => terms[k] !== undefined).map(k => [k, terms[k]]));
  // The loose name check above is useful for benefit labels but not for an
  // issuance-end notice: require exact ID and name incl. any variant suffix.
  const tightName = value => flat(value).replace(PREFIX, '').replace(/[^0-9a-z가-힣]/g, '');
  const a = tightName(terms.name), b = tightName(card.name);
  const issuance = terms.cardId === card.id && a && a === b
    && terms.issuer === card.issuer
    && stoppedIssuance(terms, today);
  if (issuance) Object.assign(out, {status: 'discontinued', ...issuance});
  else if (terms.status === 'active') out.status = 'active';
  return {...out, minimumSpend: spend, table, cover: Math.round(cover.rate * 100) / 100};
}

/** cards에 terms를 붙이고 몇 장에 붙였는지 셉니다 */
export function attachTerms(cards, list) {
  const byId = new Map(list.filter(t => t?.cardId).map(t => [t.cardId, t]));
  const stats = {terms: byId.size, attached: 0, table: 0, skipped: []};
  const result = cards.map(card => {
    const source = byId.get(card.id);
    if (!source) return card;
    const terms = termsFor(card, source);
    if (!terms) {
      stats.skipped.push(source.cardType !== card.type ? `${card.id} ${source.name}: 정리본 ${source.cardType} ≠ 카드 DB ${card.type}` : `${card.id} ${source.name} ≠ ${card.name}`);
      return card;
    }
    stats.attached++;
    if (terms.table) stats.table++;
    return {...card, terms};
  });
  return {cards: result, stats};
}
