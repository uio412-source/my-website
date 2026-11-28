import {existsSync, readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {applyPickingReview, readPickingReview} from './picking-review.mjs';

// Build the list and detail pages from the same reviewed product records.
export function readVerifiedCardRules() {
  const path = new URL('../data/verified-card-rules.json.gz', import.meta.url);
  return JSON.parse(gunzipSync(readFileSync(path)));
}

// 상품설명서 정리본(data/card-terms.json)에서 기계 변환한 요율 모델(tools/data/terms_to_rules.py).
// 요율 모델이 아직 없는 카드에만 붙습니다 — 손으로 검수한 값(verified-card-rules·picking-review)이 먼저입니다.
export function readTermsRules() {
  const path = new URL('../data/terms-rules.json.gz', import.meta.url);
  if (!existsSync(path)) return {patches: {}};
  return JSON.parse(gunzipSync(readFileSync(path)));
}

export function applyTermsRules(cards, {patches}) {
  if (!patches || !Object.keys(patches).length) return cards;
  return cards.map(card => {
    const patch = patches[card.id];
    if (!patch || card.rewardRates?.length) return card;
    return {...card, ...patch};
  });
}

export function applyVerifiedCardRules(cards, {patches}, {summary = false} = {}, termsRules = readTermsRules()) {
  const remaining = new Map(Object.entries(patches));
  const result = cards.map((card) => {
    const patch = remaining.get(card.id);
    if (!patch) return card;
    remaining.delete(card.id);
    if (!summary) return {...card, ...patch};

    const {documents, policyNotes, ...fields} = patch;
    const updated = {...card, ...fields};
    if (patch.benefits) {
      updated.benefitCount = patch.benefits.length;
      updated.searchText = [card.searchText, ...patch.benefits.map((benefit) => benefit.title)].filter(Boolean).join(' ');
    }
    return updated;
  });
  if (remaining.size) throw new Error('Verified rules without matching product IDs: '+[...remaining.keys()].join(', '));
  // 기계 변환한 요율 모델은 손 검수 패치 뒤에, 아직 요율이 없는 카드에만.
  const withTerms = applyTermsRules(result, termsRules);
  // Hand-checked picking-rate corrections (data/picking-review.json) go on top.
  return applyPickingReview(withTerms, readPickingReview());
}
