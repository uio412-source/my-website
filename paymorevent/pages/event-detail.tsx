// 이벤트 상세: 얼마나(크게) → 기간·참여·대상(확인된 것만, 모르면 "카드사 안내 확인") → 받는 조건 → 대상 카드
//            → 같은 가맹점의 다른 카드사 이벤트(어느 카드가 나은지 비교) → 같은 카드사의 같은 분야 이벤트
import {useMemo, useState} from 'react';
import {sitePath} from '@/lib/site-path';
import type {Card, Offer} from '@/lib/catalog-types';
import {SiteHeader, SiteFooter} from '@/components/customer-shell';
import {IssuerTile} from '@/components/mc-ui';
import {EventRow, nameAndValue} from '@/components/event-row';
import {currentMonthOffer, dedupeOffers, groupCards, offerApplies, offerStatus, rewardValue, visibleOffer} from '@/lib/catalog-model';
import {cardPath} from '@/lib/card-presentation';
import {customerLines} from '@/lib/customer-copy';
import {conditionLines, decode, viewOf} from '@/lib/event-view';
import {dday, eventSummary, won, ymd} from '@/lib/mc-text';

const UNKNOWN = '카드사 안내 확인';

export default function EventDetail({offer: o, cards, events}: {offer: Offer; cards: Card[]; events: Offer[]}) {
  const v = viewOf(o);
  const related = groupCards(cards.filter(c => offerApplies(c, o)));
  const amount = o.kind === 'cashback' ? rewardValue(o) : null;
  const {value} = nameAndValue(v, amount);
  const headline = amount ? value : v.value?.text ?? null;
  const list = sitePath(o.kind === 'cashback' ? '#cashback' : '#events');
  const status = offerStatus(o);
  const steps = conditionLines(o, customerLines);
  const sum = v.detailed ? decode(eventSummary(o)) : '';
  const showSum = sum && !(headline && sum.replace(/\s/g, '').includes(headline.replace(/^(?:최대|월 최대|총)\s*/, '').split(' ')[0].replace(/\s/g, '')) && sum.length < 30);
  const [allCards, setAllCards] = useState(false);
  const d = dday(o.endsAt);
  const facts: [string, string, boolean?][] = [
    ['기간', (o.endsAt
      ? [o.startsAt ? ymd(o.startsAt) : o.startsAtLabel, ymd(o.endsAt)].filter(Boolean).join(' ~ ')
      : o.status === 'active' ? [o.startsAt ? ymd(o.startsAt) : o.startsAtLabel, '상시'].filter(Boolean).join('부터 ') : o.startsAt ? ymd(o.startsAt) : o.startsAtLabel ?? '')
      + (status === '진행 중' && d ? ` (${d})` : '')],
    ['참여', v.entry === true ? '응모·신청해야 받아요' : v.entry === false ? '응모 없이 결제하면 받아요' : UNKNOWN, v.entry === null],
    ['대상 카드', v.target ?? (related.length ? `${related.length}종 (아래)` : UNKNOWN), !v.target && !related.length],
    ['결제 경로', o.channel && o.channel !== '카드사 공식' ? o.channel : ''],
    ['이용 마감', o.usageEndsAt ? ymd(o.usageEndsAt) : ''],
    ['예약 마감', o.bookingEndsAt && o.bookingEndsAt !== o.endsAt ? ymd(o.bookingEndsAt) : ''],
  ];

  // 같은 가맹점의 다른 카드사 이벤트, 같은 카드사의 같은 분야 이벤트 (진행 중만)
  const live = useMemo(() => dedupeOffers(events.filter(x => x.id !== o.id && x.kind === 'card' && visibleOffer(x) && currentMonthOffer(x))), [events, o.id]);
  const byValue = (a: Offer, b: Offer) => { const x = viewOf(a).value, y = viewOf(b).value; return (y?.won ?? 0) - (x?.won ?? 0) || (y?.pct ?? 0) - (x?.pct ?? 0); };
  const sameMerchant = useMemo(() => v.merchant ? live.filter(x => viewOf(x).merchant === v.merchant).sort(byValue).slice(0, 6) : [], [live, v.merchant]);
  const sameIssuer = useMemo(() => v.field === '기타' ? [] : live.filter(x => x.issuer === o.issuer && viewOf(x).field === v.field && !sameMerchant.includes(x))
    .sort((a, b) => (a.endsAt ?? '9').localeCompare(b.endsAt ?? '9')).slice(0, 4), [live, o.issuer, v.field, sameMerchant]);

  return <div className="pm-site mc"><SiteHeader current={o.kind === 'cashback' ? 'cashback' : 'events'}/><main className="mc-main mc-detail cd">
    <a className="mc-back" href={list}>← {o.kind === 'cashback' ? '발급이벤트' : '카드사 이벤트'}</a>
    <header className="ed-head">
      <p className="ed-kicker"><IssuerTile issuer={o.issuer} size="sm"/>{o.issuer} · {o.kind === 'cashback' ? '신규 발급' : v.field}
        <span className={'mc-pill' + (status === '진행 중' ? ' ok' : ' warn')}>{status === '진행 중' && d ? d : status}</span></p>
      <h1>{v.name}</h1>
      {headline && <p className="ed-amount">{headline}</p>}
      {showSum && <p className="mc-hero-desc">{sum}</p>}
      <div className="cd-actions">
        <a className="mc-btn primary" href={o.sourceDetailUrl ?? o.sourceUrl} target="_blank" rel="noopener noreferrer">{status === '종료' ? '원문 보기 ↗' : '카드사에서 보기 ↗'}</a>
        {o.activation?.url && <a className="mc-btn" href={o.activation.url} target="_blank" rel="noopener noreferrer">{o.activation.method || '등록 페이지'} ↗</a>}
      </div>
    </header>

    <table className="cd-t cd-info"><tbody>
      {facts.filter(([, val]) => val).map(([k, val, unknown]) => <tr key={k}><th scope="row">{k}</th><td>{unknown ? <span className="ed-unknown">{val}</span> : <b>{val}</b>}</td></tr>)}
    </tbody></table>
    {!v.detailed && <p className="mc-note">제목·기간만 확인한 이벤트예요. 조건은 카드사 안내를 확인하세요.</p>}

    {steps.length > 0 && <section className="cd-sec"><h2>받는 조건</h2><ol className="ed-steps">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol></section>}

    {!!o.rewards?.length && <section className="cd-sec"><h2>받는 혜택</h2><table className="cd-t cd-pk">
      <thead><tr><th scope="col">혜택</th><th scope="col">금액</th><th scope="col">구분</th></tr></thead>
      <tbody>{o.rewards.map((r, i) => <tr key={i}>
        <th scope="row"><b>{r.label}</b>{r.conditions.length > 0 && <small>{r.conditions.slice(0, 2).join(' · ')}</small>}</th>
        <td className="cd-t-num"><b>{won(r.amount)}</b></td><td className="cd-t-num"><span>{r.choiceGroup ? '택1' : '–'}</span></td>
      </tr>)}</tbody></table></section>}

    {(o.cardTarget || o.cardNames?.length || related.length > 0) && <section className="cd-sec">
      <h2>대상 카드 <small>{related.length ? related.length + '종' : ''}</small></h2>
      {o.cardTarget && <p className="mc-note">{o.issuer}{o.cardTarget.types?.length ? ' ' + o.cardTarget.types.map(t => t === 'credit' ? '신용' : '체크').join('·') : ''}{o.cardTarget.brands?.length ? ' · ' + o.cardTarget.brands.join('·') : ''} 카드
        {o.cardTarget.excludedNames?.length ? ` (제외: ${o.cardTarget.excludedNames.join(', ')})` : ''}</p>}
      {related.length > 0 && <div className="mc-variants">{(allCards ? related : related.slice(0, 18)).map(g => <a key={g.card.id} href={cardPath(g.card.id)}>{g.card.familyName ?? g.card.name}</a>)}</div>}
      {related.length > 18 && <button type="button" className="mc-more" onClick={() => setAllCards(x => !x)}>{allCards ? '접기' : `${related.length - 18}종 더 보기`}</button>}
    </section>}

    {sameMerchant.length > 0 && <section className="cd-sec">
      <h2>{v.merchant} 다른 카드 이벤트 <small>{sameMerchant.length}</small></h2>
      <div className="mc-rows">{sameMerchant.map(x => <EventRow key={x.id} o={x} hideField/>)}</div>
    </section>}
    {sameIssuer.length > 0 && <section className="cd-sec">
      <h2>{o.issuer} {v.field} 이벤트 <small>{sameIssuer.length}</small></h2>
      <div className="mc-rows">{sameIssuer.map(x => <EventRow key={x.id} o={x} hideField/>)}</div>
    </section>}
    <p className="cd-foot">출처 {o.channel && o.channel !== '카드사 공식' ? o.channel : '카드사 공식'} · {ymd(o.detailVerifiedAt ?? o.verifiedAt)} 확인</p>
  </main><SiteFooter/></div>;
}
