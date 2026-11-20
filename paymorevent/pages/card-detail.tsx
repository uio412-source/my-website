import {sitePath} from '@/lib/site-path';
import {IssuerLogo} from '@/components/issuer-logos';
import {PaymentEligibilityTable} from '@/components/payment-eligibility';
import {LinkedEvents} from '@/components/linked-events';
import {PickingDetail,pickingSummary} from '@/components/picking-detail';
import {CardBenefitTabs} from '@/components/card-benefit-tabs';
import {SiteHeader,SiteFooter} from '@/components/customer-shell';
import {ArrowLeft,ArrowUpRight,FileText} from 'lucide-react';
import {linkedOffers,cardFamilyKey,offerApplies,dedupeOffers,formatPicking} from '@/lib/catalog-model';
import {CardArtwork,BrandLogos} from '@/components/card-visuals';
import {cardPath,annualFeeRows,shortText} from '@/lib/card-presentation';
import type {Card, Offer} from '@/lib/catalog-types';
import {customerLines,featureTags} from '@/lib/customer-copy';
const amount=(n:number|null)=>n===null?'—':n===0?'없음':`${n.toLocaleString('ko-KR')}원`;
export default function CardDetail({card, catalog}:{card:Card;catalog:{cards:Card[];events:Offer[]}}) {
 const variants=catalog.cards.filter(c=>cardFamilyKey(c)===cardFamilyKey(card));const family=variants.length?variants:[card];const offers=dedupeOffers(family.flatMap(c=>linkedOffers(c,catalog.events)));const pending=catalog.events.filter(o=>o.status==='needs_review'&&family.some(c=>offerApplies(c,o)));
 const benefits=Array.from(new Map(card.benefits.map(b=>[b.title+'|'+b.detail,b])).values());
 const picking=pickingSummary(card).max;
 return <div className="pm-site pm-detail"><SiteHeader current="cards"/><main className="pm-detail-main">
  <a href={sitePath('#cards')} className="pm-back"><ArrowLeft size={16}/>카드 목록</a>
  <section className="pm-detail-hero"><div className="pm-detail-art"><CardArtwork card={card} large/></div><div><span className="pm-kicker pm-issuer-kicker"><IssuerLogo issuer={card.issuer}/><span>{card.type==='credit'?'신용카드':'체크카드'}</span></span><h1 id="card-name">{card.name}</h1>{card.description&&<p className="pm-detail-description">{shortText(customerLines(card.description).join(' '),140)}</p>}<BrandLogos brands={card.brands}/><div className="pm-detail-hashtags">{featureTags(card).map(tag=><span key={tag}>#{tag}</span>)}</div><div className="pm-hero-facts"><div><span>연회비</span><strong>{amount(card.annualFeeMin)}{card.annualFeeMin!==null&&card.annualFeeMin>0&&<small>부터</small>}</strong></div><div><span>전월실적</span><strong>{card.minimumSpend===null?'확인 중':card.minimumSpend===0?'무실적':`${(card.minimumSpend/10000).toLocaleString('ko-KR')}만원`} {card.minimumSpend!==null&&card.minimumSpend>0&&<small>부터</small>}</strong></div>{picking!==null&&<a href="#picking" className="pm-hero-picking"><span>최고피킹률</span><strong>{formatPicking(picking)}%</strong></a>}</div><div className="pm-actions"><a className="pm-primary" href={card.sourceUrl} target="_blank" rel="noopener noreferrer">카드사에서 보기<ArrowUpRight size={17}/></a>{card.termsUrl&&<a className="pm-secondary" href={card.termsUrl} target="_blank" rel="noopener noreferrer"><FileText size={16}/>상품설명서</a>}</div></div></section>
  {(offers.length>0||pending.length>0)&&<nav className="pm-detail-event-nav"><a href="#related-events">이 카드 이벤트 {offers.length}개 ↓</a><a href={sitePath('?card='+encodeURIComponent(card.id)+'#events')}>이벤트 모아보기 →</a></nav>}
  <LinkedEvents offers={offers} pending={pending}/>
  <CardBenefitTabs benefits={benefits} networkServices={card.networkServices}/>
  <section className="pm-section" id="conditions"><h2>이용 조건</h2><div className="pm-accordions">
   <details><summary>연회비·발급 브랜드</summary><table className="pm-info-table"><tbody>{annualFeeRows(card).map((f,i)=><tr key={i}><th>{f.label}</th><td>{f.amount==='미확인'?'—':f.amount}</td></tr>)}</tbody></table></details>
   {!!card.eligibility?.length&&<details><summary>발급 대상</summary><ul>{card.eligibility.flatMap(customerLines).map((t,i)=><li key={i}>{t}</li>)}</ul></details>}
   <details className="pm-eligibility-details"><summary>결제 항목별 실적·혜택 인정 여부</summary><PaymentEligibilityTable card={card}/></details>
   {variants.length>1&&<details><summary>다른 브랜드·디자인 {variants.length}종</summary><div className="pm-variant-links">{variants.map(v=><a key={v.id} href={cardPath(v.id)} aria-current={v.id===card.id?'page':undefined}><strong>{v.name}</strong><span>{v.brands.join(' · ')} · 연회비 {amount(v.annualFeeMin)}</span></a>)}</div></details>}
  </div></section>
  <PickingDetail card={card}/>
  <a href={sitePath('#cards')} className="pm-back pm-back-bottom"><ArrowLeft size={16}/>카드 목록으로</a>
 </main><SiteFooter/></div>;
}
