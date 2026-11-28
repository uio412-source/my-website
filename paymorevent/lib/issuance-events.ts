// 발급 이벤트 참여 판정 — 카드사별 내 상태(마지막 결제일·보유/탈회·이벤트 수령 이력)와
// 이벤트 조건(무실적 N개월 · 탈회 제한 · 이벤트 수령 제한 · 기존 보유자 가능 여부)을 견줍니다.
// 계산은 브라우저에서만 하고 카드사별 입력만 localStorage에 보관합니다.
import {REVIEWED_CAMPAIGNS, type Lookback, type ReviewedRules} from './issuance-review.ts';

export type HolderRule = true | false | 'target_card_only' | null;

export type IssuanceEvent = {
  id: string;
  source: string;
  sourceId: 'naver' | 'kakaopay' | 'ajd' | 'ppomppu' | string;
  issuer: string;
  cardName: string | null;
  title: string;
  benefitText: string | null;
  benefitAmount: number | null;
  spendCondition: string | null;
  period: string | null;
  startsAt: string | null;
  endsAt: string | null;
  url: string;
  /** 무실적(직전 N개월 결제 이력 없음) 요구 개월 */
  noPaymentMonths: number | null;
  /** 이벤트 혜택을 받은 이력이 있으면 안 되는 개월 */
  noRewardMonths: number | null;
  /** 탈회(해지) 이력이 있으면 안 되는 개월 */
  excludeCanceledMonths: number | null;
  /** false = 신규/미보유만, true = 보유자도 무실적이면 가능, 'target_card_only' = 대상 카드만 이력 없으면 가능 */
  allowExistingHolder: HolderRule;
  eligibilitySummary: string | null;
  eligibilityRuleText: string | null;
  note?: string;
};

export type IssuanceData = {
  updatedAt: string;
  sources: {id: string; name: string; url: string}[];
  counts?: Record<string, number>;
  events: IssuanceEvent[];
};

export type HoldingStatus = 'none' | 'holding' | 'canceled';

export type IssuerProfile = {
  /** 마지막 결제일 (YYYY-MM-DD) */
  lastPayment: string | null;
  /** 결제 이력이 아예 없음(신규/무실적) */
  noPayment: boolean;
  /** 카드 보유 상태 */
  holding: HoldingStatus | null;
  /** 탈회일 (holding === 'canceled'일 때) */
  canceledAt: string | null;
  noCancellation: boolean;
  /** 직전 발급/응모형 이벤트 혜택을 받은 날 */
  lastReward: string | null;
  /** 이벤트 혜택 수령 이력이 아예 없음 */
  noReward: boolean;
  /** 별도 범위: 개인 신용카드의 최근 결제일만 저장 (기존 전체 카드 입력을 재해석하지 않음). */
  lastCreditPayment: string | null;
  noCreditPayment: boolean;
};

export const EMPTY_PROFILE: IssuerProfile = {
  lastPayment: null, noPayment: false, holding: null, canceledAt: null, noCancellation: false,
  lastReward: null, noReward: false, lastCreditPayment: null, noCreditPayment: false,
};

/** 입력 패널에 세우는 카드사 (BC바로는 BC카드로 묶음) */
export const PROFILE_ISSUERS = ['신한카드', '삼성카드', '현대카드', 'KB국민카드', '롯데카드', '우리카드', '하나카드', 'NH농협카드', 'BC카드', 'IBK기업은행'] as const;

export const PROFILES_KEY = 'mrcards.issuance.profiles';

/** 카드사 표기 통일 (BC바로카드·농협카드·국민카드 …) */
export function issuerKey(issuer: string): string {
  const s = (issuer || '').replace(/\s+/g, '');
  if (/IBK|기업은행/.test(s)) return 'IBK기업은행';
  if (/^BC|비씨|바로/.test(s)) return 'BC카드';
  if (/NH|농협/.test(s)) return 'NH농협카드';
  if (/KB|국민/.test(s)) return 'KB국민카드';
  for (const name of PROFILE_ISSUERS) if (s.startsWith(name.replace('카드', ''))) return name;
  return s;
}

export function loadProfiles(): Record<string, IssuerProfile> {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, IssuerProfile>;
    const out: Record<string, IssuerProfile> = {};
    for (const [k, v] of Object.entries(parsed)) {
      // Do not migrate the old issuer-wide targetCardUnused checkbox.
      if (!v || typeof v !== 'object') continue;
      const p = {...EMPTY_PROFILE};
      for (const field of Object.keys(p) as (keyof IssuerProfile)[]) {
        if (Object.hasOwn(v, field)) Object.assign(p, {[field]: v[field]});
      }
      out[k] = p;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveProfiles(profiles: Record<string, IssuerProfile>) {
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)); } catch { /* 저장 못 해도 화면은 씀 */ }
}

