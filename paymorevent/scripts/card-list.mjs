import {createHash} from 'node:crypto';

// public/catalog-snapshot.json stays the source of truth for the card list.
// At build time this module derives the two light files the app downloads:
//   card-list.json   - what the list, its filters and sorting, and the detail
//                      pages' family/linked-event logic read from each card
//   card-search.json - the search text, which only the list's search box reads
// Everything else (prose, evidence, audit data) is shown only on a card's own
// page, which loads card-data/<id>.json.

export const CARD_LIST_FILE = 'card-list.json';
export const CARD_SEARCH_FILE = 'card-search.json';

const LIST_FIELDS = [
  // Identity, card families (cardFamilyKey, groupCards) and offerApplies
  'id', 'issuer', 'issuerGroup', 'name', 'type', 'familyId', 'familyName', 'searchAliases',
  // Filters
  'brands', 'annualFeeMin', 'minimumSpend', 'issuanceStatus', 'termsUrl',
  // Benefit chips and hashtags (browseThemes, featureTags, cardThemes, benefitKinds)
  'tags', 'themeTags', 'benefitKinds', 'networkServices',
  // Picking rate (pickingOptions)
  'pickingScenarios', 'spendingPlans', 'rewardModelComplete', 'rewardCoveragePending', 'rewardComponentsPending', 'sourceReviewPending',
];
const BENEFIT_FIELDS = ['category', 'title', 'detail', 'kind'];
// Explanations attached to reward rules. The picking rate calculation never reads them.
const PROSE_FIELDS = new Set(['note', 'sourceUrl']);
const STATUSES = new Set(['allowed', 'excluded', 'unknown']);

const pick = (record, fields) => Object.fromEntries(fields.filter(field => record[field] !== undefined).map(field => [field, record[field]]));
const withoutProse = record => Object.fromEntries(Object.entries(record).filter(([field]) => !PROSE_FIELDS.has(field)));

// The filters only compare spend/benefit verdicts. Sources and notes are shown
// in the detail page's eligibility table, which uses the full card.
function verdict(entry, where) {
  if (!STATUSES.has(entry?.spend) || !STATUSES.has(entry?.benefit)) throw new Error(`Unexpected payment eligibility: ${where}`);
  return {spend: entry.spend, benefit: entry.benefit};
}

export function listCard(card, cachedImages) {
  const slim = pick(card, LIST_FIELDS);
  // CardArtwork prefers data/card-images.json; imageUrl only matters for cards it does not cover.
  if (!Object.hasOwn(cachedImages, card.id)) slim.imageUrl = card.imageUrl ?? null;
  slim.benefits = card.benefits.map(benefit => pick(benefit, BENEFIT_FIELDS));
  if (card.rewardRates) slim.rewardRates = card.rewardRates.map(rate => ({...withoutProse(rate), ...(rate.feeWaiver ? {feeWaiver: withoutProse(rate.feeWaiver)} : {})}));
  if (card.feeWaivers) slim.feeWaivers = card.feeWaivers.map(withoutProse);
  if (card.normalization) slim.normalization = {qualityScore: card.normalization.qualityScore};
  if (card.paymentEligibility) slim.paymentEligibility = Object.fromEntries(Object.entries(card.paymentEligibility).map(([theme, entry]) => [theme, verdict(entry, `${card.id} ${theme}`)]));
  if (card.eligibilityRules) slim.eligibilityRules = card.eligibilityRules.map(rule => ({item: rule.item, ...verdict(rule, `${card.id} ${rule.item}`)}));
  return slim;
}

/** Returns the derived files' contents and a content hash for cache busting. */
export function buildCardFiles(snapshot, cachedImages) {
  if (!Array.isArray(snapshot?.cards) || !snapshot.cards.length) throw new Error('catalog-snapshot.json has no cards');
  const ids = new Set();
  for (const card of snapshot.cards) {
    if (typeof card.id !== 'string' || ids.has(card.id)) throw new Error(`Invalid or duplicate card ID in catalog-snapshot.json: ${card.id}`);
    ids.add(card.id);
  }
  const list = JSON.stringify({cards: snapshot.cards.map(card => listCard(card, cachedImages))});
  // Same text the list's search joins in: c.searchText ?? c.description (join turns a missing value into '').
  const search = JSON.stringify({searchText: Object.fromEntries(snapshot.cards.map(card => [card.id, card.searchText ?? card.description ?? '']))});
  const version = createHash('sha256').update(list).update('\0').update(search).digest('hex').slice(0, 12);
  return {version, files: {[CARD_LIST_FILE]: list, [CARD_SEARCH_FILE]: search}};
}
