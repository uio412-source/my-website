import type {RewardRate} from './catalog-types';

/** Currency value on one eligible spending stream. Rates are alternatives;
 * never sum different merchants, tiers, vouchers or annual rewards here. */
export function rewardAtSpend(r:RewardRate,spend:number){
 if(!r.verified||!Number.isFinite(spend)||spend<=0||r.spendUnit<=0||r.unitValue<=0)return null;
 const rate=r.rewardUnits*r.unitValue/r.spendUnit;
 const fallback=(r.fallbackRewardUnits??0)*r.unitValue/r.spendUnit;
 const additional=spend*Math.max(0,rate-fallback);
 const additionalCap=r.additionalMonthlyCapUnits!==undefined?r.additionalMonthlyCapUnits*r.unitValue:r.additionalMonthlyCapValue??Infinity;
 let earning=spend*fallback+Math.min(additional,additionalCap);
 // A cap on the TOTAL special-rate points is different from a cap on just
 // the bonus points. E.g. ALL's 4,000 special points -> basic after that.
 if(r.specialRewardCapUnits!==undefined&&r.rewardUnits>0){
  const eligible=Math.min(spend,r.specialRewardCapUnits/r.rewardUnits*r.spendUnit);
  earning=eligible*rate+(spend-eligible)*fallback;
 }
 const totalCap=r.monthlyCapUnits!==undefined?r.monthlyCapUnits*r.unitValue:r.monthlyCapValue;
 if(totalCap!==null)earning=Math.min(earning,totalCap);
 const f=r.feeWaiver;
 const feeRate=f?.verified&&f.rate!==null&&f.minimumSpend!==null&&f.minimumSpend<=r.minimumSpend?f.rate/100:0;
 earning=Number(earning.toPrecision(14));
 const fee=Number((spend*feeRate).toPrecision(14)),benefit=Number((earning+fee).toPrecision(14));
 return {spend,earning,fee,benefit,percentage:Number((benefit/spend*100).toPrecision(14))};
}
