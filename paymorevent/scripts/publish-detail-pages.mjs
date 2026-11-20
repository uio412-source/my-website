import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';

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
