import data from '../../hotels/valet.json';
import {valetDate, valetQuota, valetStatus} from '../../assets/js/valet-rules.js';
import {sitePath} from './site-path';

export type ValetHotel = typeof data.hotels[number];
type ValetProgram = typeof data.programs[number];

export const valetHotels = data.hotels;
const programs = data.programs;
const byHotel = new Map(valetHotels.map(hotel => [hotel.id, hotel]));
const cardRules = new Map<string, ValetProgram[]>();
for (const program of programs) {
  for (const card of program.cards) {
    if (!card.catalogId) continue;
    const rules = cardRules.get(card.catalogId) ?? [];
    rules.push(program);
    cardRules.set(card.catalogId, rules);
  }
}

export function valetRules(cardId: string) {
  return cardRules.get(cardId) ?? [];
}

export function valetHotelResults(program: ValetProgram, day = valetDate()) {
  return program.hotelIds.map(id => byHotel.get(id)!).filter(hotel => valetStatus(program, hotel, day) === 'available');
}

export function valetMatches(program: ValetProgram, hotelId: string, day: string) {
  const hotel = byHotel.get(hotelId);
  return hotel ? valetStatus(program, hotel, day) === 'available' : hotelId === 'all' && valetHotelResults(program, day).length > 0;
}

export function valetSearchText(rules: ValetProgram[], day: string) {
  return rules.flatMap(program => {
    const hotels = valetHotelResults(program, day);
    return hotels.length ? [
      '호텔 발레파킹 발렛파킹 발렛 무료주차',
      program.brand, program.tier,
      ...hotels.flatMap(hotel => [hotel.name, hotel.district, ...(hotel.aliases ?? [])]),
    ] : [];
  });
}

export function valetStandalone(day: string) {
  return programs.flatMap(program => program.cards.filter(card => !card.catalogId).map(card => ({
    card, program, hotels: valetHotelResults(program, day),
  })));
}

export function valetMapPath(card?: string, hotel?: string) {
  const params = new URLSearchParams();
  if (card) params.set('card', card);
  if (hotel) params.set('hotel', hotel);
  return sitePath('../hotels/valet.html' + (params.size ? '?' + params.toString() : ''));
}

export function valetHotelFilter(value: string | null) {
  return value && (value === 'all' || byHotel.has(value)) ? value : '';
}

export const pendingValet = (card: string) => data.pending.find(pending => pending.catalogId === card);
export {valetDate, valetQuota};
