// 카드사 이벤트 한 줄: 어디서(이름) · 얼마나(혜택) · 카드사·분야·응모·대상 · 남은 날
import type {ReactNode} from 'react';
import type {Offer} from '@/lib/catalog-types';
import {IssuerTile} from '@/components/mc-ui';
import {eventPath, rewardValue} from '@/lib/catalog-model';
import {endBucket, viewOf, type EventView} from '@/lib/event-view';
import {dday, today, won, ymd} from '@/lib/mc-text';

/** 이름과 혜택 한 줄. 제목에서 혜택을 못 떼어 냈으면 제목 안의 혜택 부분만 강조(같은 말을 두 번 쓰지 않음) */
export function nameAndValue(v: EventView, amount?: number | null): {name: ReactNode; value: string | null} {
  const value = amount ? `${v.o.cashbackIsMaximum || /최대/.test(v.o.title) ? '최대 ' : ''}${won(amount)}${v.o.kind === 'cashback' ? ' 캐시백' : ''}` : v.value?.text ?? null;
  // 혜택을 제목에서 못 떼어 냈으면(여러 개·문장 속) 제목 안의 그 부분만 강조
  const core = v.value?.raw || v.value?.text.replace(/^(?:최대|월 최대|총)\s*/, '').split(' ')[0];
  if (v.name === v.title && core && v.title.includes(core) && !amount) {
    const i = v.title.indexOf(core);
    return {name: <>{v.title.slice(0, i)}<em>{core}</em>{v.title.slice(i + core.length)}</>, value: null};
  }
  return {name: v.name, value};
}

export function EventRow({o, amount, hideField}: {o: Offer; amount?: number | null; hideField?: boolean}) {
  const v = viewOf(o);
  const d = dday(o.endsAt);
  const soon = !!o.endsAt && (Date.parse(o.endsAt) - Date.parse(today())) / 864e5 <= 7;
  const {name, value} = nameAndValue(v, amount ?? (o.kind === 'cashback' ? rewardValue(o) : null));
  return <a className="mc-row ev-row" href={eventPath(o.id)}>
    <IssuerTile issuer={o.issuer}/>
    <span className="mc-body">
      <b className="ev-name">{name}</b>
      {value && <span className="ev-val">{value}</span>}
      <span className="ev-meta">
        <span>{o.issuer}</span>
        {o.kind === 'cashback' ? <span>신규 발급</span> : !hideField && v.field !== '기타' && <span>{v.field}</span>}
        {v.entry && <span className="warn">응모</span>}
        {v.target && v.target !== `${o.issuer} 전체` && <span>{v.target}</span>}
        {o.channel && o.channel !== '카드사 공식' && <span>{o.channel}</span>}
      </span>
    </span>
    <span className="mc-side">
      {d && <span className={'mc-dd' + (soon ? ' soon' : '')}>{d}</span>}
      <small className="mc-end">{o.endsAt ? '~' + ymd(o.endsAt) : o.status === 'active' ? '상시' : ''}</small>
    </span>
  </a>;
}

/** 마감순 목록을 '3일 안에 끝나요 · 일주일 안 · 한 달 안 · 그 뒤'로 나눠 보여 줌 */
export function EventGroups({list, grouped, hideField, amountOf, counts}: {list: Offer[]; grouped: boolean; hideField?: boolean; amountOf?: (o: Offer) => number | null; counts?: Record<string, number>}) {
  if (!grouped) return <div className="mc-rows">{list.map(o => <EventRow key={o.id} o={o} hideField={hideField} amount={amountOf?.(o)}/>)}</div>;
  const now = today();
  const groups: [string, Offer[]][] = [];
  for (const o of list) {
    const b = endBucket(o.endsAt, now, o.status === 'active');
    const last = groups[groups.length - 1];
    if (last?.[0] === b) last[1].push(o); else groups.push([b, [o]]);
  }
  return <>{groups.map(([label, items]) => <section key={label} className="ev-group">
    <h3 className={label.startsWith('3일') ? 'soon' : undefined}>{label}<span>{counts?.[label] ?? items.length}</span></h3>
    <div className="mc-rows">{items.map(o => <EventRow key={o.id} o={o} hideField={hideField} amount={amountOf?.(o)}/>)}</div>
  </section>)}</>;
}
