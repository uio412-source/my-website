import './ensure-card-data.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {summarize,issuerGroup,benefitKinds,bestPicking,dedupeOffers} from '../lib/catalog-model.ts';
import {applyBenefitCorrections} from './apply-benefit-corrections.mjs';
const cards=JSON.parse(fs.readFileSync(fs.existsSync('work/original-cards.json')?'work/original-cards.json':'data/cards.json','utf8'));const research=JSON.parse(fs.readFileSync('data/card-research.json','utf8'));const byId=new Map(research.map(x=>[x.id,x]));
const minimum=new Map((fs.existsSync('data/minimum-picking-evidence.json')?JSON.parse(fs.readFileSync('data/minimum-picking-evidence.json','utf8')):[]).map(x=>[x.id,x]));
const placeholder=s=>s.length<100&&/(?:아래|하단).*(?:제외|참조)/.test(s);
for(const c of cards){const x=byId.get(c.id);if(!x)throw Error('Missing research identity '+c.id);for(const field of ['spendExclusions','benefitExclusions'])c[field]=[...new Set([...c[field],...(x[field]??[])])].filter(s=>!placeholder(s));
 c.issuerGroup=x.issuerGroup??(/(?:\bBC\b|비씨)/i.test(c.name)?'BC':issuerGroup(c.issuer));c.benefitKinds=benefitKinds(c);const m=minimum.get(c.id);c.pickingScenarios=m?[{...m,label:'핵심 혜택 최소 실적 구간',basis:'minimum-tier'}]:x.pickingScenarios??[];c.tags=c.tags.filter(t=>t!=='혜자카드');
 const status=field=>(x[field]?.length?'공식 원문 발췌':c[field].length?'기존 공식 자료':'미확인');
 c.conditionEvidence={url:x.evidence?.[0]?.sourceUrl??c.termsUrl??c.sourceUrl,checkedAt:x.checkedAt??'2026-10-06',spendStatus:status('spendExclusions'),benefitStatus:status('benefitExclusions'),sources:(x.evidence??[]).map(e=>({field:e.field,url:e.sourceUrl,isFullPolicySection:e.isFullPolicySection})).filter((e,i,a)=>a.findIndex(v=>v.field===e.field&&v.url===e.url)===i)};
 const positive=c.benefits.map(b=>b.title+' '+b.category+' '+b.detail.split(/[.。\\n]/).filter(s=>! /제외|미제공|제공되지|적립되지|할인되지/.test(s)).join(' ')).join(' ');
 const patterns={'상품권':/상품권.*(?:적립|할인)|(?:적립|할인).*상품권/,'관리비':/(?:아파트\s*)?관리비.*(?:적립|할인)|(?:적립|할인).*관리비/,'국세':/국세.*(?:적립|할인)|(?:적립|할인).*국세/,'지방세':/지방세.*(?:적립|할인)|(?:적립|할인).*지방세/};
 for(const [tag,pattern]of Object.entries(patterns))if(pattern.test(positive)&&!c.tags.includes(tag))c.tags.push(tag);
 if((bestPicking(c)?.value??0)>=3)c.tags=[...new Set([...c.tags,'혜자카드'])];
}
applyBenefitCorrections(cards);
const old=JSON.parse(fs.readFileSync(fs.existsSync('work/original-events.json')?'work/original-events.json':'data/events.json','utf8'));const researched=JSON.parse(fs.readFileSync('data/events-research.json','utf8'));const live=fs.existsSync('work/event-sources/live-scrape-result.json')?JSON.parse(fs.readFileSync('work/event-sources/live-scrape-result.json','utf8')).events:[];const fresh=[...new Map([...researched,...live].map(x=>[x.id,x])).values()];const freshById=new Map(fresh.map(x=>[x.id,x]));
const events=dedupeOffers([...old.filter(o=>!freshById.has(o.id)&&!fresh.some(x=>x.sourceUrl===o.sourceUrl)),...fresh.map(o=>({...o,cashbackAmount:o.cashbackAmount??o.cashbackMax??null}))].filter(o=>!o.id.includes('-live-')||/원|%|포인트|마일|무료|쿠폰|크레딧|캐시백/.test(o.benefitText)));
const summaries=cards.map(summarize);const stats={cardCount:cards.length,issuerCount:new Set(cards.map(c=>c.issuerGroup)).size,confirmedCount:cards.filter(c=>c.issuanceStatus==='confirmed').length,documentCount:cards.filter(c=>c.termsUrl).length,spendConditionCount:cards.filter(c=>c.spendExclusions.length).length,benefitConditionCount:cards.filter(c=>c.benefitExclusions.length).length,bothConditionCount:cards.filter(c=>c.spendExclusions.length&&c.benefitExclusions.length).length,pickingCount:cards.filter(c=>bestPicking(c)).length};
for(const [name,value]of Object.entries({cards,summaries,events,stats}))fs.writeFileSync(`data/${name}.json`,JSON.stringify(value,null,name==='summaries'?0:2)+'\n');fs.writeFileSync('public/catalog-snapshot.json',JSON.stringify({cards:summaries,stats})+'\n');fs.writeFileSync('data/revision.json',JSON.stringify({value:crypto.createHash('sha256').update(JSON.stringify([cards,events])).digest('hex')})+'\n');console.log(JSON.stringify({...stats,events:events.length,cashback:events.filter(x=>x.kind==='cashback').length,eventLinks:events.reduce((n,x)=>n+(x.cardIds?.length??0),0)}));



