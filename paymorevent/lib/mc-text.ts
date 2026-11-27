// Mr. Cards 화면 문구 정리: 카드사 원문에서 긁어온 DB를 사람이 읽기 좋은 형태로만 걸러 냅니다.
// - 혜택이 아닌 안내 항목(연회비 안내, "하나머니란?", 소액신용한도 …)은 숨김
// - "확인 중" 같은 빈 값은 보여 주지 않음(값이 있을 때만 표시)
// - 검색: 여러 단어(모두 포함), 초성(ㅅㅎ→신한), 동의어(해외=외화·트래블), 이름 일치 우선 정렬
import type {Benefit, Card, Offer} from './catalog-types';
import {customerLines} from './customer-copy';
import {issuerGroup} from './catalog-model';

export const today = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

export const won = (n: number) => n == null ? '' : n === 0 ? '없음' : n >= 10000
  ? `${Number((n / 10000).toFixed(1)).toLocaleString('ko-KR')}만원` : `${n.toLocaleString('ko-KR')}원`;
export const spendLabel = (n: number | null | undefined) => n == null ? null : n === 0 ? '무실적' : `전월 ${won(n)}`;
export const feeLabel = (n: number | null | undefined) => n == null ? null : n === 0 ? '연회비 없음' : `연회비 ${won(n)}~`;

// ---------- 카드사 타일 ----------
const ISSUER_TILE: Record<string, [string, number]> = {
  '삼성': ['삼성', 1], '국민': ['KB', 4], '신한': ['신한', 1], '우리': ['우리', 1], '하나': ['하나', 3],
  '현대': ['현대', 5], '롯데': ['롯데', 2], '농협': ['NH', 3], 'BC': ['BC', 2], '새마을': ['MG', 2],
};
export function issuerTile(issuer: string): [string, number] {
  const g = issuerGroup(issuer);
  if (ISSUER_TILE[g] && (g !== 'BC' || /BC/.test(issuer))) return ISSUER_TILE[g];
  const short = issuer.replace(/카드$|은행$|뱅크$/, '').replace(/^IBK기업$/, 'IBK').slice(0, 3);
  return [short || issuer.slice(0, 2), 1];
}
export const ISSUER_FILTERS = ['삼성', '국민', '신한', '우리', '하나', '현대', '롯데', '농협', 'BC', '새마을', '기타'];
export const issuerFilterLabel = (g: string) => g === '국민' ? 'KB국민' : g === '농협' ? 'NH농협' : g === 'BC' ? 'BC·은행' : g === '새마을' ? 'MG새마을금고' : g;

// ---------- 혜택 정리 ----------
const JUNK = /(?:란\s*\?|란$|안내$|안내\s*\(|^연회비|소액신용|하이브리드|체크카드\s*안내|유의\s*사항|이용\s*방법|발급\s*(?:안내|대상|조건)|가족카드|SFC|^기타$|^공통|서비스\s*안내|전월\s*(?:이용)?\s*실적|실적\s*(?:안내|기준|제외|산정)|이용\s*안내|제공\s*기준|후불\s*교통|결제일|결제\s*계좌|카드\s*(?:디자인|신청)|^[0-9.]+\s*$|^혜택\s*요약$|^주요\s*혜택$|^카드\s*혜택$|^부가\s*서비스$|^전월\s*이용\s*(?:금액|실적)|이상\s*시$|^주요\s*서비스$|구간$|^\d+만\s*[/~]|^서비스\s*(?:구분|내용|대상)$|^대상\s*가맹점|^적용\s*대상|^제공\s*(?:한도|조건)|상세\s*보기$)/;
const GENERIC_TITLE = /^(?:\d+\.\s*)?(?:국내|해외)?\s*(?:혜택|서비스|할인\s*서비스|적립\s*서비스|기본\s*적립|할인|적립|포인트|청구할인|캐시백)$/;
const NUMBERED = /^\d+\.\s*/;

export type CleanBenefit = {title: string; lines: string[]; rate: string | null; cap: string | null; spend: string | null; voucher: boolean};

const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/\s*([·,])\s*/g, '$1 ').replace(/(\d), (?=\d{3}(?!\d))/g, '$1,').replace(/[;:]\s*$/, '').trim();
const short = (s: string, n: number) => s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;