export const isProfileEmpty = (p: IssuerProfile) =>
  !p.lastPayment && !p.noPayment && !p.holding && !p.canceledAt && !p.noCancellation && !p.lastReward && !p.noReward && !p.lastCreditPayment && !p.noCreditPayment;

// ---------- 날짜 ----------
const DAY = 864e5;
const today = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const isoDate = (s: string | null): s is string => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const value = new Date(s + 'T00:00:00Z');
  return Number.isFinite(+value) && value.toISOString().slice(0, 10) === s;
};
const previousDay = (iso: string) => new Date(Date.parse(iso + 'T00:00:00Z') - DAY).toISOString().slice(0, 10);
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, d));
  if (target.getUTCDate() !== d) target.setUTCDate(0); // 8/31 + 6개월 → 2/28(29)
  return target.toISOString().slice(0, 10);
}
export function daysUntil(iso: string, now = today()): number {
  return Math.round((Date.parse(`${iso}T00:00:00+09:00`) - Date.parse(`${now}T00:00:00+09:00`)) / DAY);
}
export const shortDate = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
export const midDate = (iso: string) => `${iso.slice(2, 4)}.${iso.slice(5, 7)}.${iso.slice(8, 10)}`;

// ---------- 판정 ----------
export type VerdictStatus = 'ok' | 'target' | 'wait' | 'blocked' | 'unknown';
export type Verdict = {
  status: VerdictStatus;
  label: string;
  /** 막는 사유 (짧은 배지 문구) */
  reasons: string[];
  /** 조건이 풀리는 날 (wait) */
  from?: string;
  days?: number;
  /** 무엇을 입력하면 판정되는지 (unknown) */
  missing?: string[];
};

export function rulesFor(ev: IssuanceEvent): ReviewedRules | undefined {
  if (!Object.hasOwn(REVIEWED_CAMPAIGNS, ev.id)) return;
  const rule = REVIEWED_CAMPAIGNS[ev.id];
  if (rule.startsAt === ev.startsAt && rule.endsAt === ev.endsAt &&
      rule.url === ev.url && rule.excerpt === ev.eligibilityRuleText) return rule;
}

export const profileIssuerFor = (ev: IssuanceEvent) => rulesFor(ev)?.issuer ?? issuerKey(ev.issuer);

export function targetKey(ev: IssuanceEvent, rules = rulesFor(ev)) {
  return rules?.coverage === 'complete' && rules.targetUnused?.product.trim()
    ? JSON.stringify([ev.id, ev.url, ev.startsAt, ev.endsAt, rules.issuer, rules.targetUnused.product])
    : null;
}

function fixedRange(window: Lookback, startsAt: string | null) {
  if (window.kind === 'fixed' && isoDate(window.from) && isoDate(window.through) && window.from <= window.through) return window;
  if (window.kind === 'before-start' && isoDate(startsAt) && validMonths(window.months)) {
    return {from: addMonths(startsAt, -window.months), through: previousDay(startsAt)};
  }
  return null;
}
const validMonths = (n: number) => Number.isInteger(n) && n >= 1 && n <= 36;

export function judge(ev: IssuanceEvent, profile: IssuerProfile | undefined, now = today(), confirmedTarget?: string): Verdict {
  return judgeReviewed(ev, rulesFor(ev), profile, now, confirmedTarget);
}

