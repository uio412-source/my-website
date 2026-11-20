import './ensure-card-data.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
import {pickingOptions,bestPicking,pickingRange,summarize} from '../lib/catalog-model.ts';
import {paymentEligibility,cardThemes} from '../lib/card-themes.ts';
const cards=JSON.parse(fs.readFileSync('data/cards.json'));
const get=id=>cards.find(c=>c.id===id);
for(const id of ['samsung-aap1452','samsung-aap1453']){assert.equal(pickingRange(get(id)).label,'2~4%');assert.equal(bestPicking(get(id)).value,4);}
assert(Math.abs(pickingRange(get('woori-103187')).min-1.3)<1e-10);assert.equal(bestPicking(get('woori-103187')).value,5);
assert(Math.abs(bestPicking(get('woori-103188')).value-3)<1e-10);
const nh=get('nh-90010544');for(const t of ['국세','지방세','관리비']){assert.equal(paymentEligibility(nh,t).benefit,'allowed');assert.equal(paymentEligibility(nh,t).spend,'allowed');assert(cardThemes(nh).includes(t));}assert.equal(paymentEligibility(nh,'상품권 가능').spend,'excluded');
assert.equal(bestPicking(nh).value,5.25);assert.equal(bestPicking(nh).scenario.minimumEligibleSpend,1000001);
// A tier-table's spend threshold must never be mistaken for its reward cap.
assert.equal(get('samsung-aap1666').rewardRates.find(r=>r.rewardUnits===50).monthlyCapValue,5000);
assert(!pickingOptions(get('samsung-aap1666')).some(o=>o.value===50));
assert.equal(bestPicking(get('samsung-aap1666')),null,'An incomplete capped allocation must not be advertised as a card maximum');
const c=get('woori-103187');assert.equal(bestPicking({...c,annualFeeMin:99999999,benefits:[...c.benefits,{kind:'voucher',title:'QA',detail:'',category:'gift',rate:'100%',minimumSpend:0,cap:null}]}).value,5);
assert.equal(bestPicking({...c,rewardRates:c.rewardRates.map(r=>({...r,unitValue:r.unitValue*2}))}).value,5);
assert.equal(bestPicking({...c,rewardRates:[],pickingScenarios:[]}),null);
assert.equal(bestPicking(get('shinhan-202406130001')).value,2);assert.equal(bestPicking(get('woori-102722')).value,3.4);
const every=get('woori-102488');assert(Math.abs(bestPicking(every).value-5.3)<1e-10);assert.equal(pickingRange(every).label,'2~5.3%');
for(const t of ['상품권 가능','관리비','국세','지방세']){assert.equal(paymentEligibility(every,t).benefit,'excluded');assert.equal(paymentEligibility(every,t).spend,'excluded');assert(!cardThemes(every).includes(t));}
assert(Math.abs(bestPicking({...every,rewardRates:every.rewardRates.map(r=>({...r,unitValue:25}))}).value-5.3)<1e-10);
assert.equal(bestPicking({...every,feeWaivers:[{...every.feeWaivers[0],verified:false}]}),null);
for(const card of cards)assert.equal(bestPicking(summarize(card))?.value??null,bestPicking(card)?.value??null,'Summary and detail must show the same maximum: '+card.id);
const noWaiver={...every,rewardRates:every.rewardRates.map(r=>({...r,feeWaiver:r.feeWaiver?{...r.feeWaiver,verified:false}:undefined}))};assert.equal(bestPicking(noWaiver),null,'An unresolved same-purchase fee must not produce an understated highest rate');
assert.equal(pickingOptions(every).find(x=>x.scenario.label==='국내 기본 적립').value,2,'Foreign fee waiver must not apply to domestic earnings');
assert(every.rewardRates[1].note.includes('100만원')&&every.rewardRates[1].note.includes('본인+가족'));
console.log(JSON.stringify({status:'passed',samsungRange:'2~4%',allInfiniteRange:'1.3~5%',nhTax:true,capBoundaries:true,valuationRecalculation:true}));
