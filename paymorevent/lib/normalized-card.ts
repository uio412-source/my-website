import {applyRewardValuations} from './reward-valuation';
import type {Card} from './catalog-types';
import {bestPicking} from './catalog-model';

export type ReviewStage='source_needed'|'rules_needed'|'calculation_needed'|'validation_needed'|'complete';
export type EvidenceState='verified'|'candidate'|'unknown'|'not_applicable';
export type TypedValue={state:EvidenceState;value:number|null;unit:string;sourceUrl:string;note:string};
export type NormalizedRow={id:string;cardId:string;serviceId?:string|null;status:string;[key:string]:unknown};
export const ENTITY_KINDS=['products','services','networkServices','constraints','tiers','models','paymentRules','documents','sourceTables'] as const;
export type EntityKind=typeof ENTITY_KINDS[number];
export type NormalizedBundle={schemaVersion:4;cardId:string;entities:Record<EntityKind,NormalizedRow[]>;review:CardReview};
export type CardReview={cardId:string;issuer:string;name:string;stage:ReviewStage;missing:string[];qualityScore:number;checks:Record<string,boolean>;serviceCount:number;modelCount:number;pickingRate:number|null;updatedAt:string;attempts?:number;nextAttemptAt?:string;lastError?:string|null};
const clean=(s:string)=>s.replace(/\s+/g,' ').trim();
export function typedMoney(text:string|null,sourceUrl:string,verified=false):TypedValue{
 const m=text?.replace(/[,\s]/g,'').match(/^(\d+(?:\.\d+)?)(만|천)?(?:원|포인트|점|P)$/i);
 return {state:m?(verified?'verified':'candidate'):'unknown',value:m?Number(m[1])*({만:10000,천:1000}[m[2] as '만'|'천']??1):null,unit:m&&/포인트|점|P/i.test(text!)?'point':'KRW',sourceUrl,note:text??'원문 확인 필요'};
}
export function reviewCard(c:Card,services?:NormalizedRow[]):CardReview{
 const monetary=c.benefits.filter(b=>b.kind!=='voucher'&&/적립|할인|캐시백/.test(b.title+' '+b.detail)&&! /무이자|대출|수수료|라운지|놀이공원/.test(b.title));
 const source=!!c.documents?.some(d=>d.identityStatus==='matched'&&d.kind!=='brand'&&d.readStatus==='read');
 const minimum=monetary.length>0&&monetary.every(b=>b.minimumSpend!==null&&(b.minimumSpendVerified||c.rewardModelComplete));
 const checks={source,benefits:c.benefits.length>0,thresholds:minimum,models:!!c.rewardModelComplete&&!c.rewardCoveragePending,caps:!!c.rewardModelComplete,exclusions:c.benefitExclusions.length>0||c.normalizationExceptions?.includes('no_benefit_exclusions')===true,spendExclusions:c.spendExclusions.length>0||c.normalizationExceptions?.includes('no_spend_requirement')===true,fees:!(c.feeWaivers?.some(f=>!f.verified)),paymentRules:['상품권 가능','국세','지방세','관리비'].every(t=>{const e=c.paymentEligibility?.[t];return !!e&&e.benefit!=='unknown'&&(e.spend!=='unknown'||c.normalizationExceptions?.includes('no_spend_requirement'));}),calculation:!!bestPicking(c),validation:!!c.calculationValidation?.passed&&c.calculationValidation.evidence.length>0};
 const labels:Record<string,string>={source:'상품 일치 공식 원문',benefits:'혜택 본문',thresholds:'혜택별 전월실적',models:'전체 금전 혜택 모델',caps:'영역·공유·건당·횟수 한도',exclusions:'혜택 제외조건',spendExclusions:'실적 제외조건',fees:'수수료 면제 조건',paymentRules:'상품권·세금·관리비 구분',calculation:'소비 배분·피킹률 계산',validation:'경계값·중복·요약 검증'};
 const missing=Object.entries(checks).filter(([,v])=>!v).map(([k])=>labels[k]);
 const stage:ReviewStage=!source?'source_needed':!checks.benefits||!checks.thresholds||!checks.models||!checks.caps||!checks.exclusions||!checks.spendExclusions||!checks.paymentRules||!checks.fees?'rules_needed':!checks.calculation?'calculation_needed':!checks.validation?'validation_needed':'complete';
 return {cardId:c.id,issuer:c.issuer,name:c.name,stage,missing,qualityScore:Math.round(Object.values(checks).filter(Boolean).length/Object.keys(checks).length*100),checks,serviceCount:services?.length??c.benefits.length,modelCount:(c.rewardRates?.length??0)+(c.spendingPlans??[]).reduce((n,p)=>n+p.rules.length,0),pickingRate:bestPicking(c)?.value??null,updatedAt:new Date().toISOString()};
}
export function normalizeBundle(c:Card,prior?:Partial<Record<EntityKind,NormalizedRow[]>>):NormalizedBundle{
 c=applyRewardValuations(c);
 const ids=new Map<string,number>();
 const services:NormalizedRow[]=c.benefits.map((b,i)=>{
  const signature=clean(b.title)+'|'+b.category;const ordinal=ids.get(signature)??0;ids.set(signature,ordinal+1);
  const old=prior?.services?.filter(s=>s.title===b.title&&s.category===b.category)[ordinal];
  const id=String(old?.id??old?.serviceId??`${c.id}:service:${i}`),sourceUrl=b.sourceUrl??c.sourceUrl;
  const rate=(c.rewardRates??[]).find(r=>(r.serviceTitle??r.label)===b.title&&r.verified);
  const verified=!!rate&&(!!c.rewardModelComplete||b.minimumSpendVerified===true);
  return {...old,id,cardId:c.id,serviceId:id,status:verified?'verified':old?.sourceMatch?'candidate':'unknown',title:b.title,category:b.category,kind:b.kind??'benefit',sourceUrl,detail:b.detail,rateText:b.rate,capText:b.cap,
   minimumSpend:{state:(verified||b.minimumSpendVerified)?'verified':b.minimumSpend!==null?'candidate':'unknown',value:(verified||b.minimumSpendVerified)?b.minimumSpend:null,candidate:b.minimumSpend,unit:'KRW',sourceUrl},
   earning:rate?{state:'verified',spendUnit:rate.spendUnit,rewardUnits:rate.rewardUnits,rewardUnit:rate.rewardUnit,unitValue:rate.unitValue,valuationBasis:rate.rewardUnit==='원'?'currency':'assumption',sourceUrl:rate.sourceUrl}:{state:'unknown',spendUnit:null,rewardUnits:null,rewardUnit:null,unitValue:null},
   monthlyCap:rate?{state:'verified',mode:rate.monthlyCapValue===null?'unlimited':'limited',amount:rate.monthlyCapValue,unit:'KRW',additionalAmount:rate.additionalMonthlyCapValue??null,additionalUnits:rate.additionalMonthlyCapUnits??null,specialUnits:rate.specialRewardCapUnits??null,fallbackUnits:rate.fallbackRewardUnits??null,sourceUrl:rate.sourceUrl}: {state:'unknown',mode:'unknown',amount:null,unit:'KRW',sourceUrl},
   spendExclusions:b.spendExclusions??[],benefitExclusions:b.benefitExclusions??[]};
 });
 const rows=(kind:EntityKind)=>{const seen=new Map<string,number>();return (prior?.[kind]??[]).filter(r=>!(kind==='constraints'&&String(r.id).startsWith(c.id+':exclusion:'))&&!(kind==='tiers'&&String(r.id).startsWith(c.id+':plan:'))).map((r,i)=>{const rawId=String(r.id??r[kind==='tiers'?'tierId':kind==='constraints'?'constraintId':kind==='paymentRules'?'ruleId':kind==='documents'?'documentId':kind==='sourceTables'?'tableId':'modelId']??`${c.id}:${kind}:${i}`);const n=seen.get(rawId)??0;seen.set(rawId,n+1);return {...r,id:n?rawId+':occ:'+n:rawId,cardId:c.id,status:String(r.status??'candidate')};});};
 const documentAliases=new Map<string,string>();for(const [i,d] of (c.documents??[]).entries()){const old=prior?.documents?.find(v=>v.url===d.url);if(old)documentAliases.set(String(old.documentId??old.id),`${c.id}:doc:${i}`);}
 const entities:Record<EntityKind,NormalizedRow[]>={products:[{id:c.id,cardId:c.id,status:'registered',issuer:c.issuer,name:c.name,type:c.type,brands:c.brands,annualFee:c.annualFeeMin,annualFeeText:c.annualFeeText,sourceUrl:c.sourceUrl,termsUrl:c.termsUrl,issuanceStatus:c.issuanceStatus}],services,networkServices:(c.networkServices??[]).map(s=>({...s,cardId:c.id,status:s.verified?'verified':'candidate'})),constraints:rows('constraints'),tiers:rows('tiers'),models:(c.rewardRates??[]).map((r,i)=>({id:`${c.id}:model:${i}`,cardId:c.id,serviceId:services.find(s=>s.title===(r.serviceTitle??r.label))?.id??null,status:r.verified?'verified':'candidate',...r})),paymentRules:rows('paymentRules'),documents:(c.documents??[]).map((d,i)=>({id:`${c.id}:doc:${i}`,cardId:c.id,status:d.readStatus,...d})),sourceTables:rows('sourceTables')};
 for(const [p,plan] of (c.spendingPlans??[]).entries())for(const [i,rule] of plan.rules.entries()){
  const service=services.find(s=>String(s.title).includes(rule.label));const verified=plan.verified&&plan.exclusiveStreamsVerified;const id=`${c.id}:plan:${p}:rule:${i}`;
  entities.models.push({...rule,id,cardId:c.id,serviceId:service?.id??null,status:verified?'verified':'candidate',type:'allocation',minimumSpend:plan.minimumSpend,budget:plan.budget,groups:plan.groups});
  entities.tiers.push({id:id+':tier',cardId:c.id,serviceId:service?.id??null,status:verified?'verified':'candidate',minimumSpend:plan.minimumSpend,minimumInclusive:true,ratePercent:rule.ratePercent,monthlyCap:rule.monthlyCap,transactionCap:rule.transactionCap??null,groupIds:rule.groupIds,sourceUrl:rule.sourceUrl,quote:rule.note});
  if(service&&p===0){service.earning={state:verified?'verified':'candidate',spendUnit:100,rewardUnits:rule.ratePercent,rewardUnit:'원',unitValue:1,valuationBasis:'currency',sourceUrl:rule.sourceUrl};service.monthlyCap={state:verified?'verified':'candidate',mode:rule.monthlyCap===null?'unlimited':'limited',amount:rule.monthlyCap,unit:'KRW',transactionCap:rule.transactionCap??null,sharedGroups:plan.groups.filter(g=>rule.groupIds.includes(g.id)),sourceUrl:rule.sourceUrl};}
 }
 for(const kind of ENTITY_KINDS)for(const row of entities[kind]){if(row.documentId&&documentAliases.has(String(row.documentId)))row.documentId=documentAliases.get(String(row.documentId));}
 // Common exclusions remain scoped records instead of being copied into every benefit.
 for(const [scope,list] of [['spend',c.spendExclusions],['benefit',c.benefitExclusions]] as const)for(const [i,quote] of list.entries())entities.constraints.push({id:`${c.id}:exclusion:${scope}:${i}`,cardId:c.id,serviceId:null,status:'candidate',field:scope+'Exclusions',scope:'상품 공통',quote,sourceUrl:c.sourceUrl});
 // Refresh representative judgments whenever a reviewed card changes. Prior
 // scoped rules (annual status, lounge, specific benefits) remain independent.
 // Reusing all prior rows left an old summary judgment in the normalized DB
 // after the card's paymentEligibility had already been updated.
 if(c.paymentEligibility){
  entities.paymentRules=entities.paymentRules.filter(r=>r.scope!=='검색 대표 판정'&&r.representation!=='summary'&&!String(r.id).startsWith(c.id+':payment:'));
  entities.paymentRules.push(...Object.entries(c.paymentEligibility).map(([item,e])=>({
   ...e,id:`${c.id}:payment:aggregate:${encodeURIComponent(item)}`,cardId:c.id,item,
   representation:'summary',scope:e.scope??'검색 대표 판정',
   status:e.benefit==='unknown'?'unknown':e.checkedAt&&e.evidence&&e.basis==='explicit'?'verified':'candidate',
  })));
 }
 return {schemaVersion:4,cardId:c.id,entities,review:reviewCard(c,services)};
}
