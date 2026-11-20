import seed from '@/data/normalized-card-seed.json';
import {getCatalogDatabase,initializeCatalog} from './catalog-db';
import {normalizeBundle,ENTITY_KINDS,type NormalizedBundle,type NormalizedRow} from './normalized-card';
import type {Card} from './catalog-types';
import {normalizeCard} from './card-themes';
let pending:Promise<void>|null=null;
export async function initializeNormalization(){if(pending)return pending;pending=(async()=>{const db=getCatalogDatabase();const ddl=[
 'CREATE TABLE IF NOT EXISTS card_normalized_rows (card_id TEXT NOT NULL, entity_kind TEXT NOT NULL, entity_id TEXT NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(card_id,entity_kind,entity_id))',
 'CREATE INDEX IF NOT EXISTS card_normalized_kind ON card_normalized_rows(entity_kind,card_id)',
 'CREATE TABLE IF NOT EXISTS card_review_queue (card_id TEXT PRIMARY KEY, issuer TEXT NOT NULL, name TEXT NOT NULL, stage TEXT NOT NULL, quality INTEGER NOT NULL, payload TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT, last_error TEXT, updated_at TEXT NOT NULL)',
 'CREATE INDEX IF NOT EXISTS card_review_stage ON card_review_queue(stage,next_attempt_at,quality)',
 'CREATE TABLE IF NOT EXISTS catalog_background_cards (id TEXT PRIMARY KEY,payload TEXT NOT NULL,updated_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS card_update_runs (id TEXT PRIMARY KEY,action TEXT NOT NULL,status TEXT NOT NULL,card_ids TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS card_source_watch (id TEXT PRIMARY KEY,issuer TEXT NOT NULL,kind TEXT NOT NULL,url TEXT NOT NULL,sha256 TEXT,checked_at TEXT,changed_at TEXT,last_error TEXT,payload TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS card_source_snapshots (id TEXT PRIMARY KEY,card_id TEXT NOT NULL,url TEXT NOT NULL,sha256 TEXT NOT NULL,format TEXT NOT NULL,payload TEXT NOT NULL,checked_at TEXT NOT NULL)',
 ];await db.batch(ddl.map(s=>db.prepare(s)));})().finally(()=>pending=null);return pending;}
