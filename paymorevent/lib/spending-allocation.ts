export type AllocationRule={id:string;label:string;ratePercent:number;monthlyCap:number|null;groupIds:string[];sourceUrl:string;note:string;transactionCap?:number|null;splitTransactionsVerified?:boolean;
 /** 이 영역 결제는 전월실적에서 빠짐: 예산(전월실적) 밖에서 따로 써야 함 */ spendExcluded?:boolean;
 /** 한 달에 현실적으로 쓸 수 있는 최대 금액 (구독료 등) */ maxSpend?:number};
export type AllocationPlan={label:string;minimumSpend:number;budget:number;verified:boolean;exclusiveStreamsVerified:boolean;groups:{id:string;cap:number}[];rules:AllocationRule[];sourceUrl:string;notes:string[]};
/** Verified, mutually exclusive spending streams. Nested group caps are allowed;
 * crossing caps, missing limits and transaction/count constraints stay unresolved.
 * Rules whose spend does not count toward the prior-month requirement are spent
 * on top of the budget, so the rate is benefit / (budget + that extra spend). */
export function allocateSpending(plan:AllocationPlan){
 if(!plan.verified||!plan.exclusiveStreamsVerified||!Number.isFinite(plan.budget)||plan.budget<=0||plan.minimumSpend<=0||!plan.rules.length)return null;
 if(plan.groups.some(g=>!Number.isFinite(g.cap)||g.cap<0)||plan.rules.some(r=>!Number.isFinite(r.ratePercent)||r.ratePercent<0||r.ratePercent>100||r.monthlyCap!==null&&(!Number.isFinite(r.monthlyCap)||r.monthlyCap<0)||r.groupIds.some(id=>!plan.groups.some(g=>g.id===id))))return null;
 if(new Set(plan.rules.map(r=>r.id)).size!==plan.rules.length||new Set(plan.groups.map(g=>g.id)).size!==plan.groups.length)return null;
 if(plan.rules.some(r=>r.transactionCap!==undefined&&r.transactionCap!==null&&(!r.splitTransactionsVerified||r.transactionCap<=0||!Number.isFinite(r.transactionCap))))return null;
 const sets=plan.groups.map(g=>new Set(plan.rules.filter(r=>r.groupIds.includes(g.id)).map(r=>r.id)));
 for(let i=0;i<sets.length;i++)for(let j=i+1;j<sets.length;j++){const a=sets[i],b=sets[j],overlap=[...a].some(x=>b.has(x));if(overlap&&![...a].every(x=>b.has(x))&&![...b].every(x=>a.has(x)))return null;}
 const caps=new Map(plan.groups.map(g=>[g.id,g.cap]));let remaining=plan.budget,extraSpend=0;const allocations=[];
 for(const r of [...plan.rules].sort((a,b)=>b.ratePercent-a.ratePercent||a.id.localeCompare(b.id))){
  if(!r.ratePercent)continue;
  const rate=r.ratePercent/100;const cap=Math.min(r.monthlyCap??Infinity,...r.groupIds.map(id=>caps.get(id)!));
  // Excluded spend needs a finite ceiling; otherwise it stays inside the budget.
  const outside=!!r.spendExcluded&&Number.isFinite(Math.min(cap/rate,r.maxSpend??Infinity));
  if(!outside&&remaining<=0)continue;
  const spend=Math.min(outside?Infinity:remaining,cap/rate,r.maxSpend??Infinity);const benefit=spend*rate;if(spend<=0)continue;
  if(outside)extraSpend+=spend;else remaining-=spend;
  for(const id of r.groupIds)caps.set(id,caps.get(id)!-benefit);
  allocations.push({label:r.label,spend,benefit,rate:r.ratePercent,cap:r.monthlyCap,outside});
 }
 const benefit=allocations.reduce((n,r)=>n+r.benefit,0);const total=plan.budget+extraSpend;
 return {budget:plan.budget,benefit,percentage:benefit/total*100,remaining,extraSpend,totalSpend:total,allocations};
}
