import {sitePath} from './site-path';
import {eventSourceKey} from './event-identity';
import {applyRewardValuations} from './reward-valuation';
import type {Card, Offer, PickingScenario, RewardRate} from './catalog-types';
import {cardThemes,ELIGIBILITY_THEMES,paymentEligibility} from './card-themes';
import {rewardAtSpend} from './reward-calculation';
import {allocateSpending} from './spending-allocation';
export const ISSUERS=['삼성','국민','신한','우리','하나','현대','롯데','농협','BC','새마을'];
export const BENEFIT_KINDS=['적립','할인','마일리지','호텔제휴','통신 및 제휴','K패스'];
export function issuerGroup(issuer:string){
 if(/삼성/.test(issuer))return '삼성';if(/국민|KB/.test(issuer))return '국민';if(/신한/.test(issuer))return '신한';if(/우리/.test(issuer))return '우리';if(/하나/.test(issuer))return '하나';if(/현대/.test(issuer))return '현대';if(/롯데/.test(issuer))return '롯데';if(/농협|NH/.test(issuer))return '농협';
 if(/새마을|MG새마을/.test(issuer))return '새마을';
 if(/BC|기업|IBK|iM뱅크|대구|경남|부산|신협/.test(issuer))return 'BC';return '기타';
}
export function benefitKinds(c:Card){if(c.benefitKinds)return c.benefitKinds;const text=[c.name,...c.benefits.map(b=>b.title+' '+b.category)].join(' ');return BENEFIT_KINDS.filter(k=>k==='적립'?/적립|포인트|캐시백/.test(text):k==='할인'?/할인/.test(text):k==='마일리지'?/마일|스카이패스/.test(text):k==='호텔제휴'?/호텔|리조트|메리어트|힐튼|아코르/.test(text):k==='통신 및 제휴'?/통신|SKT|KT|LG U|제휴/.test(text):/K[- ]?패스|K[- ]?PASS/i.test(text));}
export function picking(s:PickingScenario){
 if(!s.verified||!s.maximumVerified)return null;
 if(s.calculation==='unit-rate')return typeof s.grossBenefitRate==='number'&&Number.isFinite(s.grossBenefitRate)&&s.grossBenefitRate>=0?s.grossBenefitRate:null;
 if(s.calculation!=='tier-cap'||s.basis!=='minimum-tier'||!s.minimumEligibleSpend||s.monthlyBenefit===null||s.monthlyBenefit<0)return null;
 return s.monthlyBenefit/s.minimumEligibleSpend*100;
}
/** 놀이공원·스포츠 경기·골프처럼 흔하지 않고 이용률이 낮은 혜택. 피킹률 계산에서 뺍니다. */
export const NICHE_PICKING=/놀이공원|테마파크|에버랜드|롯데월드|서울랜드|워터파크|캐리비안|아쿠아리움|동물원|입장권|경기\s*관람|야구|축구|농구|배구|구단|(?<![A-Z])FC(?![A-Z])|메가스토어|골프|스키장|리프트|공연|뮤지컬|박물관|미술관|아카데미|문화센터|호텔스닷컴|익스피디아|아고다|심야|동시\s*충족/i;
/** 구독·멤버십 영역은 한 달에 쓸 수 있는 돈이 정해져 있어, 이 금액까지만 쓴다고 봅니다. */
const SUBSCRIPTION=/멤버십|MEMBERSHIP|OTT|스트리밍|디지털\s*(?:구독|콘텐츠)|넷플릭스|유튜브|유료앱|티빙|웨이브/i;
export const SUBSCRIPTION_SPEND=30000;
/** 전월실적 조건은 없지만 월 한도가 작은 혜택은 이 금액을 쓸 때로 계산합니다. */
export const REFERENCE_SPEND=300000;
const isNiche=(...t:(string|undefined)[])=>NICHE_PICKING.test(t.filter(Boolean).join(' '));
const wonText=(n:number)=>Math.round(n).toLocaleString('ko-KR')+'원';
function rateCap(r:RewardRate){return r.monthlyCapUnits!==undefined?r.monthlyCapUnits*r.unitValue:r.monthlyCapValue;}
/** 피킹률에서 뺀 혜택 이름 (화면 안내용) */
export function pickingExcluded(c:Card){
 const names=[...(c.pickingScenarios??[]).map(s=>s.label),...(c.spendingPlans??[]).flatMap(p=>p.rules.map(r=>r.label)),...(c.rewardRates??[]).filter(r=>r.verified).map(r=>isNiche(r.label,r.serviceTitle)?r.label:'')];
 return [...new Set(names.filter(n=>n&&isNiche(n)))];
}
export function pickingOptions(c:Card){
 c=applyRewardValuations(c);
 if(c.sourceReviewPending)return [];
 if(c.rewardCoveragePending)return [];
 // An unresolved purchase fee component can change the maximum. Do not publish an understated total.
 if(c.feeWaivers?.some(f=>!f.verified)||(c.feeWaivers===undefined&&c.rewardComponentsPending)||c.rewardRates?.some(r=>r.feeWaiver&&!r.feeWaiver.verified))return [];
 const legacy=(c.pickingScenarios??[]).filter(s=>!isNiche(s.label)).map(s=>{
  // A fixed monthly discount whose bill does not count toward the requirement:
  // the bill is paid on top of the prior-month spend.
  if(c.benefitSpendExcluded&&/정액/.test(s.label)&&s.monthlyBenefit&&s.minimumEligibleSpend){const total=s.minimumEligibleSpend+s.monthlyBenefit;return {scenario:{...s,totalSpend:total,assumptions:[`할인받는 요금 ${wonText(s.monthlyBenefit)}은 전월실적에 안 들어가서, 실적 ${wonText(s.minimumEligibleSpend)} + ${wonText(s.monthlyBenefit)} = ${wonText(total)} 기준으로 계산했어요.`,...s.assumptions]},value:s.monthlyBenefit/total*100};}
  return {scenario:s,value:picking(s)};
 }).filter((x):x is {scenario:PickingScenario;value:number}=>x.value!==null);
 for(const plan of c.spendingPlans??[]){
  const dropped=plan.rules.filter(r=>isNiche(r.label)).map(r=>r.label);
  const rules=plan.rules.filter(r=>!isNiche(r.label)).map(r=>({...r,spendExcluded:r.spendExcluded??c.benefitSpendExcluded,maxSpend:r.maxSpend??(SUBSCRIPTION.test(r.label)?SUBSCRIPTION_SPEND:undefined)}));
  const result=rules.length?allocateSpending({...plan,rules}):null;if(!result||result.benefit<=0)continue;
  legacy.push({value:result.percentage,scenario:{label:plan.label,monthlySpend:result.totalSpend,monthlyBenefit:result.benefit,annualFee:0,verified:true,maximumVerified:true,calculation:'tier-cap',basis:'minimum-tier',minimumEligibleSpend:plan.minimumSpend,totalSpend:result.totalSpend,excluded:dropped,sourceUrl:plan.sourceUrl,assumptions:[
   result.extraSpend?`혜택받은 결제 ${wonText(result.extraSpend)}은 전월실적에 안 들어가서, 실적 ${wonText(plan.budget)}을 따로 채운다고 보고 총 ${wonText(result.totalSpend)} 기준으로 나눴어요.`:`총 ${wonText(plan.budget)} 결제 안에서 영역·통합 한도를 적용했어요.`,
   ...result.allocations.map(a=>`${a.label}: ${wonText(a.spend)} 결제 → ${wonText(a.benefit)}${a.outside?' (실적 미포함)':''}`),
   ...(dropped.length?[`이용률이 낮은 ${dropped.join(', ')}은 계산에서 뺐어요.`]:[]),...plan.notes],
   components:result.allocations.map(a=>({label:a.label,amount:a.benefit,cap:a.cap===null?'한도 없음':wonText(a.cap)}))}});
 }
 const rates=(c.rewardRates??[]).filter(r=>r.verified&&r.spendUnit>0&&r.unitValue>0&&r.rewardUnits>=0&&!isNiche(r.label,r.serviceTitle));
 // If a tiered service reaches its cap, a complete budget allocation is needed
 // to prove the card maximum. A basic unit rate alone would understate it.
 if(!c.rewardModelComplete&&rates.some(r=>r.minimumSpend>0&&r.monthlyCapValue!==null&&r.monthlyCapValue<r.minimumSpend*r.rewardUnits*r.unitValue/r.spendUnit))return legacy;
 // With a no-spend basic benefit, unit earning rates replace division by zero.
 // Each special rate retains its own prior-month requirement and cap; rates are alternatives.
 if(c.rewardModelComplete||rates.some(r=>r.minimumSpend===0))for(const r of rates){
  const rate=r.rewardUnits*r.unitValue/r.spendUnit,cap=rateCap(r);
  const fixed=rate>=1,sub=SUBSCRIPTION.test(r.label),excluded=r.spendExcluded??c.benefitSpendExcluded??false;
  // 전월실적을 다른 영역(예: 국내)에서 채워야 열리는 요율. 요율의 minimumSpend 는 그 다른 영역의
  // 금액이므로, 같은 금액을 이 영역에도 쓴 경우로 본다. 국내 실적에는 기본 적립이 함께 붙는다.
  // (예: 국내 100만원 초과 시 해외 4% — 국내 100만원을 해외에 쓴 것으로 계산하면 안 됨)
  if(r.minimumSpend>0&&r.minimumSpendArea){
   const result=rewardAtSpend(r,r.minimumSpend);if(!result)continue;
   const baseRate=(r.minimumSpendAreaRewardUnits??0)*r.unitValue/r.spendUnit,base=r.minimumSpend*baseRate;
   const points=Math.min(base+result.earning,cap??Infinity),total=r.minimumSpend*2,benefit=points+result.fee;
   legacy.push({value:benefit/total*100,scenario:{label:r.label,monthlySpend:total,monthlyBenefit:benefit,annualFee:0,verified:true,maximumVerified:true,calculation:'tier-cap',basis:'minimum-tier',minimumEligibleSpend:r.minimumSpend,totalSpend:total,benefitScope:r.label,sourceUrl:r.sourceUrl,assumptions:[
    `${r.minimumSpendArea} 전월실적 ${wonText(r.minimumSpend)}을 채워야 이 요율이 열려서, ${r.minimumSpendArea} ${wonText(r.minimumSpend)} + 같은 금액을 이 영역에 쓴 경우로 계산했어요${sub?' (구독료는 월 3만원까지)':''}.`,
    ...(base>0?[`${r.minimumSpendArea} 실적 ${wonText(r.minimumSpend)}에는 기본 적립 ${formatPicking(baseRate*100)}%(${wonText(base)})가 함께 붙어요.`]:[]),
    ...(cap!==null?[`국내·해외를 합친 한도 ${wonText(cap)}까지 반영했어요.`]:[]),
    ...(result.fee?[`동일 결제 수수료 면제 ${formatPicking(result.fee/r.minimumSpend*100)}% 포함.`,r.feeWaiver!.note]:[]),
    r.note,'영역별 요율은 대안입니다. 연회비·바우처·연간 보너스는 빼고 계산해요.'],components:[...(base>0?[{label:'기본 적립(실적 결제)',amount:base,cap:'적용 조건 참조'}]:[]),{label:'적립·할인',amount:result.earning,cap:cap===null?'총 한도 없음':wonText(cap)},...(result.fee?[{label:'동일 거래 수수료 면제',amount:result.fee,cap:'적용 조건 참조'}]:[])]}});
   continue;
  }
  // A complete model may have an actual total or additional earning cap at
  // the minimum tier. Apply it to that spending amount instead of publishing
  // either the headline rate or cap/minimum without checking achievable value.
  if(r.minimumSpend>0&&(c.rewardModelComplete||r.additionalMonthlyCapValue!==undefined||fixed)){
   if(fixed&&cap===null)continue;
   const fill=cap===null?Infinity:cap/rate;
   let spend=fixed?cap!:r.minimumSpend;
   if(sub)spend=Math.min(spend,SUBSCRIPTION_SPEND);
   const outside=excluded&&Number.isFinite(fill);
   if(outside)spend=Math.min(fill,sub?SUBSCRIPTION_SPEND:Infinity);
   const result=rewardAtSpend(r,spend);if(!result)continue;
   const total=outside?r.minimumSpend+spend:r.minimumSpend;
   legacy.push({value:result.benefit/total*100,scenario:{label:r.label,monthlySpend:total,monthlyBenefit:result.benefit,annualFee:0,verified:true,maximumVerified:true,calculation:'tier-cap',basis:'minimum-tier',minimumEligibleSpend:r.minimumSpend,totalSpend:total,benefitScope:r.label,sourceUrl:r.sourceUrl,assumptions:[
    outside?`이 혜택을 받은 결제 ${wonText(spend)}은 전월실적에 안 들어가서, 실적 ${wonText(r.minimumSpend)} + ${wonText(spend)} = ${wonText(total)} 기준으로 계산했어요.`
     :spend<r.minimumSpend?`전월 ${wonText(r.minimumSpend)} 중 ${wonText(spend)}만 이 영역에 쓴다고 봤어요${sub?' (구독료는 월 3만원까지)':''}.`
     :`전월 ${wonText(r.minimumSpend)} 조건을 채우고 같은 금액을 이 영역에 쓴 경우.`,
    r.note,...(result.fee?[`동일 결제 수수료 면제 ${formatPicking(result.fee/spend*100)}% 포함.`,r.feeWaiver!.note]:[]),'영역별 요율은 대안입니다. 연회비·바우처·연간 보너스는 빼고 계산해요.'],components:[{label:'적립·할인',amount:result.earning,cap:cap===null?'총 한도 없음':wonText(cap)},...(result.fee?[{label:'동일 거래 수수료 면제',amount:result.fee,cap:'적용 조건 참조'}]:[])]}});continue;
  }
  const earning=rate*100;
  const waiver=r.feeWaiver?.verified&&r.feeWaiver.rate!==null&&r.feeWaiver.minimumSpend!==null&&r.feeWaiver.minimumSpend<=r.minimumSpend?r.feeWaiver:null;
  // A capped headline rate is not the maximum at the required spend tier.
  // Such products need a complete allocation scenario, including fallback rewards.
  if(r.minimumSpend>0&&cap!==null&&cap<r.minimumSpend*earning/100)continue;
  // No spend requirement but a small monthly cap: "10% (월 3천원)" is not a card
  // maximum. Value it at a typical month's spending instead.
  if(r.minimumSpend===0&&cap!==null&&cap/rate<REFERENCE_SPEND){
   const result=rewardAtSpend(r,REFERENCE_SPEND);if(!result)continue;
   legacy.push({value:result.percentage,scenario:{label:r.label,monthlySpend:REFERENCE_SPEND,monthlyBenefit:result.benefit,annualFee:0,verified:true,maximumVerified:true,calculation:'tier-cap',basis:'minimum-tier',minimumEligibleSpend:0,totalSpend:REFERENCE_SPEND,benefitScope:r.label,sourceUrl:r.sourceUrl,assumptions:[`전월실적 조건은 없지만 월 한도(${wonText(cap)})가 작아서, 한 달 ${wonText(REFERENCE_SPEND)} 결제 기준으로 계산했어요.`,r.note],components:[{label:'적립·할인',amount:result.benefit,cap:wonText(cap)}]}});
   continue;
  }
  const value=earning+(waiver?.rate??0);
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
 if(!o.startsAt&&o.startsAtLabel==='수신일'&&o.endsAt)return '수신 대상';if(!o.endsAt&&o.status==='active')return '진행 중';if(!o.startsAt||!o.endsAt)return '기간 확인 필요';return '진행 중';
}
export function activeOffer(o:Offer,today?:string){return offerStatus(o,today)==='진행 중';}
export function currentMonthOffer(o:Offer,today=new Date(Date.now()+9*3600000).toISOString().slice(0,10)){return (o.status==='active'||o.status==='upcoming')&&(!!o.startsAt||o.startsAtLabel==='수신일')&&(o.endsAt?o.endsAt>=today:o.status==='active')&&(!o.startsAt||o.startsAt<=today.slice(0,7)+'-31');}
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

