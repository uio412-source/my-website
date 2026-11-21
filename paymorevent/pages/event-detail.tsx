// 이벤트 상세: 핵심(혜택·기간·응모) → 참여 조건 → 대상 카드
import {useState} from 'react';
import {sitePath} from '@/lib/site-path';
import type {Card, Offer} from '@/lib/catalog-types';
import {SiteHeader, SiteFooter} from '@/components/customer-shell';
import {IssuerTile} from '@/components/mc-ui';
import {eventCategory, groupCards, offerApplies, offerLinkLabel, offerStatus, requiresEntry, rewardValue} from '@/lib/catalog-model';
import {cardPath} from '@/lib/card-presentation';
import {customerLines} from '@/lib/customer-copy';
import {dday, eventSummary, won, ymd} from '@/lib/mc-text';

export default function EventDetail({offer: o, cards}: {offer: Offer; cards: Card[]}) {
  const related = groupCards(cards.filter(c => offerApplies(c, o)));
  const amount = rewardValue(o);
  const list = sitePath(o.kind === 'cashback' ? '#cashback' : '#events');
  const status = offerStatus(o);
  // 기간만 되풀이하는 줄("2026.09.10(목) ~ 2026.11.22(일)")은 위 표에 있으니 뺌
  const DATE_ONLY = /^[\s\d.()~월화수목금토일년월일:-]+$|^(?:이벤트\s*)?(?:기간|응모기간|행사기간)\s*[:：]?\s*[\d.\s()~월화수목금토일년-]+$/;
  const steps = [...new Set((o.participation?.length ? o.participation : o.requirements).flatMap(customerLines))].filter(t => !DATE_ONLY.test(t.trim()));
  const sum = eventSummary(o);
  const [allCards, setAllCards] = useState(false);
  const facts: [string, string][] = [
    ['혜택', amount ? (o.cashbackIsMaximum ? '최대 ' : '') + won(amount) : ''],
    ['기간', [o.startsAt ? ymd(o.startsAt) : o.startsAtLabel, o.endsAt ? ymd(o.endsAt) : ''].filter(Boolean).join(' ~ ')],
    ['남은 기간', status === '진행 중' ? dday(o.endsAt) ?? '' : status],
    ['응모', requiresEntry(o) ? '응모해야 받아요' : '응모 없이 자동'],
    ['대상', offerLinkLabel(o)],
    ['채널', o.channel && o.channel !== '카드사 공식' ? o.channel : ''],
    ['이용 마감', o.usageEndsAt ? ymd(o.usageEndsAt) : ''],
    ['예약 마감', o.bookingEndsAt && o.bookingEndsAt !== o.endsAt ? ymd(o.bookingEndsAt) : ''],
  ];
  return <div className="pm-site mc"><SiteHeader current={o.kind === 'cashback' ? 'cashback' : 'events'}/><main className="mc-main mc-detail cd">
    <a className="mc-back" href={list}>← 이벤트 목록</a>
    <header className="ed-head">
      <p className="ed-kicker"><IssuerTile issuer={o.issuer} size="sm"/>{o.issuer} · {o.kind === 'cashback' ? '발급 이벤트' : eventCategory(o)}
        <span className={'mc-pill' + (status === '진행 중' ? ' ok' : ' warn')}>{status}</span></p>
      <h1>{o.title}</h1>
      {amount ? <p className="ed-amount">{o.cashbackIsMaximum ? '최대 ' : ''}{won(amount)}</p> : sum ? <p className="mc-hero-desc">{sum}</p> : null}
      <div className="cd-actions">
        <a className="mc-btn primary" href={o.sourceDetailUrl ?? o.sourceUrl} target="_blank" rel="noopener noreferrer">{status === '종료' ? '원문 보기 ↗' : '카드사에서 참여하기 ↗'}</a>
        {o.activation?.url && <a className="mc-btn" href={o.activation.url} target="_blank" rel="noopener noreferrer">{o.activation.method || '등록 페이지'} ↗</a>}
      </div>
    </header>

    <table className="cd-t cd-info"><tbody>
      {facts.filter(([k, v]) => v && k !== '혜택').map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td><b>{v}</b></td></tr>)}
    </tbody></table>

    {steps.length > 0 && <section className="cd-sec"><h2>참여 조건</h2><ol className="ed-steps">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol></section>}

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
      {related.length > 18 && <button type="button" className="mc-more" onClick={() => setAllCards(v => !v)}>{allCards ? '접기' : `${related.length - 18}종 더 보기`}</button>}
    </section>}
    <p className="cd-foot">출처 카드사 공식 · {ymd(o.detailVerifiedAt ?? o.verifiedAt)}</p>
  </main><SiteFooter/></div>;
}
