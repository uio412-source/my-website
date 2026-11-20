import {sitePath} from '@/lib/site-path';
import type {Card, Offer} from '@/lib/catalog-types';

// Content hash of the two files below, set by vite.config.ts so a new build
// never mixes a cached card-list.json with a fresh card-search.json.
declare const __CARD_DATA_VERSION__: string;
// Content hash of the per-page files made by scripts/page-data.ts (event-list.json, event-data/*.json, card-family/*.json …).
declare const __PAGE_DATA_VERSION__: string;

// card-list.json and card-search.json are generated at build time from
// public/catalog-snapshot.json (scripts/card-list.mjs). A summary card holds
// only what the list, filters, sorting and the detail pages' family and
// linked-event logic read. Full details come from readCard().
async function readData<T>(file: string, message: string, version = __CARD_DATA_VERSION__) {
  const response = await fetch(sitePath(`${file}?v=${version}`), {signal: AbortSignal.timeout(45000)});
  if (!response.ok) throw new Error(message);
  return await response.json() as T;
}

// Required Card fields left out of card-list.json. Nothing reads them from a summary.
const omitted = (): Pick<Card, 'description' | 'sourceUrl' | 'annualFeeText' | 'verifiedAt' | 'verificationNote' | 'imageUrl' | 'spendExclusions' | 'benefitExclusions'> =>
  ({description: '', sourceUrl: '', annualFeeText: '', verifiedAt: '', verificationNote: '', imageUrl: null, spendExclusions: [], benefitExclusions: []});

let summaries: Promise<Card[]> | undefined;
let searchable: Promise<Card[]> | undefined;

export function readCardSummaries() {
  summaries ??= readData<{cards: Card[]}>('card-list.json', '카드 목록을 불러오지 못했습니다.')
    .then(data => {
      if (!Array.isArray(data.cards)) throw new Error('카드 목록 형식이 올바르지 않습니다.');
      return data.cards.map(card => ({...omitted(), ...card}));
    })
    .catch((error: unknown) => {
      summaries = undefined;
      throw error;
    });
  return summaries;
}

/** Card summaries with the search text, for the catalog list. */
export function readSearchableCards() {
  searchable ??= Promise.all([
    readCardSummaries(),
    readData<{searchText: Record<string, string>}>('card-search.json', '카드 검색 정보를 불러오지 못했습니다.'),
  ])
    .then(([cards, data]) => {
      const text = data.searchText;
      if (!text || typeof text !== 'object') throw new Error('카드 검색 정보 형식이 올바르지 않습니다.');
      return cards.map(card => ({...card, searchText: Object.hasOwn(text, card.id) ? text[card.id] : undefined}));
    })
    .catch((error: unknown) => {
      searchable = undefined;
      throw error;
    });
  return searchable;
}

export async function readCard(id: string) {
  const response = await fetch(sitePath(`card-data/${encodeURIComponent(id)}.json`));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('카드 상세를 불러오지 못했습니다.');
  const card = await response.json() as Card;
  if (card.id !== id) throw new Error('카드 상세 형식이 올바르지 않습니다.');
  return card;
}

// ----- 화면별 데이터 (scripts/page-data.ts가 빌드 때 만든 파일) -----

/** 목록용 가벼운 이벤트에서 뺀 필드를 채움. 목록·카드 상세는 이 값들을 읽지 않습니다. */
function restoreOffer(slim: Partial<Offer> & Pick<Offer, 'id' | 'title' | 'benefitText'>): Offer {
  return {
    description: slim.benefitText, tags: [], requirements: [], sourceUrl: '', imageUrl: null, chain: null,
    bookingEndsAt: null, stayEndsAt: null, verificationNote: '',
    ...slim,
  } as Offer;
}

function eventFile(file: string) {
  let request: Promise<Offer[]> | undefined;
  return () => request ??= readData<{events: Offer[]}>(file, '이벤트를 불러오지 못했습니다.', __PAGE_DATA_VERSION__)
    .then(data => {
      if (!Array.isArray(data.events)) throw new Error('이벤트 목록 형식이 올바르지 않습니다.');
      return data.events.map(restoreOffer);
    })
    .catch((error: unknown) => {
      request = undefined;
      throw error;
    });
}

/** 발급이벤트·카드사 이벤트 목록 전체(가벼운 필드만) */
export const readEventList = eventFile('event-list.json');
/** 카드를 지정한 이벤트만. 카드 상세의 연결 이벤트에 씀 */
export const readEventLinks = eventFile('event-links.json');

export type RelatedCard = {id: string; name: string; familyName?: string};

/** 이벤트 상세 하나와 연결된 카드(빌드 때 계산) */
export async function readEvent(id: string) {
  const response = await fetch(sitePath(`event-data/${encodeURIComponent(id)}.json?v=${__PAGE_DATA_VERSION__}`), {signal: AbortSignal.timeout(45000)});
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('이벤트 상세를 불러오지 못했습니다.');
  const data = await response.json() as {offer: Offer; related: RelatedCard[]};
  if (data.offer?.id !== id || !Array.isArray(data.related)) throw new Error('이벤트 상세 형식이 올바르지 않습니다.');
  return data;
}

/** 목록 첫 화면의 카드 24장(card-list.json과 같은 필드 + 검색 문구) */
export async function readHomeCards() {
  const data = await readData<{cards: Card[]}>('home-cards.json', '카드 목록을 불러오지 못했습니다.', __PAGE_DATA_VERSION__);
  if (!Array.isArray(data.cards)) throw new Error('카드 목록 형식이 올바르지 않습니다.');
  return data.cards.map(card => ({...omitted(), ...card}));
}

/** 카드 상세의 같은 카드 묶음(다른 브랜드·디자인). card-list.json 전체 대신 이 카드의 묶음만 */
export async function readCardFamily(id: string) {
  const response = await fetch(sitePath(`card-family/${encodeURIComponent(id)}.json?v=${__PAGE_DATA_VERSION__}`), {signal: AbortSignal.timeout(45000)});
  if (response.status === 404) return []; // 없는 카드: readCard()가 null을 돌려 "카드를 찾을 수 없습니다"를 보여 줌
  if (!response.ok) throw new Error('카드 정보를 불러오지 못했습니다.');
  const data = await response.json() as {cards: Card[]};
  if (!Array.isArray(data.cards)) throw new Error('카드 묶음 형식이 올바르지 않습니다.');
  return data.cards.map(card => ({...omitted(), ...card}));
}
