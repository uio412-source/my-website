import assert from 'node:assert/strict';
import test from 'node:test';
import {applyReviewedIssuance, koreaDay, readReviewedIssuance, stoppedIssuance} from './issuance-status.mjs';
import {termsFor} from './card-terms.mjs';

const today = '2026-11-28';
const id = 'shinhan-200506010001';
const card = {id, name: '신한카드 아름다운', issuer: '신한카드', type: 'credit', benefits: []};
const approved = readReviewedIssuance()[id];

test('reviewed notice attaches only to the exact existing card', () => {
  const [approvedCard, variant, check] = applyReviewedIssuance([
    card, {...card, id: 'shinhan-other', name: '아름다운 청교도'}, {...card, type: 'debit'},
  ], readReviewedIssuance(), today);
  assert.equal(approvedCard.discontinuedAt, '2026-06-25');
  assert.equal(approvedCard.discontinuationSourceUrl, approved.discontinuationSourceUrl);
  assert.equal(variant.discontinuedAt, undefined);
  assert.equal(check.discontinuedAt, undefined);
});

test('only already effective ISO dates or confirmed undated stops are displayed', () => {
  for (const invalid of [
    {...approved, discontinuedAt: '2026-12-01'},
    {...approved, discontinuedAt: '2026-02-30'},
    {...approved, status: 'active'},
    {...approved, discontinuationSourceUrl: 'https://shinhancard.com.example.org/notice'},
    {...approved, discontinuationSourceUrl: null},
  ]) assert.equal(stoppedIssuance(invalid, today), null);
  assert.equal(stoppedIssuance({...approved, discontinuedAt: null}, today).discontinuedAt, null);
  assert.equal(koreaDay(new Date('2026-11-27T15:00:00Z')), today);
});

test('terms attach verified issuance evidence, not family variants or raw legacy status', () => {
  const terms = {...approved, name: '아름다운', cardId: id, benefits: [{label: '국내 할인'}]};
  assert.equal(termsFor(card, terms, today).discontinuedAt, '2026-06-25');
  assert.equal(termsFor(card, {...terms, name: '아름다운(청교도)'}, today).status, undefined);
  assert.equal(termsFor(card, {...terms, cardId: 'shinhan-other'}, today).status, undefined);
  assert.equal(termsFor(card, {...terms, discontinuationSourceUrl: undefined}, today).status, undefined);
  assert.equal(termsFor(card, {...terms, discontinuedAt: '2026-12-01'}, today).status, undefined);
});