async function unpack(packed:string):Promise<NormalizedBundle>{const b=Uint8Array.from(atob(packed),x=>x.charCodeAt(0));return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).json();}
export function entityStatements(bundle:NormalizedBundle){const db=getCatalogDatabase();const out=[db.prepare('DELETE FROM card_normalized_rows WHERE card_id = ?').bind(bundle.cardId)];
 for(const kind of ENTITY_KINDS){const rows=bundle.entities[kind];for(let i=0;i<rows.length;i+=80){out.push(db.prepare("INSERT INTO card_normalized_rows(card_id,entity_kind,entity_id,status,payload) SELECT ?,?,json_extract(value,'$.id'),json_extract(value,'$.status'),value FROM json_each(?) WHERE 1 ON CONFLICT(card_id,entity_kind,entity_id) DO UPDATE SET status=excluded.status,payload=excluded.payload").bind(bundle.cardId,kind,JSON.stringify(rows.slice(i,i+80))));}}
 const r=bundle.review;out.push(db.prepare('INSERT INTO card_review_queue(card_id,issuer,name,stage,quality,payload,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(card_id) DO UPDATE SET issuer=excluded.issuer,name=excluded.name,stage=excluded.stage,quality=excluded.quality,payload=excluded.payload,updated_at=excluded.updated_at').bind(r.cardId,r.issuer,r.name,r.stage,r.qualityScore,JSON.stringify(r),r.updatedAt));return out;
}
export async function seedNormalizedBatch(limit=20){await initializeNormalization();const db=getCatalogDatabase();await initializeCatalog(db);
 const state=await db.prepare("SELECT value FROM catalog_meta WHERE key='normalized-seed-progress'").first<{value:string}>();const prior=state?JSON.parse(state.value):null;let cursor=prior?.revision===seed.revision?prior.cursor:0;
 const next=Math.min(seed.items.length,cursor+Math.max(1,Math.min(Number.isFinite(limit)?Math.floor(limit):20,30)));
 const items=seed.items.slice(cursor,next),ids=items.map(x=>x.id),keys=ids.flatMap(id=>['override:card:'+id,'source-review:'+id]);
 const [base,background,meta]=await db.batch([
 db.prepare("SELECT id,payload FROM catalog_cards WHERE id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(ids)),
 db.prepare("SELECT id,payload FROM catalog_background_cards WHERE id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(ids)),
 db.prepare("SELECT key,value FROM catalog_meta WHERE key IN (SELECT value FROM json_each(?))").bind(JSON.stringify(keys)),
 ]);
 const cards=new Map<string,Card>((base.results as {id:string;payload:string}[]).map(x=>[x.id,normalizeCard(JSON.parse(x.payload))]));
 for(const x of background.results as {id:string;payload:string}[])cards.set(x.id,normalizeCard(JSON.parse(x.payload)));
 const deleted=new Set<string>();for(const x of meta.results as {key:string;value:string}[]){if(x.key.startsWith('override:card:')){const id=x.key.slice(14),o=JSON.parse(x.value);if(o.deleted){deleted.add(id);cards.delete(id);}else cards.set(id,normalizeCard(o.payload));}}
 for(const x of meta.results as {key:string;value:string}[])if(x.key.startsWith('source-review:')){const id=x.key.slice(14),c=cards.get(id);if(c)cards.set(id,{...c,sourceReviewPending:true});}
 let pending:D1PreparedStatement[]=[];for(const item of items){let statements:D1PreparedStatement[];if(deleted.has(item.id)){statements=[db.prepare('DELETE FROM card_review_queue WHERE card_id=?').bind(item.id),db.prepare('DELETE FROM card_normalized_rows WHERE card_id=?').bind(item.id)];}else{const saved=await unpack(item.packed),card=cards.get(item.id),bundle=card?normalizeBundle(card,saved.entities):saved;statements=entityStatements(bundle);}if(statements.length>99)throw Error('상품당 정규화 레코드가 처리 한도를 초과했습니다.');if(pending.length+statements.length>99){await db.batch(pending);pending=[];}pending.push(...statements);}if(pending.length)await db.batch(pending);
 cursor=next;const progress={revision:seed.revision,cursor,total:seed.items.length,done:cursor===seed.items.length,updatedAt:new Date().toISOString()};await db.prepare("INSERT INTO catalog_meta(key,value) VALUES('normalized-seed-progress',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(progress)).run();return progress;
}
export async function readNormalizedCard(id:string){await initializeNormalization();const db=getCatalogDatabase();const rows=await db.prepare('SELECT entity_kind,payload FROM card_normalized_rows WHERE card_id=? ORDER BY entity_kind,entity_id').bind(id).all<{entity_kind:string;payload:string}>();const entities=Object.fromEntries(ENTITY_KINDS.map(k=>[k,[] as NormalizedRow[]]));for(const r of rows.results)if(r.entity_kind in entities)entities[r.entity_kind as typeof ENTITY_KINDS[number]].push(JSON.parse(r.payload));const q=await db.prepare('SELECT payload,stage,quality,attempts,next_attempt_at,last_error FROM card_review_queue WHERE card_id=?').bind(id).first<{payload:string;stage:string;quality:number;attempts:number;next_attempt_at:string|null;last_error:string|null}>();return {schemaVersion:4,cardId:id,entities,review:q?{...JSON.parse(q.payload),stage:q.stage,qualityScore:q.quality,attempts:q.attempts,nextAttemptAt:q.next_attempt_at,lastError:q.last_error}:null};}
export async function updateNormalizedCard(c:Card,prior?:Partial<Record<typeof ENTITY_KINDS[number],NormalizedRow[]>>){await initializeNormalization();const current=prior??(await readNormalizedCard(c.id)).entities;const bundle=normalizeBundle(c,current);const db=getCatalogDatabase();await db.batch(entityStatements(bundle));return bundle.review;}
export async function normalizationStatus(issuer?:string,stage?:string,limit=30){await initializeNormalization();const db=getCatalogDatabase();const now=new Date().toISOString();const where:string[]=[];const args:string[]=[];if(issuer){where.push('issuer=?');args.push(issuer);}if(stage){where.push('stage=?');args.push(stage);}else{where.push("stage!='complete'");}where.push('(next_attempt_at IS NULL OR next_attempt_at<=?)');args.push(now);
 const seoulDay=new Date(Date.now()+9*3600000).toISOString().slice(0,10),dayStart=new Date(seoulDay+'T00:00:00+09:00').toISOString();
 const [queue,groups,counts,state,changes,runs,today]=await Promise.all([
 db.prepare('SELECT payload,stage,quality,attempts,next_attempt_at,last_error FROM card_review_queue WHERE '+where.join(' AND ')+' ORDER BY attempts ASC,quality DESC,card_id LIMIT ?').bind(...args,Math.min(100,Math.max(1,Number.isFinite(limit)?Math.floor(limit):30))).all<{payload:string;stage:string;quality:number;attempts:number;next_attempt_at:string|null;last_error:string|null}>(),
 db.prepare('SELECT issuer,stage,COUNT(*) AS count FROM card_review_queue GROUP BY issuer,stage ORDER BY issuer,stage').all(),
 db.prepare('SELECT entity_kind,COUNT(*) AS count FROM card_normalized_rows GROUP BY entity_kind').all(),
 db.prepare("SELECT value FROM catalog_meta WHERE key='normalized-seed-progress'").first<{value:string}>(),
 db.prepare('SELECT id,issuer,kind,url,changed_at,last_error FROM card_source_watch WHERE changed_at IS NOT NULL OR last_error IS NOT NULL ORDER BY checked_at DESC LIMIT 25').all(),
 db.prepare('SELECT id,action,status,note,created_at FROM card_update_runs ORDER BY created_at DESC LIMIT 12').all(),
 db.prepare("SELECT COUNT(DISTINCT json_each.value) AS count FROM card_update_runs,json_each(card_update_runs.card_ids) WHERE action IN ('import','batch_import') AND status!='failed' AND created_at>=?").bind(dayStart).first<{count:number}>(),
 ]);
 const savedProgress=state?JSON.parse(state.value):null;
 const progress=savedProgress?.revision===seed.revision?savedProgress:{revision:seed.revision,cursor:0,total:seed.items.length,done:false};
 return {schemaVersion:4,dailyTarget:{minimum:50,goal:50,completed:today?.count??0,date:seoulDay},seed:progress,groups:groups.results,counts:counts.results,queue:queue.results.map(r=>({...JSON.parse(r.payload),stage:r.stage,qualityScore:r.quality,attempts:r.attempts,nextAttemptAt:r.next_attempt_at,lastError:r.last_error})),sourceChanges:changes.results,runs:runs.results};}
export async function checkpointCard(id:string,note:string,retryHours=24){await initializeNormalization();const db=getCatalogDatabase();const next=new Date(Date.now()+Math.max(1,Math.min(168,Number.isFinite(retryHours)?retryHours:24))*3600000).toISOString();await db.prepare('UPDATE card_review_queue SET attempts=attempts+1,last_error=?,next_attempt_at=?,updated_at=? WHERE card_id=?').bind(note.slice(0,1000),next,new Date().toISOString(),id).run();}
export async function recordRun(action:string,status:string,ids:string[],note:string){await initializeNormalization();await getCatalogDatabase().prepare('INSERT INTO card_update_runs(id,action,status,card_ids,note,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),action,status,JSON.stringify(ids),note.slice(0,2000),new Date().toISOString()).run();}
