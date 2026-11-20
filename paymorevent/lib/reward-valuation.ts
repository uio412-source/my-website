import policy from '../data/reward-valuations.json' with {type:'json'};
import type {Card,RewardRate} from './catalog-types';
export const REWARD_VALUATIONS=policy;
/** Currency is explicit; hotel names never multiply cash discounts. Unknown
 * noncash hotel points retain their own value instead of becoming cash points. */
export function rewardProgram(unit:string,context=''){
 const u=unit.trim();
 // Only generic unit names need product context. An explicit Marriott or
 // SKYPASS unit must keep its programme even on a card offering other points.
 const t=/^(포인트|points?|점|마일(?:리지)?|miles?)$/i.test(u)?u+' '+context:u;
 if(/^(원|KRW|현금|캐시백)$/i.test(u))return 'cash';
 if(/현금성\s*포인트|NH\s*(?:포인트|머니)|마이신한포인트|우리WON꿀머니|페이북\s*머니|IBK\s*포인트|트래블포인트|TOP\s*포인트|하나머니|KB\s*포인트리|포인트리|L\.POINT|엘포인트|OK캐쉬백|GS.*포인트/i.test(u))return 'cash';
 if(/유니마일|UNI[ -]?MILE/i.test(t))return 'unimile';
 if(/대한항공|스카이패스|SKYPASS/i.test(t)&&/마일|mile|포인트/i.test(u))return 'skypass';
 if(/힐튼|Hilton|Honors/i.test(t)&&/포인트|point|점/i.test(u))return 'hilton';
 if(/매리어트|메리어트|Marriott|Bonvoy|본보이/i.test(t)&&/포인트|point|점/i.test(u))return 'marriott';
 if(/아코르|Accor|ALL\s*(?:리워드|Reward|우리)/i.test(t)&&/포인트|point|점/i.test(u))return 'accor';
 if(/마일|mile|크리스플라이어|KrisFlyer/i.test(u))return 'other-airline';
 return null;
}
export function rewardValuation(unit:string,context=''){const id=rewardProgram(unit,context);return policy.programs.find(p=>p.id===id)??null;}
export function applyRewardValue<T extends RewardRate>(r:T,context=''):T{
 const p=rewardValuation(r.rewardUnit,context+' '+r.label);if(!p)return r;
 return {...r,unitValue:p.value,...(r.monthlyCapUnits!==undefined?{monthlyCapValue:r.monthlyCapUnits*p.value}:{}),...(r.additionalMonthlyCapUnits!==undefined?{additionalMonthlyCapValue:r.additionalMonthlyCapUnits*p.value}:{})};
}
export function applyRewardValuations(c:Card):Card{return {...c,rewardRates:c.rewardRates?.map(r=>applyRewardValue(r,c.name))};}
