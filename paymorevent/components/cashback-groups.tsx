import {issuerIdentity} from '@/lib/issuer-identity';
import {IssuerLogo} from '@/components/issuer-logos';
import type {Offer} from '@/lib/catalog-types';
import {ISSUERS,issuerGroup,rewardValue,eventPath,visibleOffer,dedupeOffers} from '@/lib/catalog-model';
import {ArrowRight} from 'lucide-react';
import {customerLines} from '@/lib/customer-copy';
import {shortText} from '@/lib/card-presentation';
import type {ReactNode} from 'react';
// 확인된 금액이 없을 때는 제목·혜택 문구에서 대표 혜택(최대 30만 포인트, 연회비 100% 캐시백 등)만 뽑아 보여 줌
const HEADLINE=/(?:최대\s*)?[\d,.]+\s*(?:만(?:\s*[\d,.]+\s*천)?|천)?\s*(?:원|포인트|마일리지|마일)(?:\s*(?:상당|캐시백|적립))?|연회비\s*\d+%\s*(?:캐시백|환급|할인)?/;
function headline(o:Offer):ReactNode{const found=HEADLINE.exec(o.title)??HEADLINE.exec(o.benefitText);return found?found[0].trim():shortText(o.benefitText,24);}
export function CashbackGroups({offers}:{offers:Offer[]}){
 const unique=dedupeOffers(offers);const groups=[...ISSUERS,'기타'].map(issuer=>({issuer,offers:unique.filter(o=>visibleOffer(o)&&issuerGroup(o.issuer)===issuer).sort((a,b)=>(rewardValue(b)??-1)-(rewardValue(a)??-1))})).filter(g=>g.offers.length);
 return <div className="pm-cashback-groups">{groups.map(g=><section className="pm-cashback-group" key={g.issuer}><header><h2><IssuerLogo issuer={g.issuer}/><span className="sr-only">{issuerIdentity(g.issuer).name}</span></h2></header>{g.offers.map(o=><a className="pm-cashback-row" key={o.id} href={eventPath(o.id)}><div><span>{o.channel??'카드사'}</span><h3>{o.cardNames?.length?o.cardNames.join(' · '):o.title}</h3><p>{(o.participation??o.requirements).flatMap(customerLines).slice(0,1).join('')}</p></div><div className="pm-cashback-value">{rewardValue(o)!==null?<strong>{o.cashbackIsMaximum?'최대 ':''}{rewardValue(o)!.toLocaleString('ko-KR')}원</strong>:<strong className="pm-cashback-text">{headline(o)}</strong>}<span>{o.endsAt?o.endsAt.replaceAll('-','.')+'까지':''}</span></div><ArrowRight size={19} aria-hidden="true"/></a>)}</section>)}</div>;
}
