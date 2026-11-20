import './ensure-card-data.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {cardFacts,factTags} from '../lib/card-facts.ts';
import {bestPicking,picking,issuerGroup,activeOffer} from '../lib/catalog-model.ts';
import {benefitSpendText} from '../lib/card-presentation.ts';
const cards=JSON.parse(fs.readFileSync('data/cards.json','utf8')),research=JSON.parse(fs.readFileSync('data/minimum-picking-evidence.json','utf8'));
const tap=cards.find(c=>c.id==='samsung-aap1483');assert.equal(bestPicking(tap).value,35000/300000*100);
assert.deepEqual(factTags(['상품권 구매 및 관리비는 전월실적 제외'],'전월제외'),['전월제외:상품권','전월제외:관리비']);
const facts=cardFacts({...tap,benefits:[{category:'voucher',title:'호텔 숙박 바우처',detail:'조건',rate:null,cap:null,minimumSpend:null}],spendExclusions:['상품권 구매'],benefitExclusions:['관리비']});assert.equal(facts.vouchers.length,1);assert.equal(facts.benefits.length,0);assert.deepEqual(facts.spendTags,['전월제외:상품권']);assert.deepEqual(facts.exclusionTags,['혜택제외:관리비']);assert(!facts.benefitTags.includes('혜택:상품권'));
const chains=JSON.parse(fs.readFileSync('data/hotel-memberships.json','utf8'));assert.equal(chains.length,5);const keys=['points_bonus','breakfast','lounge','upgrade','early_checkin','late_checkout','guarantee','awards'];const ids=new Set();let tiers=0,benefits=0;for(const c of chains){assert(!ids.has(c.id));ids.add(c.id);assert(c.sourceUrl.startsWith('https://'));for(const t of c.tiers){tiers++;assert(t.name&&t.qualification);for(const k of keys)assert(t.benefits.some(b=>b.key===k),c.id+' '+t.id+' '+k);for(const b of t.benefits){benefits++;assert(b.value&&Array.isArray(b.conditions)&&b.sourceUrl.startsWith('https://'));}}}assert(chains.find(c=>c.id==='hilton').tiers.some(t=>/Reserve/.test(t.name)));assert(!chains.find(c=>c.id==='hyatt').tiers.some(t=>/Silver|Gold|Diamond/.test(t.name)));
// Cashback maximum is evaluated only for currently active, verified cash amounts, not point/gift headline totals.
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());const offers=[{issuer:'현대카드',kind:'cashback',status:'active',startsAt:today,endsAt:today,cashbackAmount:500000},{issuer:'현대카드',kind:'cashback',status:'needs_review',startsAt:today,endsAt:today,cashbackAmount:1000000},{issuer:'현대카드',kind:'cashback',status:'active',startsAt:today,endsAt:today,cashbackAmount:null}];assert.equal(Math.max(...offers.filter(o=>activeOffer(o)&&issuerGroup(o.issuer)==='현대').map(o=>o.cashbackAmount??0)),500000);
console.log(JSON.stringify({status:'passed',minimumScenarios:research.length,numericScenarios:cards.filter(c=>bestPicking(c)).length,hotelChains:chains.length,tiers,benefits}));
