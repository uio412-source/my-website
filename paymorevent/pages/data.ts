import {sitePath} from '@/lib/site-path';
import type {Card} from '@/lib/catalog-types';
import {normalizeBrands} from '@/lib/network-brand';

// Content hash of the two files below, set by vite.config.ts so a new build
// never mixes a cached card-list.json with a fresh card-search.json.
declare const __CARD_DATA_VERSION__: string;

// card-list.json and card-search.json are generated at build time from
// data/catalog-snapshot.json (scripts/card-list.mjs). A summary card holds
// only what the list, filters, sorting and the detail pages' family and
// linked-event logic read. Full details come from readCard().
async function readData<T>(file: string, message: string) {
  const response = await fetch(sitePath(`${file}?v=${__CARD_DATA_VERSION__}`), {signal: AbortSignal.timeout(45000)});
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
      // 브랜드 이름은 하나로(제이씨비 → JCB, 유피아이·UPI → UnionPay, 신한 S& → American Express …, lib/network-brand.ts)
      return data.cards.map(card => ({...omitted(), ...card, brands: normalizeBrands(card.brands)}));
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
  return {...card, brands: normalizeBrands(card.brands)};
}