// Only reviewed conditions can determine a verdict, not the scraper's regex hints.
// An explicitly disqualifying fact can block even a partially reviewed campaign.
export function judgeReviewed(
  ev: IssuanceEvent, rules: ReviewedRules | undefined, profile: IssuerProfile | undefined, now: string, confirmedTarget?: string,
): Verdict {
  const p = profile ?? EMPTY_PROFILE;
  const unknown = (label: string, reasons: string[] = [], missing?: string[]): Verdict => ({status: 'unknown', label, reasons, missing});
  const block = (label: string, reasons: string[]): Verdict => ({status: 'blocked', label, reasons});
  if (isoDate(ev.endsAt) && ev.endsAt < now) return block('종료', ['이벤트 종료']);
  if (isoDate(ev.startsAt) && ev.startsAt > now) return unknown('시작 전', [`${shortDate(ev.startsAt)} 시작`]);
  if (!rules || !isoDate(ev.startsAt) || !isoDate(ev.endsAt) || ev.startsAt > ev.endsAt) {
    return unknown('조건 확인 필요', ['이벤트 원문 확인']);
  }

  const missing: string[] = [];
  const unresolved: string[] = [];
  const denied: string[] = [];
  const waits: {from: string; why: string}[] = [];
  const history = (window: Lookback, last: string | null, absent: boolean, input: string, scope: string) => {
    const range = fixedRange(window, ev.startsAt);
    if (!range && window.kind !== 'all' && (window.kind !== 'rolling' || !validMonths(window.months))) {
      unresolved.push(`${scope} 기간 확인`);
      return;
    }
    if (absent && !last) return;
    if (!isoDate(last) || last > now || absent) { missing.push(input); return; }
    if (range) {
      if (range.from <= last && last <= range.through) denied.push(`${shortDate(range.from)}~${shortDate(range.through)} ${scope} 이력`);
      // A later transaction never proves an earlier closed window was clear.
      else if (last > range.through) unresolved.push(`지정 기간 전체 ${scope} 이력 확인`);
    } else if (window.kind === 'all') {
      denied.push(`${scope} 이력 있음`);
    } else if (window.kind === 'rolling') {
      const from = addMonths(last, window.months);
      if (from > now) waits.push({from, why: `최근 ${window.months}개월 ${scope} 이력`});
    }
  };

  if (rules.payment?.scope === 'personal-credit') {
    history(rules.payment.window, p.lastCreditPayment, p.noCreditPayment || (p.noPayment && !p.lastPayment),
      '개인 신용카드 마지막 결제일 또는 이력 없음', '개인 신용카드 결제');
  } else if (rules.payment?.scope === 'issuer-all') {
    history(rules.payment.window, p.lastPayment, p.noPayment, '카드사 전체 마지막 결제일 또는 이력 없음', `${rules.issuer} 전체 카드 결제`);
  }

  if (rules.holder === 'no-current-holder') {
    if (!p.holding) missing.push('카드 보유 상태');
    else if (p.holding === 'holding') denied.push('기존 카드 보유 불가');
  }
  if (rules.cancellation) {
    // Being a holder or a non-holder does not by itself prove no cancellation.
    history(rules.cancellation, p.canceledAt, p.noCancellation && p.holding !== 'canceled', '최근 탈회일 또는 이력 없음', '탈회');
  }
  if (rules.reward) history(rules.reward, p.lastReward, p.noReward, '최근 이벤트 수령일 또는 이력 없음', '이벤트 수령');

  if (denied.length) return block('조건 미충족', denied);
  if (rules.coverage !== 'complete' || unresolved.length) {
    return unknown('조건 확인 필요', [...unresolved, rules.note ?? '이벤트 원문 추가 확인'], missing);
  }
  if (!rules.payment && !rules.holder && !rules.cancellation && !rules.reward && !rules.targetUnused) {
    return unknown('조건 확인 필요', ['검수된 판정 조건 없음']);
  }
  if (rules.targetUnused && !targetKey(ev, rules)) return unknown('조건 확인 필요', ['정확한 대상 상품 확인']);
  if (missing.length) return unknown('정보 미입력', [], missing);

  if (waits.length) {
    const latest = waits.reduce((a, b) => a.from >= b.from ? a : b);
    if (latest.from > ev.endsAt) return block('조건 미충족', [`${waits.map(w => w.why).join(', ')} · 이벤트 종료 전 불가`]);
    const key = targetKey(ev, rules);
    if (key && key !== confirmedTarget) return unknown('조건 확인 필요', ['대상 카드도 별도 확인']);
    const days = daysUntil(latest.from, now);
    return {status: 'wait', label: `${days}일 뒤 가능`, from: latest.from, days, reasons: waits.map(w => w.why)};
  }

  const key = targetKey(ev, rules);
  if (key && key !== confirmedTarget) {
    return {status: 'target', label: '대상 카드 확인 필요', reasons: [`${rules.targetUnused?.product} 미사용 확인`]};
  }
  return {status: 'ok', label: '참여 가능', reasons: []};
}

export const VERDICT_ORDER: Record<VerdictStatus, number> = {ok: 0, target: 1, wait: 2, unknown: 3, blocked: 4};

export function ruleLine(ev: IssuanceEvent): string | null {
  const rules = rulesFor(ev);
  if (!rules) return null;
  const parts: string[] = [];
  if (rules.payment) {
    const scope = rules.payment.scope === 'personal-credit' ? `${rules.issuer} 개인 신용카드` : `${rules.issuer} 전체 카드`;
    const window = rules.payment.window;
    const range = fixedRange(window, ev.startsAt);
    parts.push(range ? `${midDate(range.from)}~${midDate(range.through)} ${scope} 결제 이력 없음`
      : window.kind === 'rolling' ? `최근 ${window.months}개월 ${scope} 결제 이력 없음` : `${scope} 결제 이력 없음`);
  }
  if (rules.holder === 'no-current-holder') parts.push('기존 보유자 제외');
  if (rules.targetUnused) parts.push(`${rules.targetUnused.product} 미사용 확인`);
  if (rules.note) parts.push(rules.note);
  return parts.join(' · ') || null;
}
