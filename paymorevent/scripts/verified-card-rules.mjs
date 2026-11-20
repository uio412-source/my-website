import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {applyPickingReview, readPickingReview} from './picking-review.mjs';

// Build the list and detail pages from the same reviewed product records.
export function readVerifiedCardRules() {
  const path = new URL('../data/verified-card-rules.json.gz', import.meta.url);
  return JSON.parse(gunzipSync(readFileSync(path)));
}

export function applyVerifiedCardRules(cards, {patches}, {summary = false} = {}) {
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
  // Hand-checked picking-rate corrections (data/picking-review.json) go on top.
  return applyPickingReview(result, readPickingReview());
}
