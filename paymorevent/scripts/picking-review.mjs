import {readFileSync} from 'node:fs';

// data/picking-review.json: hand-checked corrections to the picking-rate inputs.
// Applied after verified-card-rules so list and detail pages read the same values.
export function readPickingReview() {
  return JSON.parse(readFileSync(new URL('../data/picking-review.json', import.meta.url), 'utf8'));
}

export function applyPickingReview(cards, review) {
  const byId = new Map(cards.map((card, i) => [card.id, i]));
  const out = [...cards];
  const edit = (id, fn) => {
    if (!byId.has(id)) throw new Error(`picking-review.json: unknown card ${id}`);
    const i = byId.get(id);
    out[i] = fn(out[i]);
  };
  for (const id of review.benefitSpendExcluded.cards) edit(id, card => ({...card, benefitSpendExcluded: true}));
  for (const fix of review.rules) {
    const re = new RegExp(fix.label);
    for (const id of fix.cards) edit(id, card => {
      let hits = 0;
      const rewardRates = (card.rewardRates ?? []).map(rate => re.test(rate.label) ? (hits++, {...rate, ...fix.set}) : rate);
      if (!hits) throw new Error(`picking-review.json: no rule /${fix.label}/ on ${id}`);
      return {...card, rewardRates};
    });
  }
  for (const fix of review.plans) edit(fix.card, card => {
    let hit = false;
    const spendingPlans = (card.spendingPlans ?? []).map(plan => {
      if (plan.label !== fix.plan) return plan;
      hit = true;
      const rules = plan.rules.map(rule => {
        const set = fix.rules?.[rule.id];
        return set ? {...rule, ...set} : rule;
      });
      for (const id of Object.keys(fix.rules ?? {})) if (!plan.rules.some(rule => rule.id === id)) throw new Error(`picking-review.json: no rule ${id} in ${fix.card} ${fix.plan}`);
      return {...plan, groups: fix.groups ? [...plan.groups.filter(g => !fix.groups.some(n => n.id === g.id)), ...fix.groups] : plan.groups, rules: [...rules, ...(fix.add ?? [])]};
    });
    if (!hit) throw new Error(`picking-review.json: no plan "${fix.plan}" on ${fix.card}`);
    return {...card, spendingPlans};
  });
  return out;
}
