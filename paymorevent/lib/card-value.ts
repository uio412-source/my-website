// 카드 상세의 '월 최대 혜택'·'내 지출로 계산'·'비슷한 카드'에 쓰는 계산
import {bestPicking, cardFamilyKey, pickingOptions} from './catalog-model';
import {RESTRICTED} from './card-themes';
import {won} from './mc-text';
import {browseThemes} from './customer-copy';
import type {Card} from './catalog-types';

type Opt = ReturnType<typeof pickingOptions>[number];
const spentOf = (p: Opt) => p.scenario.totalSpend ?? p.scenario.minimumEligibleSpend ?? p.scenario.monthlySpend ?? null;
/** 모든 가맹점에 붙는 국내 기본율만 전체 지출에 곱함 (업종·해외 율은 곱하지 않음) */
const GENERAL = /기본|(?:국내외?|모든|전)\s*(?:전\s*)?가맹점|가맹점\s*(?:구분|제한)\s*없/;
const domesticRate = (p: Opt) => p.scenario.calculation === 'unit-rate' && GENERAL.test(p.scenario.label ?? '') && !/해외|외화/.test(p.scenario.label ?? '');

/** 한도를 다 채울 때 한 달 최대 혜택과 그때 쓰는 돈 (율만 있는 카드는 없음) */
export function monthlyMax(picks: Opt[]) {
  let best: {benefit: number; spend: number} | null = null;
  for (const p of picks) {
    const spend = spentOf(p), benefit = p.scenario.monthlyBenefit;
    if (p.scenario.calculation === 'unit-rate' || !spend || !benefit) continue;
    if (!best || benefit > best.benefit) best = {benefit, spend};
  }
  return best;
}

/** 한 달에 spend원을 쓸 때 받을 수 있는 최대 혜택: 그 금액 안에서 채울 수 있는 가장 큰 구간, 또는 국내 기본율 × 지출 */
export function benefitAt(picks: Opt[], spend: number, card?: Pick<Card, 'rewardRates'>) {
  let best: {benefit: number; basis: string} | null = null;
  for (const p of picks) {
    const used = spentOf(p);
    // 기본율도 그 혜택의 실적 조건·월 한도를 지킴
    const rate = card?.rewardRates?.find(r => r.label === p.scenario.label);
    const cap = rate ? (rate.monthlyCapUnits !== undefined ? rate.monthlyCapUnits * rate.unitValue : rate.monthlyCapValue) : null;
    const benefit = domesticRate(p) ? (spend >= (p.scenario.minimumEligibleSpend ?? 0) ? Math.min(spend * p.value / 100, cap ?? Infinity) : 0)
      : p.scenario.calculation !== 'unit-rate' && used && used <= spend && p.scenario.monthlyBenefit ? p.scenario.monthlyBenefit : 0;
    if (benefit > 0 && (!best || benefit > best.benefit)) best = {benefit, basis: p.scenario.benefitScope ?? p.scenario.label ?? ''};
  }
  return best;
}
/** 혜택이 시작되는 가장 작은 지출 */
export function firstSpend(picks: Opt[]) {
  const spends = picks.filter(p => !domesticRate(p) && p.scenario.calculation !== 'unit-rate').map(spentOf).filter((v): v is number => !!v);
  return spends.length ? Math.min(...spends) : null;
}

/** 전월실적 한 줄: 혜택에 걸린 실적 중 가장 작은 값(상세 기본 정보와 같은 기준). 실적 없는 기본 혜택이 함께 있으면 표시 */
export function spendShort(card: Pick<Card, 'minimumSpend' | 'benefits'>) {
  const spends = card.benefits.map(b => b.minimumSpend).filter((v): v is number => typeof v === 'number');
  const positive = spends.filter(v => v > 0);
  if (positive.length) return `전월 ${won(Math.min(...positive))}${spends.includes(0) ? ' (일부 무실적)' : ''}`;
  return card.minimumSpend == null ? null : card.minimumSpend === 0 ? '무실적' : `전월 ${won(card.minimumSpend)}`;
}

// 혜택 영역(목록 필터와 같은 말). 무실적·발급 조건 같은 성격 태그는 영역이 아니라서 뺌
const NOT_AREA = new Set(['무실적', '마티나골드', '상품권', '상품권 가능', '관리비', '국세', '지방세', '세금']);
const areas = (c: Card) => new Set(browseThemes(c).filter(t => !NOT_AREA.has(t)));

/** 같은 종류(신용·체크)·비슷한 연회비에서 혜택 영역(해외·라운지·커피…)이 겹치는 다른 카드. 많이 겹치고 피킹률이 높은 순 */
export function similarCards(card: Card, cards: Card[], n = 4) {
  const mine = areas(card);
  if (!mine.size) return [];
  const fee = card.annualFeeMin ?? 0, maxFee = Math.max(fee * 2, fee + 20000), minFee = fee >= 100000 ? fee / 3 : 0;
  const self = cardFamilyKey(card), seen = new Set([self]);
  const scored: {c: Card; shared: string[]; pick: number | null; score: number}[] = [];
  for (const c of cards) {
    const cf = c.annualFeeMin ?? 0;
    if (c.type !== card.type || RESTRICTED.test(c.name) || cf > maxFee || cf < minFee) continue;
    const shared = [...areas(c)].filter(a => mine.has(a));
    if (!shared.length) continue;
    const pick = bestPicking(c)?.value ?? null;
    scored.push({c, shared, pick, score: shared.length / mine.size * 30 + (pick ?? 0) * 3});
  }
  scored.sort((a, b) => b.score - a.score);
  const out: typeof scored = [];
  for (const s of scored) {
    const k = cardFamilyKey(s.c);
    if (seen.has(k)) continue;
    seen.add(k); out.push(s);
    if (out.length >= n) break;
  }
  return out;
}
