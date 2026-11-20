import {applyRewardValuations} from './reward-valuation';
import type {Card,RewardRate} from './catalog-types';
import {pickingOptions,formatPicking} from './catalog-model';
export function spendCondition(minimum:number|null|undefined,scope?:string,inclusive=true){
 if(minimum===null||minimum===undefined)return '미확인';
 if(minimum===0)return '무실적';
 // Exclusive limits are stored as the first eligible whole-won amount.
 const boundary=inclusive?minimum:minimum-1;
 const amount=boundary%10000===0?`${(boundary/10000).toLocaleString('ko-KR')}만원`:`${boundary.toLocaleString('ko-KR')}원`;
 return `${scope?scope+' ':''}${amount} ${inclusive?'이상':'초과'}`;
}
function capText(r:RewardRate){
 const parts:string[]=[];
 if(r.monthlyCapUnits!==undefined)parts.push(`월 ${r.monthlyCapUnits.toLocaleString('ko-KR')} ${r.rewardUnit}`);
 else if(r.monthlyCapValue!==null)parts.push(`월 ${r.monthlyCapValue.toLocaleString('ko-KR')}원 상당`);
 if(r.additionalMonthlyCapUnits!==undefined)parts.push(`추가 월 ${r.additionalMonthlyCapUnits.toLocaleString('ko-KR')} ${r.rewardUnit}`);
 else if(r.additionalMonthlyCapValue!==undefined)parts.push(`추가 월 ${r.additionalMonthlyCapValue.toLocaleString('ko-KR')}원 상당`);
 if(r.specialRewardCapUnits!==undefined)parts.push(`특별 월 ${r.specialRewardCapUnits.toLocaleString('ko-KR')} ${r.rewardUnit}`);
 if(r.yearlyCapUnits!==undefined)parts.push(`연 ${r.yearlyCapUnits.toLocaleString('ko-KR')} ${r.rewardUnit}`);
 if(r.sharedCapGroup)parts.unshift(r.sharedCapGroup);
 return parts.join(' · ')||'한도 없음';
}
export function pickingRows(card:Card){
 card=applyRewardValuations(card);
 return pickingOptions(card).map(o=>{
  const s=o.scenario,r=card.rewardRates?.find(r=>r.verified&&r.label===s.label&&r.minimumSpend===s.minimumEligibleSpend);
  let fee:number|null=null,earning:number|null=null;
  if(r){
   const waiver=r.feeWaiver;
   fee=waiver?.verified&&waiver.rate!==null&&waiver.minimumSpend!==null&&waiver.minimumSpend<=r.minimumSpend?waiver.rate:0;
   earning=o.value-fee;
  }else if(s.monthlySpend&&s.components?.length){
   const amounts=s.components.reduce((a,c)=>{if(c.label==='동일 거래 수수료 면제')a.fee+=c.amount;else a.earning+=c.amount;return a;},{fee:0,earning:0});
   if(Math.abs((amounts.fee+amounts.earning)/s.monthlySpend*100-o.value)<1e-8){fee=amounts.fee/s.monthlySpend*100;earning=amounts.earning/s.monthlySpend*100;}
  }
  return {label:s.label,earning:earning===null?'구성 확인 중':`${formatPicking(earning)}%`,fee:fee===null?'구성 확인 중':fee===0?'—':`${formatPicking(fee)}%`,total:`${formatPicking(o.value)}%`,condition:[spendCondition(s.minimumEligibleSpend,r?.minimumSpendScope,r?.minimumSpendInclusive??true),r?.maximumSpendExclusive?`${(r.maximumSpendExclusive/10000).toLocaleString('ko-KR')}만원 미만`:null,r?.eligibilityRequirement].filter(Boolean).join(' · '),cap:r?capText(r):'계산 근거 참조',scenario:s};
 });
}