export function cleanBenefits(card: Pick<Card, 'benefits'>): CleanBenefit[] {
  const out: CleanBenefit[] = [];
  const seen = new Set<string>();
  for (const b of card.benefits as Benefit[]) {
    let title = tidy(b.title.replace(NUMBERED, ''));
    let lines = [...new Set(customerLines(b.detail ?? '').map(tidy))]
      .filter(l => l && l !== title && !/^구분\b/.test(l) && l.length > 3);
    if (JUNK.test(title) && !/할인|적립|캐시백|무료|면제|마일/.test(lines.join(' ').slice(0, 60))) continue;
    if (GENERIC_TITLE.test(title) || title.length < 2) {
      if (!lines.length) continue;
      title = short(lines.shift()!, 40);
    }
    lines = lines.filter(l => !l.startsWith(title)).map(l => short(l, 140));
    const key = title + '|' + (b.rate ?? '');
    if (seen.has(key)) continue;
    seen.add(key);
    const rate = b.rate && !/^0%?$/.test(b.rate) ? b.rate : null;
    const cap = b.cap && !/없음|제한\s*없|한도\s*없/.test(b.cap) ? b.cap : b.cap ? '한도 없음' : null;
    out.push({title: short(title, 48), lines, rate, cap, spend: b.minimumSpend === null ? null : spendLabel(b.minimumSpend), voucher: b.kind === 'voucher'});
  }
  return out;
}

/** 목록에 보여 줄 핵심 혜택 2~3개 (짧게) */
/** 목록 칩: 상세 혜택 표와 같은 말로 "구분 값" (예: "커피 10%", "해외 빅포인트 1.3%") */
export function highlights(card: Pick<Card, 'benefits'>, n = 3) {
  const out: string[] = [];
  for (const b of cleanBenefits(card)) {
    const r = benefitRow(b);
    const label = r.label.replace(/^(?:[①-⑳]|\d+[.)])\s*/, '').replace(/[\s\-~:·(]+$/, '').trim();
    const ok = label.length >= 2 && !/^당\s/.test(label) && !/원당/.test(b.title);
    const t = ok ? short(label, 18) + (r.value.main ? ' ' + r.value.main : '') : short(b.title, 24);
    if (!out.includes(t)) out.push(t);
    if (out.length >= n) break;
  }
  return out;
}
/** 공무원·교육청·국민행복·법인·학생증처럼 가입 대상이 정해진 카드 (추천순에서 아래로, 목록에 표시) */
export {RESTRICTED} from './card-themes';

// ---------- 이벤트 문구 ----------
const GENERIC = /^(?:공식 (?:진행 이벤트|목록|혜택)|공식 혜택·이벤트 확인)|확인 필요$|상세 혜택 및 참여 조건 확인/;
/** 두 문장이 얼마나 겹치는지(글자 2개 묶음 기준, 0~1). 제목을 되풀이하는 요약을 거르는 데 씀 */
function overlap(a: string, b: string) {
  const grams = (t: string) => { const x = t.replace(/[^가-힣A-Za-z0-9]/g, ''); const g = new Set<string>(); for (let i = 0; i < x.length - 1; i++) g.add(x.slice(i, i + 2)); return g; };
  const A = grams(a), B = grams(b);
  if (!A.size) return 1;
  let n = 0; for (const g of A) if (B.has(g)) n++;
  return n / A.size;
}
export function eventSummary(o: Offer) {
  const cands = [o.benefitText, o.description].map(s => tidy(customerLines(s ?? '').join(' · ')));
  const t = cands.find(s => s && !GENERIC.test(s) && s !== o.title && !o.title.includes(s) && overlap(s, o.title) < .6);
  return t ? short(t, 120) : '';
}
export function dday(end: string | null, now = today()) {
  if (!end) return null;
  const d = Math.round((Date.parse(end) - Date.parse(now)) / 864e5);
  return d < 0 ? '종료' : d === 0 ? '오늘 마감' : `D-${d}`;
}
export const ymd = (s: string | null | undefined) => s ? s.slice(2).replace(/-/g, '.') : '';
/** 제목·혜택 문구에서 '최대 N만원' 같은 금액을 읽어 정렬에 씀 */
export function headlineAmount(o: Offer, value: number | null) {
  if (value) return value;
  const m = (o.title + ' ' + o.benefitText).match(/(\d[\d,.]*)\s*만\s*원/);
  return m ? Number(m[1].replace(/,/g, '')) * 10000 : 0;
}

