import {sitePath} from '@/lib/site-path';
import type {Card, Offer} from '@/lib/catalog-types';
import {IssuerLogo} from '@/components/issuer-logos';
import {SiteHeader,SiteFooter} from '@/components/customer-shell';
import {eventCategory,offerStatus,rewardValue,offerApplies,groupCards,issuerGroup,requiresEntry,offerLinkLabel} from '@/lib/catalog-model';
import {cardPath} from '@/lib/card-presentation';
import {ArrowLeft,ArrowUpRight} from 'lucide-react';
import {customerLines} from '@/lib/customer-copy';
export default function EventDetail({offer: o, cards}:{offer:Offer;cards:Card[]}) {
 const related=groupCards(cards.filter(c=>offerApplies(c,o)));const amount=rewardValue(o);const list=sitePath(o.kind==='cashback'?'#cashback':o.kind==='hotel'?'#hotels':'#events');
 const requirements=[...new Set(o.requirements.flatMap(customerLines))];
 return <div className="pm-site pm-detail"><SiteHeader current="events"/><main className="pm-detail-main"><a className="pm-back" href={list}><ArrowLeft size={16}/>이벤트 목록</a><section className="pm-event-hero"><div className="pm-event-meta"><IssuerLogo issuer={o.issuer}/><span className="pm-status">{offerStatus(o)}</span></div><span className="pm-kicker">{eventCategory(o)}</span><h1>{o.title}</h1>{o.benefitText!==o.title&&<p>{o.benefitText}</p>}<a className="pm-primary" href={o.sourceUrl} target="_blank" rel="noopener noreferrer">{offerStatus(o)==='종료'?'종료 이벤트 원문 보기':o.status==='needs_review'?'공식 조건 확인하기':'이벤트 참여하기'}<ArrowUpRight size={17}/></a></section>
  <section className="pm-section"><h2>혜택과 참여 방법</h2><table className="pm-info-table"><tbody>
   {o.kind==='cashback'&&amount!==null&&<tr><th>받을 수 있는 혜택</th><td><strong className="pm-reward">{o.cashbackIsMaximum?'최대 ':''}{amount.toLocaleString('ko-KR')}원</strong></td></tr>}
   {(o.startsAt||o.startsAtLabel||o.endsAt)&&<tr><th>이벤트 기간</th><td>{[o.startsAt??o.startsAtLabel,o.endsAt].filter(Boolean).join(' ~ ')}</td></tr>}
   {o.usageEndsAt&&<tr><th>이용 마감</th><td>{o.usageEndsAt}</td></tr>}{o.bookingEndsAt&&<tr><th>예약 마감</th><td>{o.bookingEndsAt}</td></tr>}{o.stayEndsAt&&<tr><th>투숙 기간</th><td>{o.stayEndsAt}까지</td></tr>}{o.channel&&<tr><th>발급·참여 채널</th><td>{o.channel}</td></tr>}
   {o.eligibilityLabel&&<tr><th>대상 조건</th><td><strong>{o.eligibilityLabel}</strong></td></tr>}
   <tr><th>응모</th><td>{requiresEntry(o)?'응모 필요':'별도 응모 여부는 참여 방법 참조'}</td></tr>
   {o.activation&&<tr><th>참여 준비</th><td>{o.activation.method}{o.activation.cycle==='quarterly'?' · 분기마다 재확인':''}{o.activation.url&&<p><a href={o.activation.url} target="_blank" rel="noopener noreferrer">등록·쿠폰 페이지 열기 ↗</a></p>}</td></tr>}
   {o.detailVerifiedAt&&<tr><th>조건 확인일</th><td>{o.detailVerifiedAt}</td></tr>}
   {!!o.cardNames?.length&&<tr><th>대상 카드</th><td>{o.cardNames.join(' · ')}</td></tr>}
   {!!o.cardTarget&&<tr><th>{o.cardTarget.scope==='family'?'브랜드·유형':'대상 카드'}</th><td>{o.issuer}{o.cardTarget.types?.length?' '+o.cardTarget.types.map(t=>t==='credit'?'신용':'체크').join('·'):' 카드'}{o.cardTarget.brands?.length?' · '+o.cardTarget.brands.join('·'):''}{!!o.cardTarget.excludedNames?.length&&<p>제외: {o.cardTarget.excludedNames.join(' · ')}</p>}{!!o.cardTarget.excludedBrands?.length&&<p>제외 브랜드: {o.cardTarget.excludedBrands.join(' · ')}</p>}</td></tr>}
   {requirements.length>0&&<tr><th>참여 조건</th><td><ul className="pm-condition-list">{requirements.map((r,i)=><li key={i}>{r}</li>)}</ul></td></tr>}
   {!!o.rewards?.length&&<tr><th>혜택 구성</th><td>{o.rewards.map((r,i)=><p key={i}>{r.label} · {r.amount.toLocaleString('ko-KR')}원{r.choiceGroup?' (선택 혜택)':''}</p>)}</td></tr>}
  </tbody></table></section>
  {related.length>0&&<details className="pm-reviews" open><summary>연결된 카드 {related.length}종 · {offerLinkLabel(o)}</summary><div className="pm-variant-links">{related.map(g=><a key={g.card.id} href={cardPath(g.card.id)}>{g.card.familyName??g.card.name}</a>)}</div></details>}
  <a className="pm-back pm-back-bottom" href={list}><ArrowLeft size={16}/>이벤트 목록으로</a></main><SiteFooter/></div>;
}
