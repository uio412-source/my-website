import {createHash} from 'node:crypto';
import {withoutHotelOffers} from '../lib/hotel-offers.mjs';
import {offerApplies, groupCards, cardFamilyKey} from '../lib/catalog-model';
import {offerContentKey, offerSourceKey, requiresEntry} from '../lib/offer-keys';
import type {Card, Offer} from '../lib/catalog-types';
import {listCard} from './card-list.mjs';

// 화면이 받는 데이터 파일을 빌드 때 만듭니다. 큰 원본(data/events.json 약 2MB, 카드 목록 1.8MB)을
// 통째로 받지 않고 화면별로 필요한 만큼만 받게 해서 첫 화면을 빠르게 합니다.
//   event-list.json        목록(발급이벤트·카드사 이벤트)과 카드 목록의 "진행 중 이벤트" 수가 읽는 필드만
//   event-links.json       카드 상세의 "이 카드로 챙기는 이벤트"용. 카드를 지정한 이벤트만
//                          (cardTarget·cardIds·cardNames가 없는 이벤트는 offerApplies가 어떤 카드에도 연결하지 않음)
//   event-data/<id>.json   이벤트 상세 하나: 원본 이벤트 전체 + 연결된 카드(offerApplies·groupCards로 미리 계산)
//   card-family/<id>.json  카드 상세의 같은 카드 묶음(다른 브랜드·디자인). card-list.json과 같은 필드
//   home-cards.json        목록 첫 화면의 카드 24장. card-list.json과 같은 필드 + 검색 문구
// 호텔 자체 혜택 이벤트는 여기서 뺍니다(lib/hotel-offers.mjs).

export const eventDataFile = (id: string) => `event-data/${id}.json`;
export const cardFamilyFile = (id: string) => `card-family/${id}.json`;

// 목록·카드 상세가 읽는 이벤트 필드. 새 필드를 목록이나 카드 상세에서 읽게 되면 여기에 추가하세요.
const LIST_FIELDS = [
  'id', 'kind', 'issuer', 'title', 'benefitText', 'description', 'tags', 'status', 'startsAt', 'startsAtLabel', 'endsAt',
  'channel', 'category', 'cardTarget', 'cardIds', 'cardNames', 'linkLabel', 'eligibilityLabel', 'activation',
  'cashbackAmount', 'cashbackIsMaximum', 'annualFeeOnly', 'verifiedAt', 'verificationLevel',
] as const satisfies readonly (keyof Offer)[];

const hash = (value: string) => createHash('sha256').update(value).digest('base64url').slice(0, 12);

/** 목록용 가벼운 이벤트. 빠진 필드는 pages/data.ts의 restoreOffer()가 기본값으로 채웁니다. */
export function listOffer(o: Offer) {
  const slim: Record<string, unknown> = {};
  for (const field of LIST_FIELDS) if (o[field] !== undefined) slim[field] = o[field];
  // 설명이 혜택 문구와 같으면(약 3분의 2) 한 번만 보냄. 설명이 없던 이벤트는 null로 표시해 되살릴 때 구분
  if (o.description === o.benefitText) delete slim.description;
  else if (o.description === undefined) slim.description = null;
  // 긴 참여 조건·원문 주소 대신 응모 여부와 같은 이벤트를 가려내는 열쇠를 미리 계산(lib/offer-keys.ts)
  slim.entryRequired = requiresEntry(o);
  slim.keys = [hash(offerSourceKey(o)), hash(offerContentKey(o))];
  // 혜택 금액 계산(rewardValue)에 쓰는 값만
  if (o.rewards) slim.rewards = o.rewards.map(({kind, label, amount, unitValue, verified, choiceGroup, annualFee}) => ({kind, label, amount, unitValue, verified, choiceGroup, annualFee}));
  // 발급이벤트 목록은 참여 방법 첫 줄을 보여 줌
  if (o.kind === 'cashback') {
    if (o.participation) slim.participation = o.participation;
    slim.requirements = o.requirements;
  }
  return slim;
}

const targetsCards = (o: Offer) => !!o.cardTarget || !!o.cardIds?.length || !!o.cardNames?.length;

type Input = {events: Offer[]; snapshotCards: Card[]; detailCards: Card[]; homeCards: {id: string}[]; cachedImages: Record<string, string | null>};

/** 만들 파일 전체(경로 → 내용)와 내용 해시(주소의 ?v=). */
export function buildPageData({events: allEvents, snapshotCards, detailCards, homeCards, cachedImages}: Input) {
  if (!Array.isArray(allEvents) || !allEvents.length) throw new Error('events.json has no events');
  const files = new Map<string, string>();
  const events = withoutHotelOffers(allEvents);
  const slim = events.map(listOffer);
  files.set('event-list.json', JSON.stringify({events: slim}));
  files.set('event-links.json', JSON.stringify({events: slim.filter((_, i) => targetsCards(events[i]))}));

  for (const offer of events) {
    const related = targetsCards(offer) ? groupCards(snapshotCards.filter(card => offerApplies(card, offer))).map(({card}) => ({id: card.id, name: card.name, ...(card.familyName ? {familyName: card.familyName} : {})})) : [];
    files.set(eventDataFile(offer.id), JSON.stringify({offer, related}));
  }

  // 카드 상세는 card-list.json 전체 대신 자기 묶음만 받음. 화면과 같은 cardFamilyKey로 상세 카드(cards.json.gz)마다 계산
  const slimCards = new Map(snapshotCards.map(card => [card.id, listCard(card, cachedImages)]));
  const families = new Map<string, Card[]>();
  for (const card of snapshotCards) {
    const key = cardFamilyKey(card);
    families.set(key, [...(families.get(key) ?? []), card]);
  }
  for (const card of detailCards) {
    const family = families.get(cardFamilyKey(card)) ?? [];
    files.set(cardFamilyFile(card.id), JSON.stringify({cards: family.map(variant => slimCards.get(variant.id))}));
  }

  const byId = new Map(snapshotCards.map(card => [card.id, card]));
  files.set('home-cards.json', JSON.stringify({cards: homeCards.map(({id}) => {
    const card = byId.get(id);
    if (!card) throw new Error(`home-cards.json card is missing from catalog-snapshot.json: ${id}`);
    // 첫 화면에서 검색해도 전체 목록과 같은 문구로 찾도록 검색 문구를 같이 보냄(card-list.mjs와 같은 규칙)
    return {...slimCards.get(id), searchText: card.searchText ?? card.description ?? ''};
  })}));

  const digest = createHash('sha256');
  for (const [path, content] of files) digest.update(path).update('\0').update(content).update('\0');
  return {version: digest.digest('base64url').slice(0, 12), files, events};
}
