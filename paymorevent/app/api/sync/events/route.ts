import {getCatalogDatabase,initializeCatalog,readCatalog} from '@/lib/catalog-db';
import {scrapeEvents,EVENT_SOURCES,eventSourceKey} from '@/lib/event-scraper';
import {mergeEventRefresh} from '@/lib/event-refresh';
import type {Card,Offer} from '@/lib/catalog-types';
export const dynamic='force-dynamic';
// This writer remains behind the owner-private Sites access boundary.
export async function POST(request:Request){
 const input=await request.json().catch(()=>({})) as {issuer?:unknown};
 const issuer=typeof input.issuer==='string'?input.issuer:undefined;
 if(issuer&&!EVENT_SOURCES.some(s=>s.issuer===issuer))return Response.json({error:'지원하지 않는 카드사'},{status:400});
 const db=getCatalogDatabase();await initializeCatalog(db);
 const now=new Date().toISOString(),today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 const lock=await db.prepare("INSERT INTO catalog_meta (key,value) VALUES ('event-sync-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE catalog_meta.value < ?").bind(now,new Date(Date.now()-15*60000).toISOString()).run();
 if(!lock.meta.changes)return Response.json({status:'running',message:'수집이 진행 중입니다.'},{status:202});
 try{
  const catalog=await readCatalog(),result=await scrapeEvents(catalog.cards as Card[],issuer);
  const previous=catalog.events as Offer[],previousBySource=new Map(previous.filter(o=>o.status!=='official_hub').map(o=>[eventSourceKey(o),o]));
  const merged=result.events.map(o=>{const prior=previousBySource.get(eventSourceKey(o));return {...mergeEventRefresh(o,prior),id:prior?.id??o.id};});
  const seen=new Set(merged.map(o=>o.id)),seenSources=new Set(merged.map(eventSourceKey));
  const successful=new Set(result.sources.filter(s=>s.status==='ok'||s.status==='partial').map(s=>s.issuer));
  for(const old of previous){
   if(old.kind==='hotel'||old.status==='official_hub'||seen.has(old.id))continue;
   if(seenSources.has(eventSourceKey(old))){merged.push({...old,status:'needs_review',verificationNote:'동일 공식 이벤트의 최신 게시물로 통합되었습니다.'});continue;}
   if(issuer&&old.issuer!==issuer)continue;
   if(old.endsAt&&old.endsAt<today)merged.push({...old,status:'expired'});
   else if(successful.has(old.issuer)&&!/(?:pay\.naver\.com|card-gorilla\.com|kakaopay\.com|banksalad\.com|toss\.im)$/.test(new URL(old.sourceUrl).hostname))merged.push({...old,status:'needs_review',verificationNote:'최신 공식 진행 목록에서 확인되지 않았습니다. 공식 안내 재확인 필요.'});
   // A failed source leaves its existing records intact, until their recorded end date.
  }
  const statements=merged.map(o=>db.prepare('INSERT INTO catalog_events (id,kind,issuer,status,payload,verified_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,issuer=excluded.issuer,status=excluded.status,payload=excluded.payload,verified_at=excluded.verified_at').bind(o.id,o.kind,o.issuer,o.status,JSON.stringify(o),o.verifiedAt));
  for(let i=0;i<statements.length;i+=40)await db.batch(statements.slice(i,i+40));
  const updatedIssuers=new Set(result.sources.map(s=>s.issuer)),prior=catalog.sync;
  const sources=[...(prior?.sources??[]).filter((s:{issuer:string})=>!updatedIssuers.has(s.issuer)),...result.sources];
  const discovered=[...(prior?.discovered??[]).filter((s:{issuer:string})=>!updatedIssuers.has(s.issuer)),...result.discovered];
  const status={lastRun:now,finishedAt:new Date().toISOString(),month:today.slice(0,7),eventCount:sources.reduce((n,s)=>n+s.count,0),sources,discovered};
  await db.prepare('INSERT INTO catalog_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('event-sync-status',JSON.stringify(status)).run();
  return Response.json(status,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:String(e)},{status:502});}
 finally{await db.prepare('DELETE FROM catalog_meta WHERE key = ?').bind('event-sync-lock').run();}
}
export async function GET(){const catalog=await readCatalog();return Response.json({sync:catalog.sync,events:catalog.events.length},{headers:{'Cache-Control':'no-store'}});}
