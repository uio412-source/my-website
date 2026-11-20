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
  '현대': ['현대', 5], '롯데': ['롯데', 2], '농협': ['NH', 3], 'BC': ['BC', 2],
};
export function issuerTile(issuer: string): [string, number] {
  const g = issuerGroup(issuer);
  if (ISSUER_TILE[g] && (g !== 'BC' || /BC/.test(issuer))) return ISSUER_TILE[g];
  const short = issuer.replace(/카드$|은행$|뱅크$/, '').replace(/^IBK기업$/, 'IBK').slice(0, 3);
  return [short || issuer.slice(0, 2), 1];
}
export const ISSUER_FILTERS = ['삼성', '국민', '신한', '우리', '하나', '현대', '롯데', '농협', 'BC', '기타'];
export const issuerFilterLabel = (g: string) => g === '국민' ? 'KB국민' : g === '농협' ? 'NH농협' : g === 'BC' ? 'BC·은행' : g;

// ---------- 혜택 정리 ----------
const JUNK = /(?:란\s*\?|란$|안내$|안내\s*\(|^연회비|소액신용|하이브리드|체크카드\s*안내|유의\s*사항|이용\s*방법|발급\s*(?:안내|대상|조건)|가족카드|SFC|^기타$|^공통|서비스\s*안내|전월\s*(?:이용)?\s*실적|실적\s*(?:안내|기준|제외|산정)|이용\s*안내|제공\s*기준|후불\s*교통|결제일|결제\s*계좌|카드\s*(?:디자인|신청)|^[0-9.]+\s*$|^혜택\s*요약$|^주요\s*혜택$|^카드\s*혜택$|^부가\s*서비스$|^전월\s*이용\s*(?:금액|실적)|이상\s*시$|^주요\s*서비스$|구간$|^\d+만\s*[/~]|^서비스\s*(?:구분|내용|대상)$|^대상\s*가맹점|^적용\s*대상|^제공\s*(?:한도|조건))/;
const GENERIC_TITLE = /^(?:\d+\.\s*)?(?:국내|해외)?\s*(?:혜택|서비스|할인\s*서비스|적립\s*서비스|기본\s*적립|할인|적립|포인트|청구할인|캐시백)$/;
const NUMBERED = /^\d+\.\s*/;

export type CleanBenefit = {title: string; lines: string[]; rate: string | null; cap: string | null; spend: string | null; voucher: boolean};

const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/\s*([·,])\s*/g, '$1 ').replace(/[;:]\s*$/, '').trim();
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
export function highlights(card: Pick<Card, 'benefits'>, n = 3) {
  return cleanBenefits(card).slice(0, n).map(b => b.rate ? `${short(b.title, 20)} ${b.rate}` : short(b.title, 26));
}

// ---------- 이벤트 문구 ----------
const GENERIC = /^(?:공식 (?:진행 이벤트|목록|혜택)|공식 혜택·이벤트 확인)|확인 필요$|상세 혜택 및 참여 조건 확인/;
export function eventSummary(o: Offer) {
  const cands = [o.benefitText, o.description].map(s => tidy(customerLines(s ?? '').join(' · ')));
  const t = cands.find(s => s && !GENERIC.test(s) && s !== o.title && !o.title.includes(s));
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

// ---------- 카드 상세: 혜택 한 줄 요약과 조건 칩 ----------
const AMOUNT = String.raw`[\d,.]+\s*(?:만\s*)?(?:천\s*)?(?:원|P|포인트|점|마일)`;
/** 원문에서 "월 한도·횟수·건당 최소금액·전월실적"만 뽑아 칩으로, 앞부분은 한 줄 요약으로 */
export function benefitFacts(b: CleanBenefit) {
  const text = [b.cap ?? '', ...b.lines].join(' ');
  const chips: string[] = [];
  const cap = new RegExp(String.raw`월\s*(?:통합\s*)?(?:할인|적립)?\s*한도\s*[:：]?\s*(` + AMOUNT + ')').exec(text);
  if (cap) chips.push('월 ' + cap[1].replace(/\s+/g, '') + ' 한도');
  else if (b.cap && b.cap.length <= 14) chips.push(b.cap === '한도 없음' ? '한도 없음' : b.cap);
  const counts = new Set<string>();
  for (const m of text.matchAll(/(일|월|연)\s*(\d+)\s*회/g)) { counts.add(`${m[1]} ${m[2]}회`); if (counts.size >= 2) break; }
  chips.push(...counts);
  const per = /(?:이용\s*)?건당\s*([\d,.]+\s*(?:만\s*)?(?:천\s*)?원)\s*이상/.exec(text);
  if (per) chips.push(per[1].replace(/\s+/g, '') + ' 이상 결제');
  if (b.spend && b.spend !== '무실적') chips.push(b.spend);
  const first = b.lines[0] ?? '';
  let summary = first.split(' / ')[0];
  const cut = summary.search(/\s(?:일|월|연)\s*\d+\s*회|\s(?:이용\s*)?건당|\s※|\s\*|\s월\s*(?:통합\s*)?한도/);
  if (cut > 8) summary = summary.slice(0, cut);
  summary = summary.replace(/[,·]\s*$/, '').trim();
  if (summary === b.title || b.title.includes(summary)) summary = '';
  const flat = summary.replace(/\s+/g, '');
  return {summary: short(summary, 64), chips: [...new Set(chips)].filter(c => !flat.includes(c.replace(/\s+/g, ''))).slice(0, 4)};
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
