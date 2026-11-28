// 발급 이벤트 참여 판정 — 카드사별 내 상태(마지막 결제일·보유/탈회·이벤트 수령 이력)와
// 이벤트 조건(무실적 N개월 · 탈회 제한 · 이벤트 수령 제한 · 기존 보유자 가능 여부)을 견줍니다.
// 계산은 브라우저에서만 하고, 입력값은 localStorage(`mrcards.issuance`)에 둡니다.
import {today} from './mc-text';

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
  /** 직전 발급/응모형 이벤트 혜택을 받은 날 */
  lastReward: string | null;
  /** 이벤트 혜택 수령 이력이 아예 없음 */
  noReward: boolean;
  /** 대상 카드만 이력 없으면 되는 이벤트에서 '대상 카드는 쓴 적 없음' 체크 */
  targetCardUnused: boolean;
};

export const EMPTY_PROFILE: IssuerProfile = {
  lastPayment: null, noPayment: false, holding: null, canceledAt: null,
  lastReward: null, noReward: false, targetCardUnused: false,
};

/** 입력 패널에 세우는 카드사 (BC바로는 BC카드로 묶음) */
export const PROFILE_ISSUERS = ['신한카드', '삼성카드', '현대카드', 'KB국민카드', '롯데카드', '우리카드', '하나카드', 'NH농협카드', 'BC카드', 'IBK기업은행'] as const;

export const PROFILES_KEY = 'mrcards.issuance.profiles';

/** 카드사 표기 통일 (BC바로카드·농협카드·국민카드 …) */
export function issuerKey(issuer: string): string {
  const s = (issuer || '').replace(/\s+/g, '');
  if (/^BC|비씨|바로/.test(s)) return 'BC카드';
  if (/NH|농협/.test(s)) return 'NH농협카드';
  if (/KB|국민/.test(s)) return 'KB국민카드';
  if (/IBK|기업은행/.test(s)) return 'IBK기업은행';
  for (const name of PROFILE_ISSUERS) if (s.startsWith(name.replace('카드', ''))) return name;
  return s;
}

export function loadProfiles(): Record<string, IssuerProfile> {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, IssuerProfile>;
    const out: Record<string, IssuerProfile> = {};
    for (const [k, v] of Object.entries(parsed)) out[k] = {...EMPTY_PROFILE, ...v};
    return out;
  } catch {
    return {};
  }
}

export function saveProfiles(profiles: Record<string, IssuerProfile>) {
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)); } catch { /* 저장 못 해도 화면은 씀 */ }
}

export const isProfileEmpty = (p: IssuerProfile) =>
  !p.lastPayment && !p.noPayment && !p.holding && !p.lastReward && !p.noReward && !p.targetCardUnused;

// ---------- 날짜 ----------
const DAY = 864e5;
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

const M = (n: number) => `${n}개월`;

/**
 * 이벤트 하나와 내 카드사 상태를 견줘 참여 가능 여부를 냅니다.
 * - 결제 이력·탈회·이벤트 수령은 'N개월 지나야 풀리는' 조건이라 가장 늦은 날을 가능 예정일로 냅니다.
 * - 기존 카드 보유 불가(false)·이벤트 종료는 기다려도 안 풀리는 조건입니다.
 */