// ---------- 검색 ----------
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
export const chosung = (s: string) => [...s].map(c => {
  const code = c.charCodeAt(0) - 0xac00;
  return code >= 0 && code < 11172 ? CHO[Math.floor(code / 588)] : c;
}).join('');
const isCho = (s: string) => /^[ㄱ-ㅎ]+$/.test(s);
export const norm = (s: string) => s.toLowerCase().replace(/[\s#·_\-()/,.™®]/g, '');
const SYNONYMS: Record<string, string[]> = {
  해외: ['해외', '외화', '트래블', '여행'], 여행: ['여행', '해외', '항공', '호텔', '트래블'], 주유: ['주유', '충전', 'gs칼텍스', 's-oil', 'sk에너지'],
  커피: ['커피', '카페', '스타벅스'], 통신: ['통신', 'skt', 'kt', 'lgu+', '휴대폰'], 교통: ['교통', '버스', '지하철', '택시', 'k패스'],
  마일: ['마일', '마일리지', '스카이패스', '아시아나'], 무실적: ['무실적', '실적무관', '조건없'], 라운지: ['라운지', 'pp카드', '마티나'],
  쇼핑: ['쇼핑', '쿠팡', '마트', '백화점', '온라인'], 배달: ['배달', '배민', '쿠팡이츠', '요기요'], 아멕스: ['아멕스', 'amex', 'americanexpress'],
  마스터: ['마스터', 'mastercard', 'master'], 비자: ['비자', 'visa'], 체크: ['체크', 'debit'], 신용: ['신용', 'credit'],
};
/** 카드 이름의 영어 단어를 한글 읽기로 바꾼 글('신한카드 Deep Dream 체크' → '신한카드 딥 드림 체크'). 바뀐 게 없으면 ''.
 *  '딥드림'·'제로'처럼 한글로 치거나 초성(ㄷㄷ)으로 찾을 때 씀. 모르는 단어는 그대로 둠 */
const KO_READ: Record<string, string> = {
  the: '더', edition: '에디션', loca: '로카', digiloca: '디지로카', digi: '디지', point: '포인트', platinum: '플래티넘', sol: '쏠', plus: '플러스', all: '올', plan: '플랜',
  business: '비즈니스', biz: '비즈', skypass: '스카이패스', new: '뉴', on: '온', zero: '제로', check: '체크', club: '클럽', oil: '오일', deep: '딥', young: '영',
  likit: '라이킷', pay: '페이', up: '업', one: '원', shopping: '쇼핑', life: '라이프', taptap: '탭탭', pet: '펫', express: '익스프레스', pick: '픽', classic: '클래식',
  dream: '드림', american: '아메리칸', auto: '오토', heritage: '헤리티지', play: '플레이', visa: '비자', simple: '심플', select: '셀렉트', mileage: '마일리지',
  hi: '하이', easy: '이지', edu: '에듀', global: '글로벌', red: '레드', trip: '트립', leaders: '리더스', mobility: '모빌리티', super: '슈퍼', travel: '트래블',
  blue: '블루', gold: '골드', prime: '프라임', daily: '데일리', fit: '핏', love: '러브', avenuel: '에비뉴엘', big: '빅', line: '라인', air: '에어', hey: '헤이',
  master: '마스터', jade: '제이드', moving: '무빙', kapick: '카픽', bliss: '블리스', go: '고', need: '니드', mobile: '모바일', toss: '토스', best: '베스트',
  rental: '렌탈', orange: '오렌지', real: '리얼', shine: '샤인', choice: '초이스', lady: '레이디', store: '스토어', way: '웨이', cubig: '큐빅', mile: '마일',
  triple: '트리플', members: '멤버스', flex: '플렉스', teens: '틴즈', bev: '비브', reserve: '리저브', smart: '스마트', cashback: '캐시백', money: '머니',
  black: '블랙', premium: '프리미엄', station: '스테이션', family: '패밀리', more: '모아', myshop: '마이샵', my: '마이', kream: '크림', opus: '오퍼스',
  silver: '실버', first: '퍼스트', boutique: '부티크', summit: '서밋', titanium: '티타늄', purple: '퍼플', green: '그린', happy: '해피', special: '스페셜',
  everyday: '에브리데이', asiana: '아시아나', campus: '캠퍼스', wish: '위시', free: '프리', signature: '시그니처', premier: '프리미어', infinite: '인피니트',
  world: '월드', ace: '에이스', label: '라벨', unboxing: '언박싱', taking: '테이킹', making: '메이킹', id: '아이디', liiv: '리브', wavve: '웨이브', tmap: '티맵',
  kia: '기아', casper: '캐스퍼', hyundai: '현대', hana: '하나', lotte: '롯데', mr: '미스터', ev: '이브이', sk: '에스케이', kt: '케이티', lg: '엘지', gs: '지에스',
  kb: '케이비', nh: '엔에이치', sc: '에스씨', zgm: '지금', ibk: '아이비케이', bc: '비씨', cj: '씨제이', lpg: '엘피지', dc: '디씨', im: '아이엠', sfc: '에스에프씨',
  soho: '소호', skt: '에스케이티', viva: '비바', okcashbag: '오케이캐쉬백', top: '탑', hola: '올라', syrup: '시럽', olleh: '올레', wiz: '위즈', lgu: '엘지유',
  hanaro: '하나로', solsol: '쏠쏠', living: '리빙', bazic: '베이직', basic: '베이직', honors: '아너스', ssg: '쓱', npay: '엔페이', spike: '스파이크', tag: '태그',
  rpm: '알피엠', link: '링크', shop: '샵', stripe: '스트라이프', multi: '멀티', bold: '볼드', health: '헬스', fun: '펀', ing: '잉', ai: '에이아이', cu: '씨유',
  ak: '에이케이', won: '원', upi: '유피아이', ybm: '와이비엠', macao: '마카오', hero: '히어로', heroes: '히어로즈', hybrid: '하이브리드', challenge: '챌린지',
  bag: '백', ring: '링', exclusive: '익스클루시브', autoslim: '오토슬림', youth: '유스', golf: '골프', las: '라스', vegas: '베가스', london: '런던',
  monaco: '모나코', paris: '파리', emerald: '에메랄드', sapphire: '사파이어', porsche: '포르쉐', shilla: '신라', rewards: '리워즈', traders: '트레이더스',
  digital: '디지털', drive: '드라이브', classy: '클래시', energy: '에너지', nomad: '노마드', pocket: '포켓', mercedes: '메르세데스', benz: '벤츠', srt: '에스알티',
  ktx: '케이티엑스', neo: '네오', tmoney: '티머니', eco: '에코', eats: '이츠', xo: '엑스오', yolo: '욜로', diners: '다이너스', prestige: '프레스티지', mega: '메가',
  coway: '코웨이', pink: '핑크', ikea: '이케아', plaza: '플라자', coffee: '커피', busan: '부산', teen: '틴', pass: '패스', mypick: '마이픽',
  alpha: '알파', navy: '네이비', primus: '프리무스', allday: '올데이', online: '온라인', style: '스타일', ok: '오케이', anniverse: '애니버스', royal: '로얄',
  zerose: '제로즈', unimile: '유니마일', every: '에브리', ten: '텐', core: '코어', day: '데이', tv: '티비', nol: '놀', velvet: '벨벳', save: '세이브',
  light: '라이트', blossom: '블라썸', pride: '프라이드', two: '투', time: '타임', wellness: '웰니스', sweet: '스위트', together: '투게더', dual: '듀얼',
  joy: '조이', rose: '로즈', buddy: '버디', seven: '세븐', art: '아트', work: '워크', with: '위드', we: '위', you: '유', for: '포', solid: '솔리드',
  shopper: '쇼퍼', chairs: '체어스', qwerty: '쿼티', uni: '유니', wallet: '월렛', care: '케어', routine: '루틴',
  k: '케이', m: '엠', i: '아이',
};
export function koReading(name: string) {
  let changed = false;
  const out = name.replace(/[A-Za-z][A-Za-z+]*/g, w => {
    const plus = w.endsWith('+');
    const k = KO_READ[w.toLowerCase().replace(/\+$/, '')];
    if (!k) return w;
    changed = true;
    return k + (plus ? '플러스' : '');
  });
  return changed ? out : '';
}
export const terms = (q: string) => q.trim().toLowerCase().split(/\s+/).filter(Boolean);
/** 한 단어가 글(text)에 들어 있는지: 동의어·초성 포함 */
export function termIn(term: string, text: string, cho?: string) {
  if (isCho(term)) return (cho ?? chosung(text)).replace(/\s/g, '').includes(term);
  const alts = SYNONYMS[term] ?? [term];
  return alts.some(a => text.includes(norm(a)));
}
/** fields: [글, 가중치]. 모든 단어가 어딘가에 있어야 하고, 점수가 높을수록 위로 */
export function searchScore(q: string, fields: [string, number][]) {
  const ts = terms(q);
  if (!ts.length) return 1;
  const prepared = fields.map(([t, w]) => [norm(t), w, chosung(t)] as const);
  let score = 0;
  for (const t of ts) {
    let best = 0;
    for (const [text, w, cho] of prepared) if (w > best && termIn(t, text, cho)) best = w;
    if (!best) return 0;
    score += best;
  }
  const name = prepared[0]?.[0] ?? '';
  if (name.startsWith(norm(q))) score += 50;
  return score;
}

/** 카드 전월실적: 카드 값이 없으면 혜택별 조건 중 가장 낮은 값 (여러 개면 "부터") */
export function cardMinimumSpend(card: Card): {value: number | null; varies: boolean} {
  if (card.minimumSpend !== null && card.minimumSpend !== undefined) return {value: card.minimumSpend, varies: false};
  const vals = [
    ...card.benefits.filter(b => b.minimumSpendVerified && b.minimumSpend !== null).map(b => b.minimumSpend as number),
    ...(card.rewardRates ?? []).filter(r => r.verified).map(r => r.minimumSpend),
    ...(card.spendingPlans ?? []).map(p => p.minimumSpend),
  ].filter(v => Number.isFinite(v));
  if (!vals.length) return {value: null, varies: false};
  const positive = vals.filter(v => v > 0);
  if (!positive.length || vals.includes(0)) return {value: 0, varies: positive.length > 0};
  const min = Math.min(...positive);
  return {value: min, varies: new Set(positive).size > 1 || vals.includes(0)};
}

/** 피킹률 시나리오 이름을 사람이 읽기 쉽게: "전월 30만원 최적 배분" → "전월 30만원 · 영역별 한도를 다 채울 때" */
export const pickLabel = (label: string) => label.replace(/\s*(?:구간\s*)?(?:·\s*)?(?:우대회원\s*)?최적\s*배분$/, ' · 영역별 한도를 다 채울 때').replace(/^\s*·\s*/, '');


// ---------- 카드 상세: 혜택 표 한 줄 ----------
const AMT = String.raw`[\d,.]+\s*(?:만\s*)?(?:천\s*)?(?:\d+\s*천\s*)?(?:\d+\s*백\s*)?(?:원|P|포인트|점|마일)`;
const compact = (s: string) => s.replace(/\s+/g, '');
/** 원문 한도를 짧게: 실적 구간별이면 "월 3천~1만원 (실적별)" */
function capLabel(b: CleanBenefit, text: string): {label: string | null; tiers: string[]} {
  const cap = b.cap ?? '';
  const tiers: string[] = [];
  if (/이상/.test(cap) && cap.includes(';')) {
    for (const part of cap.split(';')) {
      const m = /([\d,.]+\s*만\s*원?\s*이상[^/]*)\/\s*(.+)$/.exec(part.trim());
      if (!m) continue;
      const lo = compact(m[1]), range = /^([\d,.]+)만원?이상([\d,.]+)만원?미만$/.exec(lo);
      tiers.push(`${range ? `${range[1]}~${range[2]}만원` : lo.replace(/원?이상.*$/, '') .replace(/만$/, '만원') + ' 이상'} → ${compact(m[2])}`);
    }
    if (tiers.length >= 2) {
      const amts = tiers.map(t => t.split('→ ')[1]);
      return {label: `월 ${amts[0]}~${amts[amts.length - 1]}`, tiers};
    }
  }
  const m = new RegExp(String.raw`(?:(월|연|일)\s*(?:통합\s*)?(?:할인|적립|캐시백)?\s*)?한도\s*[:：]?\s*(?:통합\s*)?(월|연|일)?\s*(` + AMT + ')').exec(text);
  if (m) return {label: `${m[1] ?? m[2] ?? '월'} ${compact(m[3])}`, tiers};
  if (b.cap === '한도 없음') return {label: '한도 없음', tiers};
  if (b.cap && b.cap.length <= 14) return {label: b.cap, tiers};
  return {label: null, tiers};
}
/** 할인율이 없으면 원문에서 "1,000원 할인", "리터당 60원", "무료" 같은 값을 찾음 */
function valueLabel(b: CleanBenefit, text: string) {
  if (b.rate) {
    const pcts = [...b.rate.matchAll(/([\d.]+)\s*%/g)].map(m => Number(m[1]));
    if (b.rate.length > 8 && pcts.length > 1) return {main: `${Math.min(...pcts)}~${Math.max(...pcts)}%`, sub: '항목별'};
    return {main: b.rate, sub: /적립|포인트|마일/.test(b.title + text.slice(0, 80)) ? '적립' : /캐시백/.test(b.title + text.slice(0, 80)) ? '캐시백' : '할인'};
  }
  const range = /([\d.]+)\s*%?\s*~\s*([\d.]+)\s*%/.exec(b.title) ?? /([\d.]+)\s*%?\s*~\s*([\d.]+)\s*%/.exec(text.slice(0, 120));
  if (range) return {main: `${range[1]}~${range[2]}%`, sub: /적립|포인트|마일/.test(b.title) ? '적립' : '할인'};
  const pct = /([\d.]+)\s*%/.exec(b.title);
  if (pct) return {main: pct[1] + '%', sub: /적립|포인트|마일/.test(b.title) ? '적립' : /캐시백/.test(b.title) ? '캐시백' : '할인'};
  // b.rate가 비어도 원문을 ';'로 나눈 항목(detail)에 '5%'처럼 율이 있으면 첫 율을 값 칸으로 올림.
  // 할부 수수료율·이자율은 혜택이 아니므로 건너뜀.
  let detailPct: string | null = null;
  if (!/할부|수수료|이자|대출/.test(b.title)) {
    for (const line of b.lines) {
      const m = /([\d.]+)\s*%/.exec(line);
      if (m && !/수수료|이자/.test(line.slice(0, m.index))) { detailPct = m[1]; break; }
    }
  }
  if (detailPct) return {main: detailPct + '%', sub: /적립|포인트|마일/.test(b.title + b.lines.slice(0, 2).join(' ')) ? '적립' : /캐시백/.test(b.title + b.lines.slice(0, 2).join(' ')) ? '캐시백' : '할인'};
  const per = /리터당\s*([\d,]+)\s*원/.exec(text);
  if (per) return {main: `${per[1]}원`, sub: '리터당'};
  const amt = /([\d,]+(?:\.\d+)?\s*(?:만\s*)?(?:천\s*)?원)\s*(?:결제일\s*)?(할인|적립|캐시백|청구할인)/.exec(text);
  if (amt) return {main: compact(amt[1]), sub: amt[2] === '청구할인' ? '할인' : amt[2]};
  const mile = /([\d,]+)\s*마일/.exec(text);
  if (mile) return {main: `${mile[1]}마일`, sub: '적립'};
  if (/면제/.test(b.title + text.slice(0, 80))) return {main: '면제', sub: ''};
  if (/무료|이용권|제공/.test(b.title + text.slice(0, 80))) return {main: '무료', sub: ''};
  return {main: '', sub: ''};
}
export type BenefitRow = {
  group: string | null; name: string; where: string; value: {main: string; sub: string}; conds: string[]; tiers: string[]; lines: string[];
  /** 표 칸용: 구분(짧은 이름) · 적용처 · 한도 · 전월실적 · 그 밖의 조건(횟수·건당 최소) */
  label: string; place: string; limit: string | null; shared: boolean; spend: string | null; extras: string[];
  /** 상품설명서 정리본(lib/card-terms.ts): 같은 통합 한도 묶음 이름 · 실적 구간별 한도 줄 */
  sharedKey?: string; tierText?: string[];
};
/** 표 머리글 조각인지: 숫자·%가 없고 '대상·가맹점·할인율…' 같은 항목 이름이 2개 이상 */
const HEADER_WORD = /대상|가맹점|할인율|적립률|한도|구분|내용|영역|비고|조건/g;
function isHeaderLine(line: string) {
  if (/[\d%]/.test(line)) return false;
  return new Set(line.match(HEADER_WORD) ?? []).size >= 2;
}
/** "대중교통· 택시 10% 결제일할인" → "대중교통·택시" (혜택 칸과 겹치는 율·금액·동사는 뺌) */
function shortLabel(name: string) {
  const t = name.replace(/\s*·\s*/g, '·')
    .replace(/\s*(?:최대\s*)?[\d.]+\s*%?\s*~\s*[\d.]+\s*%\s*/g, ' ')
    .replace(/\s*(?:최대\s*)?[\d,.]+\s*(?:%|만\s*원|천\s*원|원|마일리지|마일|P|배)\s*/g, ' ')
    .replace(/\s*(?:결제일\s*)?(?:할인|적립|캐시백|청구할인|서비스|혜택|제공|면제|무료\s*이용|무료)\s*$/g, '')
    .replace(/\s*(?:결제일\s*)?(?:할인|적립|캐시백)\s*$/g, '').replace(/의$/, '').replace(/\s+/g, ' ').trim();
  const u = t.length > 8 ? t.replace(/\s*\([^)]*\)\s*/g, ' ').trim() : t;
  return u.length >= 2 ? u : t.length >= 2 ? t : name;
}
/** 혜택 하나를 표 한 줄로: 혜택 | 할인·적립 | 조건(전월실적·한도·횟수·건당 최소) */
export function benefitRow(b: CleanBenefit): BenefitRow {
  const text = [b.cap ?? '', ...b.lines].join(' ');
  const g = /^\[([^\]]{1,12})\]\s*/.exec(b.title);
  const name = g ? b.title.slice(g[0].length) : b.title;
  const conds: string[] = [];
  if (b.spend) conds.push(b.spend === '무실적' ? '실적 무관' : b.spend);
  const cap = capLabel(b, text);
  if (cap.label) conds.push(/한도/.test(cap.label) ? cap.label : cap.label + ' 한도');
  const counts = new Set<string>();
  for (const m of text.matchAll(/(일|월|연)간?\s*(\d+)\s*회/g)) { counts.add(`${m[1]} ${m[2]}회`); if (counts.size >= 2) break; }
  conds.push(...counts);
  const per = /(?:이용\s*)?건당\s*([\d,.]+\s*(?:만\s*)?(?:천\s*)?원)\s*이상/.exec(text) ?? /([\d,.]+\s*(?:만\s*)?(?:천\s*)?원)\s*이상\s*(?:결제|이용)?\s*시/.exec(b.lines[0] ?? '');
  if (per) conds.push(compact(per[1]) + ' 이상 결제');
  // 원문 첫 줄이 표 머리글("대상 업종 및 가맹점 · 할인율", "조건 · 할인율")이면 적용처로 쓰지 않고 다음 줄부터
  const lines = [...b.lines];
  while (lines.length && isHeaderLine(lines[0])) lines.shift();
  let where = (lines[0] ?? '').split(' / ')[0]
    .replace(/\(\s*(?:월|연)?\s*(?:통합\s*)?(?:할인|적립)?\s*한도[^)]*\)/g, '')
    .replace(/\s*(?:일|월|연)\s*\d+\s*회.*$/, '').replace(/\s*※.*$/, '').replace(/[,·]\s*$/, '').trim();
  // 할인율 칸과 겹치는 끝부분("… 10% 할인")은 빼고 어디서 쓰는지만
  if (b.rate) where = where.replace(new RegExp(String.raw`\s*` + b.rate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + String.raw`\s*(?:결제일\s*)?(?:할인|적립|캐시백)?(?:\(청구할인\))?$`), '').trim();
  where = where.replace(/\s*(?:최대\s*)?[\d.]+\s*%\s*(?:결제일\s*)?(?:할인|적립|캐시백)?\s*$/, '').replace(/[,·]\s*$/, '').trim();
  // 조건 칸과 겹치는 문장("전월 이용실적 20만원 이상 시 제공")·표 머리글 같은 조각("공항· 라운지", "놀이공원명· 제공 서비스")은 버림
  if (/^(?:전월|직전|실적|이용\s*실적)/.test(where) || /(?:명|서비스|구분|내용|대상|기준)$/.test(where) || (!/\d/.test(where) && where.split('·').length >= 2 && where.split('·').every(w => w.trim().length <= 7) && where.split('·').some(w => /(?:종류|대상|가맹점|적립률|할인율|명|서비스|구분|라운지|한도)$/.test(w.trim())))) where = '';
  if (where === name || name.includes(where) || where.length < 4) where = '';
  const extras = [...counts, ...(per ? [compact(per[1]) + ' 이상 결제'] : [])];
  const label = shortLabel(name);
  let place = where.replace(/\s*(?:결제|이용)\s*시$/, '').trim();
  const bare = (t: string) => t.replace(/요금|이용|[^가-힣A-Za-z0-9]/g, '');
  if (bare(place) === bare(label) || bare(label).includes(bare(place))) place = '';
  return {
    group: g ? g[1] : null, name, where: short(where, 44), value: valueLabel(b, text), conds: [...new Set(conds)].slice(0, 4), tiers: cap.tiers, lines: b.lines,
    label, place: short(place, 48), limit: cap.label, shared: /통합/.test(b.cap ?? ''), spend: b.spend ? (b.spend === '무실적' ? '실적 무관' : b.spend) : null, extras,
  };
}
