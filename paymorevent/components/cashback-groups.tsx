import {issuerIdentity} from '@/lib/issuer-identity';
import {IssuerLogo} from '@/components/issuer-logos';
import type {Offer} from '@/lib/catalog-types';
import {ISSUERS,issuerGroup,rewardValue,eventPath,visibleOffer,dedupeOffers} from '@/lib/catalog-model';
import {ArrowRight} from 'lucide-react';
import {customerLines} from '@/lib/customer-copy';
export function CashbackGroups({offers}:{offers:Offer[]}){
 const unique=dedupeOffers(offers);const groups=[...ISSUERS,'기타'].map(issuer=>({issuer,offers:unique.filter(o=>visibleOffer(o)&&issuerGroup(o.issuer)===issuer).sort((a,b)=>(rewardValue(b)??-1)-(rewardValue(a)??-1))})).filter(g=>g.offers.length);
 return <div className="pm-cashback-groups">{groups.map(g=><section className="pm-cashback-group" key={g.issuer}><header><h2><IssuerLogo issuer={g.issuer}/><span className="sr-only">{issuerIdentity(g.issuer).name}</span></h2></header>{g.offers.map(o=><a className="pm-cashback-row" key={o.id} href={eventPath(o.id)}><div><span>{o.channel??'카드사'}</span><h3>{o.cardNames?.length?o.cardNames.join(' · '):o.title}</h3><p>{(o.participation??o.requirements).flatMap(customerLines).slice(0,1).join('')}</p></div><div className="pm-cashback-value">{rewardValue(o)!==null?<strong>{o.cashbackIsMaximum?'최대 ':''}{rewardValue(o)!.toLocaleString('ko-KR')}원</strong>:<strong>{o.benefitText}</strong>}<span>{o.endsAt?o.endsAt.replaceAll('-','.')+'까지':''}</span></div><ArrowRight size={19} aria-hidden="true"/></a>)}</section>)}</div>;
}
