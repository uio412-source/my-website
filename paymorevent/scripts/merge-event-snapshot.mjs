// Merge a freshly fetched issuer snapshot into a captured live catalog.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {eventSourceKey} from '../lib/event-identity.ts';
import {mergeEventRefresh} from '../lib/event-refresh.ts';
const before=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const fresh=JSON.parse(fs.readFileSync('work/event-sources/live-scrape-result.json','utf8'));
const curated=JSON.parse(fs.readFileSync('data/event-link-updates.json','utf8')).events;
const bySource=new Map(before.events.map(o=>[eventSourceKey(o),o]));
const merged=new Map(before.events.map(o=>[o.id,o]));
const successful=new Set(fresh.sources.filter(s=>['ok','partial'].includes(s.status)).map(s=>s.issuer));
const seen=new Set(fresh.events.map(eventSourceKey));const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
for(const old of before.events){
 if(old.kind==='hotel'||old.status==='official_hub')continue;
 if(old.endsAt&&old.endsAt<today)merged.set(old.id,{...old,status:'expired'});
 else if(successful.has(old.issuer)&&!seen.has(eventSourceKey(old))&&new URL(old.sourceUrl).hostname.endsWith('card.com'))merged.set(old.id,{...old,status:'needs_review',verificationNote:'최신 공식 진행 목록에서 확인되지 않아 재확인 대기.'});
}
for(const next of fresh.events){const prior=bySource.get(eventSourceKey(next));const o=mergeEventRefresh(next,prior);merged.set(prior?.id??o.id,{...o,id:prior?.id??o.id});}
for(const o of curated)merged.set(o.id,o);
const events=[...merged.values()];
fs.writeFileSync('data/events.json',JSON.stringify(events,null,2)+'\n');
const now=new Date().toISOString();const sync={lastRun:now,finishedAt:now,month:today.slice(0,7),eventCount:fresh.sources.reduce((n,s)=>n+s.count,0),sources:fresh.sources,discovered:fresh.discovered,detailReview:{checkedAt:today,reviewed:curated.length,linked:curated.filter(o=>o.status==='active').length,pending:curated.filter(o=>o.status==='needs_review').length}};
const revision=crypto.createHash('sha256').update(JSON.stringify([events,sync])).digest('hex');fs.writeFileSync('data/event-snapshot.json',JSON.stringify({revision,sync},null,2)+'\n');
console.log(JSON.stringify({before:before.events.length,after:events.length,fresh: fresh.events.length,reviewed:curated.length,linked:sync.detailReview.linked,pending:sync.detailReview.pending}));
