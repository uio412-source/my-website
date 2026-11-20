import {eventSourceKey} from './event-identity';
import type {Offer} from './catalog-types';

// 이벤트를 비교하는 열쇠들. 앱(catalog-model.ts)과 빌드(scripts/event-files.ts)가 같은 함수를 씁니다.
// 빌드는 화면에 가볍게 보낼 이벤트 목록(event-list.json)에서 긴 참여 조건과 원문 주소를 빼는 대신
// 여기서 계산한 값(응모 여부, 같은 이벤트를 가려내는 열쇠)을 미리 넣어 두어 결과가 같게 합니다.

type KeyFields = Pick<Offer, 'issuer' | 'kind' | 'title' | 'startsAt' | 'endsAt' | 'benefitText' | 'requirements' | 'cardIds' | 'channel' | 'sourceUrl' | 'sourceDetailUrl'>;

/** 내용이 같은 이벤트를 가려내는 열쇠 */
export function offerContentKey(o: KeyFields) {
  return JSON.stringify([o.issuer, o.kind, o.title, o.startsAt, o.endsAt, o.benefitText, o.requirements, o.cardIds ?? [], o.channel ?? '']);
}

/** 원문 주소가 같은 이벤트를 가려내는 열쇠(카드사 이벤트 번호를 알 수 없으면 내용 열쇠) */
export function offerSourceKey(o: KeyFields) {
  const source = eventSourceKey(o);
  return source.includes('|') ? o.issuer + '|' + source : offerContentKey(o);
}

export function requiresEntry(o: Pick<Offer, 'entryRequired' | 'title' | 'participation' | 'requirements'>) {
  return o.entryRequired ?? /응모|추첨|랜덤|출석/.test(o.title + ' ' + (o.participation ?? o.requirements).join(' '));
}
