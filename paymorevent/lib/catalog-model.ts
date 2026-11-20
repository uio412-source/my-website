import {sitePath} from './site-path';
import {eventSourceKey} from './event-identity';
import {applyRewardValuations} from './reward-valuation';
import type {Card, Offer, PickingScenario} from './catalog-types';
import {cardThemes,ELIGIBILITY_THEMES,paymentEligibility} from './card-themes';
import {rewardAtSpend} from './reward-calculation';
import {allocateSpending} from './spending-allocation';
export const ISSUERS=['삼성','국민','신한','우리','하나','현대','롯데','농협','BC'];
export const BENEFIT_KINDS=['적립','할인','마일리지','통신 및 제휴','K패스'];
export function issuerGroup(issuer:string){
 if(/삼성/.test(issuer))return '삼성';if(/국민|KB/.test(issuer))return '국민';if(/신한/.test(issuer))return '신한';if(/우리/.test(issuer))return '우리';if(/하나/.test(issuer))return '하나';if(/현대/.test(issuer))return '현대';if(/롯데/.test(issuer))return '롯데';if(/농협|NH/.test(issuer))return '농협';
 if(/BC|기업|IBK|iM뱅크|대구|경남|부산|새마을|신협/.test(issuer))return 'BC';return '기타';
}
export function benefitKinds(c:Card){if(c.benefitKinds)return c.benefitKinds.filter(k=>BENEFIT_KINDS.includes(k));const text=[c.name,...c.benefits.map(b=>b.title+' '+b.category)].join(' ');return BENEFIT_KINDS.filter(k=>k==='적립'?/적립|포인트|캐시백/.test(text):k==='할인'?/할인/.test(text):k==='마일리지'?/마일|스카이패스/.test(text):k==='통신 및 제휴'?/통신|SKT|KT|LG U|제휴/.test(text):/K[- ]?패스|K[- ]?PASS/i.test(text));}
export function picking(s:PickingScenario){
 if(!s.verified||!s.maximumVerified)return null;
 if(s.calculation==='unit-rate')return typeof s.grossBenefitRate==='number'&&Number.isFinite(s.grossBenefitRate)&&s.grossBenefitRate>=0?s.grossBenefitRate:null;
 if(s.calculation!=='tier-cap'||s.basis!=='minimum-tier'||!s.minimumEligibleSpend||s.monthlyBenefit===null||s.monthlyBenefit<0)return null;
 return s.monthlyBenefit/s.minimumEligibleSpend*100;
}
export function pickingOptions(c:Card){
 c=applyRewardValuations(c);
 if(c.sourceReviewPending)return [];
 if(c.rewardCoveragePending)return [];
 // An unresolved purchase fee component can change the maximum. Do not publish an understated total.
 if(c.feeWaivers?.some(f=>!f.verified)||(c.feeWaivers===undefined&&c.rewardComponentsPending)||c.rewardRates?.some(r=>r.feeWaiver&&!r.feeWaiver.verified))return [];
 const legacy=(c.pickingScenarios??[]).map(s=>({scenario:s,value:picking(s)})).filter((x):x is {scenario:PickingScenario;value:number}=>x.value!==null);
 for(const plan of c.spendingPlans??[]){const result=allocateSpending(plan);if(result)legacy.push({value:result.percentage,scenario:{label:plan.label,monthlySpend:plan.budget,monthlyBenefit:result.benefit,annualFee:0,verified:true,maximumVerified:true,calculation:'tier-cap',basis:'minimum-tier',minimumEligibleSpend:plan.minimumSpend,sourceUrl:plan.sourceUrl,assumptions:[...plan.notes,...result.allocations.map(a=>`${a.label}: ${Math.round(a.spend).toLocaleString('ko-KR')}원 사용 → ${Math.round(a.benefit).toLocaleString('ko-KR')}원 혜택`),`총 ${plan.budget.toLocaleString('ko-KR')}원 소비 내에서 영역·통합 한도를 적용한 배분입니다. 전월실적 인정 여부와 당월 혜택 사용액은 별도입니다.`],components:result.allocations.map(a=>({label:a.label,amount:a.benefit,cap:a.cap===null?'한도 없음':`${a.cap.toLocaleString('ko-KR')}원`}))}});}
 const rates=(c.rewardRates??[]).filter(r=>r.verified&&r.spendUnit>0&&r.unitValue>0&&r.rewardUnits>=0);
 // If a tiered service reaches its cap, a complete budget allocation is needed
 // to prove the card maximum. A basic unit rate alone would understate it.
 if(!c.rewardModelComplete&&rates.some(r=>r.minimumSpend>0&&r.monthlyCapValue!==null&&r.monthlyCapValue<r.minimumSpend*r.rewardUnits*r.unitValue/r.spendUnit))return legacy;
 // With a no-spend basic benefit, unit earning rates replace division by zero.
 // Each special rate retains its own prior-month requirement and cap; rates are alternatives.
 if(c.rewardModelComplete||rates.some(r=>r.minimumSpend===0))for(const r of rates){
  // A complete model may have an actual total or additional earning cap at
  // the minimum tier. Apply it to that spending amount instead of publishing
  // either the headline rate or cap/minimum without checking achievable value.
  if(r.minimumSpend>0&&(c.rewardModelComplete||r.additionalMonthlyCapValue!==undefined)){
   const result=rewardAtSpend(r,r.minimumSpend);if(!result)continue;
   legacy.push({value:result.percentage,scenario:{label:r.label,monthlySpend:r.minimumSpend,monthlyBenefit:result.benefit,annualFee:0,verified:true,maximumVerified:true,calculation:'tier-cap',basis:'minimum-tier',minimumEligibleSpend:r.minimumSpend,benefitScope:r.label,sourceUrl:r.sourceUrl,assumptions:[r.note,`전월 ${r.minimumSpend.toLocaleString('ko-KR')}원 조건을 충족하고 당월 같은 금액을 해당 대상에 사용한 경우.`,...(result.fee?[`동일 결제 수수료 면제 ${formatPicking(result.fee/r.minimumSpend*100)}% 포함.`,r.feeWaiver!.note]:[]),'영역별 요율은 대안입니다. 같은 거래의 기본·추가 적립만 합산하며 연회비·바우처·연간 보너스는 제외합니다.'],components:[{label:'적립·할인',amount:result.earning,cap:r.monthlyCapValue===null?'총 한도 없음':`${r.monthlyCapValue.toLocaleString('ko-KR')}원`},...(result.fee?[{label:'동일 거래 수수료 면제',amount:result.fee,cap:'적용 조건 참조'}]:[])]}});continue;
  }
  const earning=r.rewardUnits*r.unitValue/r.spendUnit*100;
  const waiver=r.feeWaiver?.verified&&r.feeWaiver.rate!==null&&r.feeWaiver.minimumSpend!==null&&r.feeWaiver.minimumSpend<=r.minimumSpend?r.feeWaiver:null;
  const value=earning+(waiver?.rate??0);
  // A capped headline rate is not the maximum at the required spend tier.
  // Such products need a complete allocation scenario, including fallback rewards.
  if(r.minimumSpend>0&&r.monthlyCapValue!==null&&r.monthlyCapValue<r.minimumSpend*earning/100)continue;
  legacy.push({value,scenario:{label:r.label,monthlySpend:null,monthlyBenefit:null,annualFee:0,verified:true,maximumVerified:true,calculation:'unit-rate',basis:'minimum-tier',minimumEligibleSpend:r.minimumSpend,grossBenefitRate:value,benefitScope:r.label,sourceUrl:r.sourceUrl,assumptions:[`${r.spendUnit.toLocaleString('ko-KR')}원당 ${r.rewardUnits} ${r.rewardUnit} × ${r.unitValue}원 = ${formatPicking(earning)}%.`,...(waiver?[`동일 해외 결제 수수료 면제 ${formatPicking(waiver.rate!)}%를 더해 ${formatPicking(value)}%.`,waiver.note,`수수료 면제 공식 원문: ${waiver.sourceUrl}`]:[]),r.note,r.minimumSpend===0?'전월실적 조건 없음. 사용금액당 적립률로 계산합니다.':`해당 혜택 전월실적 ${r.minimumSpend.toLocaleString('ko-KR')}원 조건.`, '연회비·바우처·연간 기프트·보너스 및 비금전 서비스 가치는 제외.'],components:[]}});
 }
 return legacy;
}
export function bestPicking(c:Card){return pickingOptions(c).sort((a,b)=>b.value-a.value)[0]??null;}
export function formatPicking(n:number){return Number(n.toFixed(2)).toLocaleString('ko-KR',{maximumFractionDigits:2});}
export function pickingRange(c:Card){const options=pickingOptions(c);if(!options.length)return null;const values=options.map(x=>x.value);const min=Math.min(...values),max=Math.max(...values);return {min,max,label:min===max?formatPicking(max)+'%':formatPicking(min)+'~'+formatPicking(max)+'%'};}
export const EVENT_CATEGORIES=['해외/여행','포인트/캐시백','국세 / 지방세','통신사 등 제휴','기타'] as const;
export function eventCategory(o:Offer){
 if(o.category&&o.category!=='기타'&&EVENT_CATEGORIES.includes(o.category as typeof EVENT_CATEGORIES[number]))return o.category;
 const t=o.title+' '+o.benefitText;
 return /국세|지방세|세금/.test(t)?'국세 / 지방세':/해외|여행|항공|호텔|숙박/.test(t)?'해외/여행':/통신|제휴|SKT|KT|LG U/.test(t)?'통신사 등 제휴':/포인트|캐시백|머니/.test(t)?'포인트/캐시백':o.kind==='card'&&!!o.cardNames?.length?'통신사 등 제휴':'기타';
}
export function requiresEntry(o:Offer){return o.entryRequired??/응모|추첨|랜덤|출석/.test(o.title+' '+(o.participation??o.requirements).join(' '));}
export function offerStatus(o:Offer,today=new Date(Date.now()+9*3600000).toISOString().slice(0,10)){
 if(o.status==='needs_review')return '조건 재확인';if(o.status==='official_hub')return '공식 이벤트 목록';
 if(o.status==='expired'||(o.endsAt&&o.endsAt<today))return '종료';
 if(o.startsAt&&o.startsAt>today)return '예정';
 if(!o.startsAt&&o.startsAtLabel==='수신일'&&o.endsAt)return '수신 대상';if(!o.startsAt||!o.endsAt)return '기간 확인 필요';return '진행 중';
}
export function activeOffer(o:Offer,today?:string){return offerStatus(o,today)==='진행 중';}
export function currentMonthOffer(o:Offer,today=new Date(Date.now()+9*3600000).toISOString().slice(0,10)){return (o.status==='active'||o.status==='upcoming')&&(!!o.startsAt||o.startsAtLabel==='수신일')&&!!o.endsAt&&o.endsAt>=today&&(!o.startsAt||o.startsAt<=today.slice(0,7)+'-31');}
export function isAnnualFeeOffer(o:Offer){return o.annualFeeOnly??(o.kind==='cashback'&&/연회비/.test(o.title+' '+o.benefitText));}
export function rewardValue(o:Offer){
 if(isAnnualFeeOffer(o))return null;
 if(!o.rewards?.length)return o.cashbackAmount??null;
 const verified=o.rewards.filter(r=>r.verified&&r.unitValue===1&&!r.annualFee&&r.amount>=0);
 if(!verified.length)return null;
 const alternatives=new Map<string,number>();let total=0;
 for(const r of verified){if(r.choiceGroup)alternatives.set(r.choiceGroup,Math.max(alternatives.get(r.choiceGroup)??0,r.amount));else total+=r.amount;}
 return total+[...alternatives.values()].reduce((n,x)=>n+x,0);
}
export function visibleOffer(o:Offer){return !isAnnualFeeOffer(o);}
export function offerTags(o:Offer){return [issuerGroup(o.issuer)==='기타'?o.issuer:issuerGroup(o.issuer)+'카드',...(o.cardNames?.length?o.cardNames:[o.cardTarget?'카드사 공통(조건 확인)':'대상 확인']),...(/캐시백/.test(o.title+' '+o.benefitText)||o.kind==='cashback'?['캐시백']:[]),...(requiresEntry(o)?['응모형']:[])];}
export function eventPath(id:string){return sitePath(`events/${encodeURIComponent(id)}/`);}
const cardNameKey=(s:string)=>s.toLowerCase().replace(/[\s·]/g,'');
export function cardFamilyKey(c:Card){return c.issuer+'|'+(c.familyId??c.type+'|'+cardNameKey(c.name));}
export function groupCards(cards:Card[]){const map=new Map<string,{card:Card;variants:Card[]}>();for(const c of cards){const k=cardFamilyKey(c);const g=map.get(k);if(g)g.variants.push(c);else map.set(k,{card:c,variants:[c]});}return [...map.values()];}
const networkKey=(s:string)=>{const k=s.toLowerCase().replace(/[\s._-]/g,'');return /^(master|mastercard|마스터|마스터카드)$/.test(k)?'mastercard':/^(amex|americanexpress|아멕스)$/.test(k)?'amex':/^(unionpay|유니온페이|은련)$/.test(k)?'unionpay':k;};
export function offerApplies(c:Card,o:Offer){
 // Constraints apply to every path, including an explicit product ID.
 const t=o.cardTarget;
 if(t){
  if((c.issuerGroup??issuerGroup(c.issuer))!==issuerGroup(o.issuer))return false;
  if(t.types?.length&&!t.types.includes(c.type))return false;
  if(t.brands?.length&&!c.brands.some(b=>t.brands!.some(n=>networkKey(n)===networkKey(b))))return false;
  if(t.excludedNames?.some(n=>c.name.includes(n)))return false;
  if(t.excludedBrands?.some(b=>c.brands.some(n=>networkKey(n)===networkKey(b))))return false;
 }
 if(o.cardIds?.includes(c.id))return true;
 const names=[c.name,...(c.searchAliases??[])];
 if(o.issuer===c.issuer&&o.cardNames?.some(n=>names.some(name=>cardNameKey(n)===cardNameKey(name))))return true;
 if(t?.scope==='family')return !!c.familyId&&!!t.familyIds?.includes(c.familyId);
 return t?.scope==='issuer';
}
export function offerLinkLabel(o:Offer){return o.linkLabel??(o.cardTarget?.scope==='family'||o.cardIds?.length||o.cardNames?.length?'카드 전용':o.cardTarget?.brands?.length?o.cardTarget.brands.join('·')+' 제휴':o.cardTarget?.types?.length===1&&o.cardTarget.types[0]==='debit'?'체크카드 공통':'카드사 공통');}
export function linkedOffers(c:Card,offers:Offer[]){return dedupeOffers(offers.filter(o=>visibleOffer(o)&&activeOffer(o)&&offerApplies(c,o))).sort((a,b)=>Number(offerLinkLabel(b)==='카드 전용')-Number(offerLinkLabel(a)==='카드 전용')||(a.endsAt??'').localeCompare(b.endsAt??''));}
export function dedupeOffers(offers:Offer[]){
 const bySource=new Map<string,Offer>();
 for(const o of offers){
  const source=eventSourceKey(o);const key=source.includes('|')?o.issuer+'|'+source:JSON.stringify([o.issuer,o.kind,o.title,o.startsAt,o.endsAt,o.benefitText,o.requirements,o.cardIds??[],o.channel??'']);const prior=bySource.get(key);
  if(!prior){bySource.set(key,o);continue;}
  const newer=o.verifiedAt>prior.verifiedAt;
  const samePeriod=o.startsAt===prior.startsAt&&o.endsAt===prior.endsAt;
  if(newer||(samePeriod&&o.verificationLevel==='official_detail'&&prior.verificationLevel!=='official_detail'))bySource.set(key,o);
 }
 const seen=new Set<string>();return [...bySource.values()].filter(o=>{const key=JSON.stringify([o.issuer,o.kind,o.title,o.startsAt,o.endsAt,o.benefitText,o.requirements,o.cardIds??[],o.channel??'']);if(seen.has(key))return false;seen.add(key);return true;});
}
export function databaseChecklist(c:Card){
 if(c.documents===undefined&&c.databaseChecks)return c.databaseChecks;
 return [
  {label:'상품 일치 원문',complete:!!c.documents?.some(d=>d.kind!=='brand'&&d.identityStatus==='matched'&&d.readStatus==='read')},
  {label:'전월실적 조건',complete:c.minimumSpend!==null},
  {label:'실적 제외 원문',complete:c.spendExclusions.length>0},
  {label:'혜택 제외 원문',complete:c.benefitExclusions.length>0},
  {label:'상품권·세금·관리비 판정',complete:ELIGIBILITY_THEMES.every(t=>{const e=paymentEligibility(c,t);return e.spend!=='unknown'&&e.benefit!=='unknown';})},
  {label:'최고피킹률 산출',complete:!!bestPicking(c)},
  {label:'수수료 면제 조건',complete:!(c.feeWaivers?.length)||c.feeWaivers.every(f=>f.verified)},
 ];
}

export function summarize(c:Card){c=applyRewardValuations(c);const {documents,policyNotes,feeWaivers,...light}=c;return {...light,eligibilityRules:c.eligibilityRules,rewardComponentsPending:!!c.feeWaivers?.some(f=>!f.verified),databaseChecks:databaseChecklist(c),themeTags:cardThemes(c),paymentEligibility:Object.fromEntries(ELIGIBILITY_THEMES.map(t=>[t,paymentEligibility(c,t)])),issuerGroup:c.issuerGroup??issuerGroup(c.issuer),benefitKinds:benefitKinds(c),benefitCount:c.benefits.length,searchText:[c.description,...(c.searchAliases??[]),...c.benefits.map(b=>b.title+' '+b.detail)].join(' '),benefits:c.benefits.slice(0,2).map(b=>({...b,detail:b.detail.slice(0,80),spendExclusions:undefined,benefitExclusions:undefined})),description:c.description.slice(0,100),spendExclusions:[],benefitExclusions:[]};}