export function judge(ev: IssuanceEvent, profile: IssuerProfile | undefined, now = today()): Verdict {
  const p = profile ?? EMPTY_PROFILE;
  const reasons: string[] = [];
  const missing: string[] = [];
  const waits: {from: string; why: string}[] = [];
  let hardBlock = false;

  if (ev.endsAt && ev.endsAt < now) return {status: 'blocked', label: '종료', reasons: ['이벤트 종료']};

  // ① 무실적(직전 N개월 결제 이력 없음)
  if (ev.noPaymentMonths) {
    if (!p.lastPayment && !p.noPayment) missing.push('마지막 결제일');
    else if (!p.noPayment && p.lastPayment) {
      const from = addMonths(p.lastPayment, ev.noPaymentMonths);
      if (from > now) waits.push({from, why: `최근 ${M(ev.noPaymentMonths)} 결제이력`});
    }
  }

  // ② 기존 카드 보유 불가 (신규 발급만)
  if (ev.allowExistingHolder === false) {
    if (!p.holding) missing.push('카드 보유 상태');
    else if (p.holding === 'holding') {
      reasons.push('기존 카드 보유 불가');
      hardBlock = true;
    }
  }

  // ③ 탈회 제한
  if (ev.excludeCanceledMonths) {
    if (p.holding === 'canceled') {
      if (!p.canceledAt) missing.push('탈회일');
      else {
        const from = addMonths(p.canceledAt, ev.excludeCanceledMonths);
        if (from > now) waits.push({from, why: `탈회 ${M(ev.excludeCanceledMonths)} 이내`});
      }
    } else if (!p.holding) missing.push('카드 보유 상태');
  }

  // ④ 이벤트 혜택 수령 제한
  if (ev.noRewardMonths) {
    if (!p.lastReward && !p.noReward) missing.push('최근 이벤트 수령일');
    else if (!p.noReward && p.lastReward) {
      const from = addMonths(p.lastReward, ev.noRewardMonths);
      if (from > now) waits.push({from, why: `${M(ev.noRewardMonths)} 내 이벤트 수령`});
    }
  }

  if (hardBlock) return {status: 'blocked', label: '조건 미충족', reasons};

  if (waits.length) {
    const latest = waits.reduce((a, b) => (a.from >= b.from ? a : b));
    if (ev.endsAt && latest.from > ev.endsAt) {
      return {status: 'blocked', label: '조건 미충족', reasons: [`${waits.map(w => w.why).join(', ')} · 이벤트 종료 전 불가`]};
    }
    const days = Math.max(0, daysUntil(latest.from, now));
    return {
      status: 'wait', label: `${days}일 뒤 가능`, from: latest.from, days,
      reasons: waits.map(w => w.why),
    };
  }

  if (missing.length) return {status: 'unknown', label: '정보 미입력', reasons: [], missing};

  // 조건을 원문에서 읽지 못한 이벤트는 함부로 '가능'이라 하지 않음
  if (!ev.noPaymentMonths && !ev.noRewardMonths && !ev.excludeCanceledMonths && ev.allowExistingHolder === null) {
    return {status: 'unknown', label: '조건 미확인', reasons: []};
  }

  // ⑤ 대상 카드만 이력 없으면 되는 이벤트: 대상 카드 사용 여부를 확인
  if (ev.allowExistingHolder === 'target_card_only') {
    const hasHistory = p.holding === 'holding' || (!p.noPayment && !!p.lastPayment);
    if (!p.targetCardUnused && (hasHistory || isProfileEmpty(p))) {
      return {status: 'target', label: '대상 카드 미사용 시 가능', reasons: ['대상 카드 이력만 확인']};
    }
  }

  return {status: 'ok', label: '참여 가능', reasons: []};
}

export const VERDICT_ORDER: Record<VerdictStatus, number> = {ok: 0, target: 1, wait: 2, unknown: 3, blocked: 4};

/** 표에 보여 줄 무실적·제한 조건 한 줄 */
export function ruleLine(ev: IssuanceEvent): string | null {
  const parts: string[] = [];
  if (ev.noPaymentMonths) parts.push(`직전 ${ev.noPaymentMonths}개월 무실적`);
  if (ev.noRewardMonths) parts.push(`${ev.noRewardMonths}개월 내 이벤트 수령 불가`);
  if (ev.excludeCanceledMonths) parts.push(`탈회 ${ev.excludeCanceledMonths}개월 이내 불가`);
  if (ev.allowExistingHolder === false) parts.push('신규 발급만');
  if (ev.allowExistingHolder === 'target_card_only') parts.push('대상 카드만 확인');
  if (!parts.length) return ev.eligibilitySummary;
  return parts.join(' · ');
}
