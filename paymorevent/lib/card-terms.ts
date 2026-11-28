// 상품설명서 정리본(data/inbox/card-terms → 빌드 때 scripts/card-terms.mjs가 card-data/<id>.json의 terms로 붙임)을
// 카드 상세 혜택 표 한 줄(BenefitRow)로 바꿉니다. 정리본은 이미 '구분 | 적용처 | 혜택 | 한도·조건'으로 나뉘어 있어
// 원문을 추측해 자르지 않고 그대로 칸에 넣습니다.
import {won, type BenefitRow} from './mc-text';

export type TermBenefit = {
  group?: string | null; label: string; place: string; value: string; valueType: string; minimumSpend: number | null;
  tiers?: {spend: number | null; cap: number | null}[] | null; cap: number | null; capScope?: '일' | '월' | '연' | '건' | null;
  shared?: string | null; limits?: string | null; conditions?: string[] | null;
};
export type CardTerms = {
  name: string; docDate: string; collectedAt: string; url: string; termsUrl: string | null; status?: 'active' | 'discontinued'; discontinuedAt?: string | null;
  spendBasis?: string | null; grace?: string | null; spendExclusions: string[]; benefitExclusions: string[]; benefits: TermBenefit[];
  /** 화면에 쓸 카드 전월실적(빌드 때 카드 DB와 맞지 않는 0은 null로 바꿈) */ minimumSpend: number | null;
  /** 혜택 표를 정리본으로 그릴지(카드 DB 혜택을 대부분 담고 있을 때만) */ table: boolean; cover: number;
};

/** 한도 금액을 짧게: 3000 → 3천원, 20000 → 2만원, 1500 → 1,500원 */
const capWon = (n: number) => n >= 10000 || n % 1000 ? won(n) : `${n / 1000}천원`;
const scope = (s: TermBenefit['capScope']) => s === '건' ? '건당' : s ?? '월';

/** 한도: 실적 구간이 있으면 "월 2만~4만원" + 구간 줄("40만원 이상 2만원") */
function capText(b: TermBenefit): {limit: string | null; tiers: string[]} {
  const tiers = (b.tiers ?? []).filter((t): t is {spend: number | null; cap: number} => typeof t?.cap === 'number' && t.cap > 0);
  if (tiers.length >= 2) {
    const caps = tiers.map(t => t.cap), lo = Math.min(...caps), hi = Math.max(...caps);
    return {
      limit: `${scope(b.capScope)} ${lo === hi ? capWon(hi) : `${capWon(lo).replace(/원$/, '')}~${capWon(hi)}`}`,
      tiers: tiers.map(t => `${t.spend ? won(t.spend) + ' 이상' : '실적 무관'} ${capWon(t.cap)}`),
    };
  }
  const cap = tiers[0]?.cap ?? (typeof b.cap === 'number' && b.cap > 0 ? b.cap : null);
  return {limit: cap === null ? null : `${scope(b.capScope)} ${capWon(cap)}`, tiers: []};
}

/** 혜택 칸: "60% 할인" → 60% / 할인, "리터당 80원 할인" → 80원 / 리터당 할인 */
function valueText(b: TermBenefit) {
  const type = (b.valueType ?? '').trim();
  let main = b.value.trim().replace(new RegExp(String.raw`\s*(?:결제일|청구|현장)?\s*` + type + '$'), '').trim() || type;
  let sub = main === type || type === '제공' ? '' : type;
  const per = /^((?:리터|L|건|[\d,]+원|천원)당)\s*(.+)$/.exec(main);
  if (per) { main = per[2]; sub = [per[1], sub].filter(Boolean).join(' '); }
  return {main, sub};
}

/** 칸에 바로 보여 줄 짧은 조건 수(나머지는 원문의 '혜택 조건'에) */
const SHORT = 30, SHOWN = 2;

export function termRows(terms: CardTerms): BenefitRow[] {
  // 통합 한도: 같은 묶음(shared)의 줄은 한도가 적힌 첫 줄의 한도를 같이 씀(표에서 세로로 합친 칸)
  const sharedCap = new Map<string, ReturnType<typeof capText>>();
  for (const b of terms.benefits) {
    if (!b.shared || sharedCap.has(b.shared)) continue;
    const c = capText(b);
    if (c.limit) sharedCap.set(b.shared, c);
  }
  return terms.benefits.map(b => {
    const cap = b.shared ? sharedCap.get(b.shared) ?? {limit: null, tiers: []} : capText(b);
    const limit = b.shared ? cap.limit ? '통합 ' + cap.limit : /한도/.test(b.shared) ? b.shared : '통합 한도' : cap.limit;
    const spend = b.minimumSpend == null ? null : b.minimumSpend === 0 ? '실적 무관' : '전월 ' + won(b.minimumSpend);
    const conds = (b.conditions ?? []).filter(Boolean);
    const shown = conds.filter(c => c.length <= SHORT).slice(0, SHOWN);
    return {
      group: b.group ?? null, name: b.label, where: b.place, value: valueText(b), conds: [], tiers: [],
      lines: conds.filter(c => !shown.includes(c)),
      label: b.label, place: b.place === b.label ? '' : b.place, limit, shared: Boolean(b.shared), spend,
      extras: [...(b.limits ? [b.limits] : []), ...shown],
      sharedKey: b.shared ? 'S:' + b.shared : undefined, tierText: cap.tiers,
    };
  });
}
