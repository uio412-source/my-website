import './ensure-card-data.mjs';
import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import assert from 'node:assert/strict';
import {ENTITY_KINDS,reviewCard,normalizeBundle} from '../lib/normalized-card.ts';
import {allocateSpending} from '../lib/spending-allocation.ts';
import {cardSchema} from '../lib/catalog-validation.ts';
import {bestPicking,summarize} from '../lib/catalog-model.ts';
const seed=JSON.parse(fs.readFileSync('data/normalized-card-seed.json'));const cards=JSON.parse(fs.readFileSync('data/cards.json'));assert.equal(seed.items.length,cards.length);assert.equal(new Set(seed.items.map(x=>x.id)).size,cards.length);
let complete=0;
for(const item of seed.items){const bundle=JSON.parse(gunzipSync(Buffer.from(item.packed,'base64')));const c=cards.find(c=>c.id===item.id);cardSchema.parse(c);assert.equal(bundle.review.cardId,c.id);assert.equal(bundle.entities.services.length,c.benefits.length);const services=new Set(bundle.entities.services.map(r=>r.id)),docs=new Set(bundle.entities.documents.map(r=>r.id));
 for(const kind of ENTITY_KINDS){const rows=bundle.entities[kind];assert.equal(new Set(rows.map(r=>r.id)).size,rows.length,`Duplicate IDs: ${item.id} ${kind}`);for(const r of rows){assert.equal(r.cardId,item.id);if(r.serviceId)assert(services.has(r.serviceId),`Orphan service: ${item.id} ${kind} ${r.serviceId}`);if(r.documentId)assert(docs.has(r.documentId),`Orphan document: ${item.id} ${kind} ${r.documentId}`);}}
 const twice=normalizeBundle(c,bundle.entities);for(const kind of ENTITY_KINDS)assert.equal(new Set(twice.entities[kind].map(r=>r.id)).size,twice.entities[kind].length,`Repeated normalization IDs: ${item.id} ${kind}`);
 for(const s of bundle.entities.services){if(s.minimumSpend.state==='unknown'||s.minimumSpend.state==='candidate')assert.equal(s.minimumSpend.value,null);if(s.monthlyCap.state==='unknown')assert.equal(s.monthlyCap.mode,'unknown');}
 assert.equal(bestPicking(c)?.value,bestPicking(summarize(c))?.value);if(bundle.review.stage==='complete'){complete++;assert.equal(bundle.review.missing.length,0);assert(c.calculationValidation.passed);}
}
const on=cards.find(c=>c.id==='bc-102040');assert.equal(bestPicking(on).value,5);const plan=on.spendingPlans[0];const result=allocateSpending(plan);assert.equal(result.benefit,15000);assert(result.allocations.filter(a=>a.label!=='해외').reduce((n,a)=>n+a.benefit,0)<=10000);assert(result.allocations.reduce((n,a)=>n+a.spend,0)<=plan.budget);
assert.equal(allocateSpending({...plan,rules:plan.rules.map(r=>({...r,splitTransactionsVerified:false}))}),null);assert.equal(allocateSpending({...plan,exclusiveStreamsVerified:false}),null);
const crossing={...plan,groups:[{id:'a',cap:1000},{id:'b',cap:1000}],rules:plan.rules.slice(0,3).map((r,i)=>({...r,groupIds:i===0?['a']:i===1?['a','b']:['b']}))};assert.equal(allocateSpending(crossing),null,'Crossing shared caps require another solver');
const pu=cards.find(c=>c.id==='bc-102603');assert.equal(bestPicking(pu).value,2.7);assert.equal(reviewCard({...pu,calculationValidation:undefined}).stage,'validation_needed');assert.equal(reviewCard({...pu,rewardModelComplete:false}).stage,'rules_needed');assert.notEqual(reviewCard({...pu,feeWaivers:[{verified:false}]}).stage,'complete');
console.log(JSON.stringify({status:'passed',products:cards.length,complete,referentialIntegrity:true,unknownValuesSeparated:true,allocationCaps:true,transactionCaps:true,existingPickingPreserved:true}));
