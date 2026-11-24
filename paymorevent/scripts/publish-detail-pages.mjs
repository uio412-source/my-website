import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {CARD_LIST_FILE, CARD_SEARCH_FILE} from './card-list.mjs';
import {applyVerifiedCardRules, readVerifiedCardRules} from './verified-card-rules.mjs';

const dist = new URL('../dist/', import.meta.url);
const rules = readVerifiedCardRules();
const cards = applyVerifiedCardRules(JSON.parse(gunzipSync(await readFile(new URL('../data/cards.json.gz', import.meta.url)))), rules);
const events = JSON.parse(await readFile(new URL('../data/events.json', import.meta.url), 'utf8'));
const page = await readFile(new URL('index.html', dist), 'utf8');
// 카드 목록의 원본은 저장소의 data/catalog-snapshot.json. dist에 12.5MB를 내보내지 않고 여기서 직접 읽습니다.
const source = JSON.parse(await readFile(new URL('../data/catalog-snapshot.json', import.meta.url), 'utf8'));
const snapshot = {...source, cards: applyVerifiedCardRules(source.cards, rules, {summary: true})};

function validateIds(records) {
  if (!records.length) throw new Error('Empty publishing snapshot');
  const ids = new Set();
  for (const record of records) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(record.id) || ids.has(record.id)) {
      throw new Error(`Invalid or duplicate record ID: ${record.id}`);
    }
    ids.add(record.id);
  }
  return ids;
}

const cardIds = validateIds(cards);
validateIds(events);
for (const summary of snapshot.cards) {
  if (!cardIds.has(summary.id)) throw new Error(`Missing card details: ${summary.id}`);
}

// The app reads the list from these files, built from the snapshot by vite.config.ts.
const list = JSON.parse(await readFile(new URL(CARD_LIST_FILE, dist), 'utf8'));
const search = JSON.parse(await readFile(new URL(CARD_SEARCH_FILE, dist), 'utf8'));
if (list.cards.map(card => card.id).join('\n') !== snapshot.cards.map(card => card.id).join('\n')) throw new Error(`${CARD_LIST_FILE} does not match data/catalog-snapshot.json`);
if (Object.keys(search.searchText).length !== snapshot.cards.length || snapshot.cards.some(card => typeof search.searchText[card.id] !== 'string' || !Object.hasOwn(search.searchText, card.id))) {
  throw new Error(`${CARD_SEARCH_FILE} does not match catalog-snapshot.json`);
}

async function createPage(collection, id) {
  const directory = new URL(`${collection}/${id}/`, dist);
  await mkdir(directory, {recursive: true});
  await writeFile(new URL('index.html', directory), page);
}

const cardDirectory = new URL('card-data/', dist);
await mkdir(cardDirectory, {recursive: true});
for (const card of cards) {
  await writeFile(new URL(`${card.id}.json`, cardDirectory), JSON.stringify(card));
  await createPage('cards', card.id);
}
for (const event of events) {
  await createPage('events', event.id);
}
console.log(`Published ${cards.length} card and ${events.length} event detail routes.`);
