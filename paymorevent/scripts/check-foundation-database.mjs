import fs from 'node:fs';import assert from 'node:assert/strict';import {gunzipSync} from 'node:zlib';
import {rewardAtSpend} from '../lib/reward-calculation.ts';
import {bestPicking,pickingOptions,summarize} from '../lib/catalog-model.ts';
import {cardSchema} from '../lib/catalog-validation.ts';
const cards=JSON.parse(fs.readFileSync('data/cards.json'));
const db=JSON.parse(gunzipSync(fs.readFileSync('data/card-foundation.json.gz')));
assert.equal(db.products.length,cards.length);assert.equal(db.services.length,cards.reduce((n,c)=>n+c.benefits.length,0));
const cardIds=new Set(cards.map(c=>c.id)),serviceIds=new Set(db.services.map(s=>s.serviceId)),documentIds=new Set(db.documents.map(d=>d.documentId));
assert.equal(serviceIds.size,db.services.length);
for(const c of cards)cardSchema.parse(c);
for(const s of db.services){assert(cardIds.has(s.cardId));if(s.documentId)assert(documentIds.has(s.documentId));if(s.minimumSpendStatus!=='대조')assert.equal(s.minimumSpend,null,'Unreviewed thresholds are not calculation inputs');}
for(const r of db.constraints){assert(cardIds.has(r.cardId));assert(serviceIds.has(r.serviceId));assert(r.quote.length>0);}
for(const r of db.models){assert(cardIds.has(r.cardId));if(r.serviceId)assert(serviceIds.has(r.serviceId));}
for(const r of db.tiers){assert(cardIds.has(r.cardId));assert(r.minimumSpend>=0);if(r.serviceId)assert(serviceIds.has(r.serviceId));}
const onOff=db.tiers.filter(r=>r.cardId==='bc-102040'&&r.minimumSpend===300000&&r.field.includes('월 통합'));assert(onOff.some(r=>r.capAmount===10000&&r.capUnit==='원'),'Keep a 300k threshold separate from the 10k monthly cap');
const zone=db.tiers.filter(r=>r.cardId==='bc-104520'&&r.minimumSpend===600000);assert(zone.some(r=>r.capAmount===10000),'Horizontal cap table must preserve the threshold column');
const refresh=JSON.parse(gunzipSync(fs.readFileSync('data/source-refresh-audit.json.gz')));const urls=new Set(refresh.records.map(r=>r.url));for(const c of cards){assert(urls.has(c.sourceUrl));if(c.termsUrl)assert(urls.has(c.termsUrl));}
const c=cards.find(c=>c.id==='woori-102033');assert.equal(bestPicking(c).value,2.3);assert.equal(bestPicking(summarize(c)).value,2.3);assert.equal(c.minimumSpend,0);
const tiers=pickingOptions(c);const lo=tiers.find(o=>o.scenario.minimumEligibleSpend===1000000),hi=tiers.find(o=>o.scenario.minimumEligibleSpend===3000000);assert.equal(lo.value,1.8);assert.equal(lo.scenario.monthlyBenefit,18000);assert.equal(hi.value,2.3);assert.equal(hi.scenario.monthlyBenefit,69000);
const r=c.rewardRates.find(r=>r.minimumSpend===3000000);
assert.equal(rewardAtSpend(r,10000000).benefit,180000,'Only the additional 1% reaches the 50k cap; basic 1.3% continues');
const every=cards.find(c=>c.id==='woori-102488').rewardRates.find(r=>r.rewardUnits===2);assert.equal(rewardAtSpend(every,2000000).benefit,86000,'Extra miles are capped; basic miles and fee waiver continue');
const mile=cards.find(c=>c.id==='samsung-aap1452').rewardRates.find(r=>r.rewardUnits===2);assert.equal(rewardAtSpend(mile,3000000).benefit,100000);
const all=cards.find(c=>c.id==='woori-103187').rewardRates.find(r=>r.rewardUnits===5);assert.equal(rewardAtSpend(all,3000000).benefit,127800,'ALL total special-points cap, then basic points on remaining spend');assert.equal(rewardAtSpend({...all,unitValue:66},3000000).benefit,281160,'Point cap is a quantity; valuation changes the monetary cap');
const standard={...r,minimumSpend:1000000,fallbackRewardUnits:0,additionalMonthlyCapValue:undefined,monthlyCapValue:null};assert.equal(rewardAtSpend(standard,1000000).benefit,23000);assert.equal(bestPicking({...c,pickingScenarios:[],rewardRates:[standard]}).value,2.3,'A valid positive threshold must not be dropped just because there is no zero tier');
assert.equal(bestPicking({...c,pickingScenarios:[],rewardRates:[{...standard,monthlyCapValue:20000}]}).value,2,'Achievable benefit at threshold, not capless headline');
const partlyModeled=cards.filter(c=>c.rewardCoveragePending&&!c.pickingScenarios?.some(s=>s.verified&&s.maximumVerified));for(const c of partlyModeled)assert.equal(bestPicking(c),null,'Do not advertise partial basic earning as card maximum: '+c.id);
assert(db.paymentRules.some(r=>r.item==='선불·기프트 충전'));assert(db.paymentRules.some(r=>r.item==='상품권 구매'));
console.log(JSON.stringify({status:'passed',cards:cards.length,services:db.services.length,clauses:db.constraints.length,models:db.models.length,sourceTableRows:db.sourceTables.length,diners:{tier1000000:1.8,tier3000000:2.3},thresholdAndCap:true,referentialIntegrity:true}));
