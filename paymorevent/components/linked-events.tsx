import type {Offer} from '@/lib/catalog-types';
import {eventPath,dedupeOffers,offerLinkLabel,requiresEntry} from '@/lib/catalog-model';
import {ArrowRight} from 'lucide-react';
export function LinkedEvents({offers,pending=[]}:{offers:Offer[];pending?:Offer[]}){
 if(!offers.length&&!pending.length)return null;
 const groups=new Map<string,Offer[]>();for(const o of dedupeOffers(offers)){const label=offerLinkLabel(o);groups.set(label,[...(groups.get(label)??[]),o]);}
 return <section className="pm-linked-events" id="related-events"><h2>이 카드로 챙기는 이벤트 <small>{offers.length}</small></h2>
  {[...groups].map(([label,items])=><details className="pm-linked-group" key={label} open={label==='트래블러스 전용'}><summary>{label} · {items.length}개</summary>{items.map(o=><a key={o.id} href={eventPath(o.id)}><div><strong>{o.title}</strong>{o.benefitText!==o.title&&<span>{o.benefitText}</span>}<span className="pm-event-badges">{o.eligibilityLabel&&<b>{o.eligibilityLabel}</b>}{requiresEntry(o)&&<b>응모 필요</b>}{o.activation&&<b>{o.activation.cycle==='quarterly'?'분기별 활성화':'쿠폰·등록 필요'}</b>}<em>{o.endsAt}까지</em></span></div><ArrowRight size={18}/></a>)}</details>)}
  {pending.length>0&&<details className="pm-event-pending"><summary>조건 확인이 필요한 이벤트 {pending.length}개</summary>{pending.map(o=><a key={o.id} href={eventPath(o.id)}><div><strong>{o.title}</strong><span>{o.benefitText}</span></div><ArrowRight size={18}/></a>)}</details>}
 </section>;
}
