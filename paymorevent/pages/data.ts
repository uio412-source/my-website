import {sitePath} from '@/lib/site-path';
import type {Card} from '@/lib/catalog-types';

let summaries: Promise<Card[]> | undefined;

export function readCardSummaries() {
  summaries ??= fetch(sitePath('catalog-snapshot.json'), { signal: AbortSignal.timeout(45000) })
    .then(async response => {
      if (!response.ok) throw new Error('카드 목록을 불러오지 못했습니다.');
      const data = await response.json() as {cards: Card[]};
      if (!Array.isArray(data.cards)) throw new Error('카드 목록 형식이 올바르지 않습니다.');
      return data.cards;
    })
    .catch((error: unknown) => {
      summaries = undefined;
      throw error;
    });
  return summaries;
}

export async function readCard(id: string) {
  const response = await fetch(sitePath(`card-data/${encodeURIComponent(id)}.json`));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('카드 상세를 불러오지 못했습니다.');
  const card = await response.json() as Card;
  if (card.id !== id) throw new Error('카드 상세 형식이 올바르지 않습니다.');
  return card;
}
