import {isHotelOffer} from '../lib/hotel-offers.mjs';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {CARD_LIST_FILE, CARD_SEARCH_FILE} from './card-list.mjs';

const dist = new URL('../dist/', import.meta.url);
const cards = JSON.parse(gunzipSync(await readFile(new URL('../data/cards.json.gz', import.meta.url))));
const events = JSON.parse(await readFile(new URL('../data/events.json', import.meta.url), 'utf8'));
const page = await readFile(new URL('index.html', dist), 'utf8');
const snapshot = JSON.parse(await readFile(new URL('catalog-snapshot.json', dist), 'utf8'));

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
if (list.cards.map(card => card.id).join('\n') !== snapshot.cards.map(card => card.id).join('\n')) throw new Error(`${CARD_LIST_FILE} does not match catalog-snapshot.json`);
if (Object.keys(search.searchText).length !== snapshot.cards.length || snapshot.cards.some(card => typeof search.searchText[card.id] !== 'string' || !Object.hasOwn(search.searchText, card.id))) {
  throw new Error(`${CARD_SEARCH_FILE} does not match catalog-snapshot.json`);
}

async function createPage(collection, id) {
  const directory = new URL(`${collection}/${id}/`, dist);
  await mkdir(directory, {recursive: true});
  await writeFile(new URL('index.html', directory), page);
}

// 카드 상세는 같은 카드 묶음을 vite.config.ts(scripts/page-data.ts)가 만든 card-family/<id>.json에서 받습니다.
const families = new Set((await readdir(new URL('card-family/', dist))).map(file => file.replace(/\.json$/, '')));
if (families.size !== cards.length || cards.some(card => !families.has(card.id))) {
  throw new Error('card-family/*.json does not match data/cards.json.gz');
}

const cardDirectory = new URL('card-data/', dist);
await mkdir(cardDirectory, {recursive: true});
for (const card of cards) {
  await writeFile(new URL(`${card.id}.json`, cardDirectory), JSON.stringify(card));
  await createPage('cards', card.id);
}
// 호텔 자체 혜택 이벤트는 앱에서 숨기므로 상세 주소도 만들지 않습니다.
const published = events.filter(event => !isHotelOffer(event));
// 이벤트 상세는 vite.config.ts(scripts/page-data.ts)가 만든 event-data/<id>.json 하나만 받습니다.
const eventData = new Set((await readdir(new URL('event-data/', dist))).map(file => file.replace(/\.json$/, '')));
if (eventData.size !== published.length || published.some(event => !eventData.has(event.id))) {
  throw new Error('event-data/*.json does not match the published events');
}
for (const event of published) {
  await createPage('events', event.id);
}
console.log(`Published ${cards.length} card and ${published.length} event detail routes (${events.length - published.length} hotel offers hidden).`);
