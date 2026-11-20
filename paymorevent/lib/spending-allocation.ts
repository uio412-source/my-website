export type AllocationRule={id:string;label:string;ratePercent:number;monthlyCap:number|null;groupIds:string[];sourceUrl:string;note:string;transactionCap?:number|null;splitTransactionsVerified?:boolean};
export type AllocationPlan={label:string;minimumSpend:number;budget:number;verified:boolean;exclusiveStreamsVerified:boolean;groups:{id:string;cap:number}[];rules:AllocationRule[];sourceUrl:string;notes:string[]};
/** Verified, mutually exclusive spending streams. Nested group caps are allowed;
 * crossing caps, missing limits and transaction/count constraints stay unresolved. */
export function allocateSpending(plan:AllocationPlan){
 if(!plan.verified||!plan.exclusiveStreamsVerified||!Number.isFinite(plan.budget)||plan.budget<=0||plan.minimumSpend<=0||!plan.rules.length)return null;
 if(plan.groups.some(g=>!Number.isFinite(g.cap)||g.cap<0)||plan.rules.some(r=>!Number.isFinite(r.ratePercent)||r.ratePercent<0||r.ratePercent>100||r.monthlyCap!==null&&(!Number.isFinite(r.monthlyCap)||r.monthlyCap<0)||r.groupIds.some(id=>!plan.groups.some(g=>g.id===id))))return null;
 if(new Set(plan.rules.map(r=>r.id)).size!==plan.rules.length||new Set(plan.groups.map(g=>g.id)).size!==plan.groups.length)return null;
 if(plan.rules.some(r=>r.transactionCap!==undefined&&r.transactionCap!==null&&(!r.splitTransactionsVerified||r.transactionCap<=0||!Number.isFinite(r.transactionCap))))return null;
 const sets=plan.groups.map(g=>new Set(plan.rules.filter(r=>r.groupIds.includes(g.id)).map(r=>r.id)));
 for(let i=0;i<sets.length;i++)for(let j=i+1;j<sets.length;j++){const a=sets[i],b=sets[j],overlap=[...a].some(x=>b.has(x));if(overlap&&![...a].every(x=>b.has(x))&&![...b].every(x=>a.has(x)))return null;}
 const caps=new Map(plan.groups.map(g=>[g.id,g.cap]));let remaining=plan.budget;const allocations=[];
 for(const r of [...plan.rules].sort((a,b)=>b.ratePercent-a.ratePercent||a.id.localeCompare(b.id))){if(!r.ratePercent||remaining<=0)continue;const rate=r.ratePercent/100;const cap=Math.min(r.monthlyCap??Infinity,...r.groupIds.map(id=>caps.get(id)!));const spend=Math.min(remaining,cap/rate);const benefit=spend*rate;if(spend<=0)continue;remaining-=spend;for(const id of r.groupIds)caps.set(id,caps.get(id)!-benefit);allocations.push({label:r.label,spend,benefit,rate:r.ratePercent,cap:r.monthlyCap});}
 const benefit=allocations.reduce((n,r)=>n+r.benefit,0);return {budget:plan.budget,benefit,percentage:benefit/plan.budget*100,remaining,allocations};
}
