import './ensure-card-data.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {picking,bestPicking,activeOffer,linkedOffers} from '../lib/catalog-model.ts';
import {cardSchema,eventSchema} from '../lib/catalog-validation.ts';
const cards=JSON.parse(fs.readFileSync('data/cards.json','utf8'));const events=JSON.parse(fs.readFileSync('data/events.json','utf8'));
for(const c of cards)assert(cardSchema.safeParse(c).success,'Invalid card '+c.id);for(const e of events)assert(eventSchema.safeParse(e).success,'Invalid event '+e.id);assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
const base={label:'test',monthlySpend:500000,monthlyBenefit:0,annualFee:49000,miles:1000,sourceUrl:'https://example.com',assumptions:[],verified:true};assert(Math.abs(picking(base)-3.1833333333)<1e-8);assert.equal(picking({...base,verified:false}),null);assert.equal(picking({...base,monthlySpend:0}),null);
const air=cards.find(c=>/Air One/.test(c.name));assert(air);assert(Math.abs(bestPicking(air).value-3.1833333333)<1e-8);assert(!bestPicking(air).scenario.maximumVerified);
for(const o of events)for(const id of o.cardIds??[])assert(cards.some(c=>c.id===id),'Unknown event target '+id);
assert.equal(activeOffer({...events[0],status:'needs_review'}),false);assert.equal(linkedOffers(cards[0],[{...events[0],status:'needs_review',cardIds:[cards[0].id]}]).length,0);
for(const c of cards.filter(c=>c.issuer==='SC제일은행'))assert(['삼성','현대'].includes(c.issuerGroup),'SC partner must be classified per product');
console.log(JSON.stringify({status:'passed',cards:cards.length,events:events.length,pickingScenarios:cards.filter(c=>bestPicking(c)).length,airOneValue:bestPicking(air).value,cardLinks:events.reduce((n,e)=>n+(e.cardIds?.length??0),0)}));

