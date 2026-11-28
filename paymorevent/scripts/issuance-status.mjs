import {readFileSync} from 'node:fs';

const reviewedFile = new URL('../data/verified-issuance-status.json', import.meta.url);
const officialHosts = new Set([
  'shinhancard.com','kbcard.com','samsungcard.com','hyundaicard.com','wooricard.com',
  'hanacard.co.kr','lottecard.co.kr','nonghyup.com','bccard.com','paybooc.co.kr',
  'ibk.co.kr','standardchartered.co.kr','imbank.co.kr','knbank.co.kr','kjbank.com',
  'busanbank.co.kr','suhyup-bank.com','cu.co.kr','epostbank.go.kr','jbbank.co.kr',
  'kakaobank.com','kbanknow.com','kfcc.co.kr','tossbank.com',
]);

export function koreaDay(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function supportedSource(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      && [...officialHosts].some(host => url.hostname === host || url.hostname.endsWith('.' + host));
  } catch {
    return false;
  }
}

function isoDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(value + 'T00:00:00Z');
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value;
}

export function stoppedIssuance(record, today) {
  if (record?.status !== 'discontinued' || !supportedSource(record.discontinuationSourceUrl)) return null;
  const ended = record.discontinuedAt ?? null;
  if (ended !== null && (!isoDay(ended) || ended > today)) return null;
  return {discontinuedAt: ended, discontinuationSourceUrl: record.discontinuationSourceUrl};
}

export function readReviewedIssuance() {
  return JSON.parse(readFileSync(reviewedFile, 'utf8'));
}

export function applyReviewedIssuance(cards, reviewed = readReviewedIssuance(), today = koreaDay()) {
  return cards.map(card => {
    if (!Object.hasOwn(reviewed, card.id)) return card;
    const record = reviewed[card.id];
    // Exact scoped product, never family/checkout similarity or raw collection queue.
    if (record.name !== card.name || record.cardType !== card.type || record.issuer !== card.issuer) return card;
    const fields = stoppedIssuance(record, today);
    return fields ? {...card, ...fields} : card;
  });
}
