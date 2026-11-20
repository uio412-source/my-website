import './ensure-card-data.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {conflictingEventPeriod} from '../lib/event-period.ts';
import {activeOffer,rewardValue,visibleOffer,isAnnualFeeOffer,groupCards,linkedOffers,eventCategory,EVENT_CATEGORIES,requiresEntry} from '../lib/catalog-model.ts';
const cards=JSON.parse(fs.readFileSync('data/cards.json','utf8')),events=JSON.parse(fs.readFileSync('data/events.json','utf8'));
const base={...events.find(e=>e.id==='kb-everland-panda-oct-2026'),startsAt:'2026-10-01',endsAt:'2026-10-31'};
assert.equal(activeOffer(base,'2026-09-30'),false);assert.equal(activeOffer(base,'2026-10-01'),true);assert.equal(activeOffer(base,'2026-10-31'),true);assert.equal(activeOffer(base,'2026-11-01'),false);assert.equal(activeOffer({...base,startsAt:null},'2026-10-06'),false);assert.equal(activeOffer({...base,status:'needs_review'},'2026-10-06'),false);
const reward=(kind,amount,choiceGroup)=>({kind,label:kind,amount,unitValue:1,verified:true,sourceUrl:base.sourceUrl,conditions:[],choiceGroup});
assert.equal(rewardValue({...base,rewards:[reward('cash',10000),reward('gift',20000),reward('point',3000),reward('coupon',5000)]}),38000);
assert.equal(rewardValue({...base,rewards:[reward('gift',20000,'choice'),reward('point',30000,'choice'),reward('cash',10000)]}),40000);
assert.equal(rewardValue({...base,rewards:[{...reward('point',3000),verified:false}]}),null);assert.equal(rewardValue({...base,rewards:[{...reward('cash',10000),annualFee:true}]}),null);
for(const o of events){assert(EVENT_CATEGORIES.includes(eventCategory(o)));if(isAnnualFeeOffer(o)){assert.equal(visibleOffer(o),false);assert.equal(rewardValue(o),null);}}
assert.equal(visibleOffer({...base,kind:'cashback',title:'신규 발급 연회비 캐시백',annualFeeOnly:undefined}),false);
assert.equal(visibleOffer({...base,kind:'card',title:'트레이더스 멤버십 연회비 할인',annualFeeOnly:false}),true);
assert.equal(conflictingEventPeriod(['예약(결제) 기간 : 2025.10.01(목) ~ 2025.10.31(토) 출발 기간 : 2025.10.19 ~ 2027.01.31'],'2026-10-01','2026-10-31'),true);
assert.equal(conflictingEventPeriod(['예약 기간 : 2026.10.01 ~ 2026.10.31','출발 기간 : 2026.10.19 ~ 2027.01.31'],'2026-10-01','2026-10-31'),false);
assert.equal(conflictingEventPeriod(['행사 기간: 26.10.01 ~ 10.31'],'2026-10-01','2026-10-31'),false);
assert.equal(conflictingEventPeriod(['실제 숙박 행사 기간 2026.08.16–10.16(게시 시작 08.10과 구분)'],'2026-08-10','2026-10-16'),false);
assert.equal(requiresEntry({...base,entryRequired:true}),true);assert.equal(requiresEntry({...base,entryRequired:false}),false);
const trip=groupCards(cards).find(g=>g.card.name==='Trip to 로카');assert.equal(trip.variants.length,5);assert.equal(groupCards(cards).flatMap(g=>g.variants).length,cards.length);assert.equal(groupCards([{...cards[0],name:'same',id:'1',type:'credit'},{...cards[0],name:'same',id:'2',type:'debit'}]).length,2);
for(const c of cards)for(const o of linkedOffers(c,events)){assert(activeOffer(o));assert(visibleOffer(o));}
const tripOffer={...events.find(e=>e.id==='lotte-trip-to-loca-2026'),status:'active',startsAt:'2020-01-01',endsAt:'2099-12-31',cardIds:[trip.card.id]};assert(linkedOffers(trip.card,[tripOffer]).some(e=>e.id===tripOffer.id));
assert(!linkedOffers(cards.find(c=>c.id==='nh-90000056'),events).some(e=>e.id==='nh-agoda-q4-2026'),'BC-issued NH card must not inherit NH-only Agoda promotion');
assert.equal(eventCategory(events.find(e=>e.id==='bc-live-2026090060')),'국세 / 지방세');
console.log(JSON.stringify({status:'passed',cards:cards.length,families:groupCards(cards).length,annualFeeExcluded:events.filter(o=>!visibleOffer(o)).length,nominalRewards:true,periodBoundaries:true,variantPreservation:true}));
