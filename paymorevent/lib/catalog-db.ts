import {applyRewardValuations} from './reward-valuation';
import { env } from "cloudflare:workers";
import {readSeedCards} from "./catalog-seed";
import eventsSource from "@/data/events.json?raw";
import eventLinkUpdates from '@/data/event-link-updates.json';
import eventSnapshot from "@/data/event-snapshot.json";
import coverage from "@/data/coverage.json";
import revision from "@/data/revision.json";
import type {Card, Offer} from "@/lib/catalog-types";
import {normalizeCard} from './card-themes';
import {summarize,dedupeOffers} from './catalog-model';
import {reviewCard} from './normalized-card';

export function getCatalogDatabase():D1Database {
  if(!env.DB) throw new Error("Catalog DB binding unavailable");
  return env.DB as D1Database;
}
const events=JSON.parse(eventsSource) as Offer[];
let pendingInitialization:Promise<void>|null=null;
export async function initializeCatalog(db:D1Database){
  if(pendingInitialization)return pendingInitialization;
  pendingInitialization=seedCatalog(db).then(()=>seedEventSnapshot(db)).then(()=>seedLinkedEventUpdates(db)).finally(()=>{pendingInitialization=null;});
  return pendingInitialization;
}
async function seedCatalog(db:D1Database) {
  await db.prepare('CREATE TABLE IF NOT EXISTS catalog_background_cards (id TEXT PRIMARY KEY,payload TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
  const meta=await db.prepare("SELECT value FROM catalog_meta WHERE key = ?").bind("revision").first<{value:string}>();
  if(meta?.value===revision.value)return;
  const cards=await readSeedCards();const summaries=cards.map(summarize);
  // Seed data is separate from schema migrations. All inputs are repository-owned official-source snapshots.
  const statements:D1PreparedStatement[]=[];
  const summaryMap=new Map(summaries.map(c=>[c.id,c]));
  const tags:{id:string;recordId:string;kind:string;tag:string}[]=[];
  await db.prepare("DELETE FROM catalog_tags").run();
  for(const c of cards as Card[]) {
    statements.push(db.prepare("INSERT INTO catalog_cards (id,name,issuer,type,annual_fee_min,minimum_spend,issuance_status,payload,summary_payload,verified_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,issuer=excluded.issuer,type=excluded.type,annual_fee_min=excluded.annual_fee_min,minimum_spend=excluded.minimum_spend,issuance_status=excluded.issuance_status,payload=excluded.payload,summary_payload=excluded.summary_payload,verified_at=excluded.verified_at").bind(c.id,c.name,c.issuer,c.type,c.annualFeeMin,c.minimumSpend,c.issuanceStatus,JSON.stringify(c),JSON.stringify(summaryMap.get(c.id)),c.verifiedAt));
    for(const tag of c.tags)tags.push({id:`card:${c.id}:${tag}`,recordId:c.id,kind:"card",tag});
    if(statements.length>=40)await db.batch(statements.splice(0,40));
  }
  for(const o of events as Offer[]){
    statements.push(db.prepare("INSERT INTO catalog_events (id,kind,issuer,status,payload,verified_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,issuer=excluded.issuer,status=excluded.status,payload=excluded.payload,verified_at=excluded.verified_at").bind(o.id,o.kind,o.issuer,o.status,JSON.stringify(o),o.verifiedAt));
    for(const tag of o.tags)tags.push({id:`event:${o.id}:${tag}`,recordId:o.id,kind:"event",tag});
    if(statements.length>=40)await db.batch(statements.splice(0,40));
  }
  for(let i=0;i<tags.length;i+=400)statements.push(db.prepare("INSERT INTO catalog_tags (id,record_id,kind,tag) SELECT json_extract(value,'$.id'),json_extract(value,'$.recordId'),json_extract(value,'$.kind'),json_extract(value,'$.tag') FROM json_each(?) WHERE 1 ON CONFLICT(id) DO UPDATE SET tag=excluded.tag").bind(JSON.stringify(tags.slice(i,i+400))));
  for(let i=0;i<statements.length;i+=40)await db.batch(statements.slice(i,i+40));
  // Remove records absent from the authoritative snapshot, without long IN parameter lists.
  const currentCardIds=new Set(cards.map(c=>c.id));
  const oldCards=await db.prepare("SELECT id FROM catalog_cards").all<{id:string}>();
  const removals:D1PreparedStatement[]=[];
  for(const row of oldCards.results??[])if(!currentCardIds.has(row.id)){removals.push(db.prepare("DELETE FROM catalog_cards WHERE id = ?").bind(row.id));removals.push(db.prepare("DELETE FROM catalog_tags WHERE record_id = ? AND kind = ?").bind(row.id,"card"));}
  // Automatically collected events survive later source deployments; status uses each event period.
  for(let i=0;i<removals.length;i+=40)await db.batch(removals.slice(i,i+40));
  await db.prepare("INSERT INTO catalog_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind("revision",revision.value).run();
}
export async function readCatalog() {
  const db=getCatalogDatabase();await initializeCatalog(db);
  const [cs,es]=await Promise.all([db.prepare("SELECT summary_payload FROM catalog_cards").all<{summary_payload:string}>(),db.prepare("SELECT payload FROM catalog_events").all<{payload:string}>()]);
  const overrides=await readOverrides(db);
  const cardMap=new Map(cs.results.map(r=>{const c=JSON.parse(r.summary_payload);return [c.id,c];}));const eventMap=new Map(es.results.map(r=>{const o=JSON.parse(r.payload);return [o.id,o];}));
  const background=await db.prepare('SELECT payload FROM catalog_background_cards').all<{payload:string}>();for(const r of background.results){const c=JSON.parse(r.payload) as Card;cardMap.set(c.id,summarize(c));}
  for(const x of overrides){const map=x.kind==='card'?cardMap:eventMap;if(x.deleted)map.delete(x.id);else map.set(x.id,x.kind==='card'?summarize(x.payload as Card):x.payload);}
  const pendingSources=await db.prepare("SELECT key FROM catalog_meta WHERE key LIKE 'source-review:%'").all<{key:string}>();for(const r of pendingSources.results){const id=r.key.slice('source-review:'.length);const c=cardMap.get(id);if(c)cardMap.set(id,{...c,sourceReviewPending:true});}
  const sync=await db.prepare('SELECT value FROM catalog_meta WHERE key = ?').bind('event-sync-status').first<{value:string}>();
  return {cards:[...cardMap.values()],events:dedupeOffers([...eventMap.values()]),coverage,revision:revision.value,sync:sync?JSON.parse(sync.value):null};
}
export async function readCard(id:string){const db=getCatalogDatabase();await initializeCatalog(db);const override=await db.prepare('SELECT value FROM catalog_meta WHERE key = ?').bind('override:card:'+id).first<{value:string}>();let card:Card|null=null;if(override){const x=JSON.parse(override.value);if(x.deleted)return null;card=normalizeCard(x.payload);}else{const bg=await db.prepare('SELECT payload FROM catalog_background_cards WHERE id=?').bind(id).first<{payload:string}>();const row=bg??await db.prepare('SELECT payload FROM catalog_cards WHERE id=?').bind(id).first<{payload:string}>();card=row?normalizeCard(JSON.parse(row.payload)):null;}if(!card)return null;const pending=await db.prepare('SELECT value FROM catalog_meta WHERE key=?').bind('source-review:'+id).first();return pending?{...card,sourceReviewPending:true}:card;}
type Override={id:string;kind:'card'|'event';deleted:boolean;payload:Card|Offer|null;updatedAt:string};
async function readOverrides(db:D1Database){const rows=await db.prepare("SELECT value FROM catalog_meta WHERE key LIKE 'override:%'").all<{value:string}>();return rows.results.map(r=>JSON.parse(r.value) as Override);}
export async function writeOverride(kind:'card'|'event',id:string,payload:Card|Offer|null){const db=getCatalogDatabase();await initializeCatalog(db);if(kind==='card'&&payload){const c=applyRewardValuations(payload as Card);payload=c;const r=reviewCard(c);c.normalization={stage:r.stage,qualityScore:r.qualityScore,missing:r.missing,serviceCount:r.serviceCount,modelCount:r.modelCount};}const x:Override={id,kind,deleted:payload===null,payload,updatedAt:new Date().toISOString()};await db.prepare('INSERT INTO catalog_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(`override:${kind}:${id}`,JSON.stringify(x)).run();if(kind==='card'&&payload){const {updateNormalizedCard}=await import('./normalized-db');await updateNormalizedCard(payload as Card);}if(kind==='card'&&!payload){const table=await db.prepare("SELECT name FROM sqlite_master WHERE name='card_review_queue'").first();if(table)await db.batch([db.prepare('DELETE FROM card_review_queue WHERE card_id=?').bind(id),db.prepare('DELETE FROM card_normalized_rows WHERE card_id=?').bind(id)]);}}


async function seedEventSnapshot(db:D1Database){
 const prior=await db.prepare('SELECT value FROM catalog_meta WHERE key = ?').bind('event-snapshot-revision').first<{value:string}>();
 if(prior?.value===eventSnapshot.revision)return;
 const statements=(events as Offer[]).map(o=>db.prepare('INSERT INTO catalog_events (id,kind,issuer,status,payload,verified_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,issuer=excluded.issuer,status=excluded.status,payload=excluded.payload,verified_at=excluded.verified_at').bind(o.id,o.kind,o.issuer,o.status,JSON.stringify(o),o.verifiedAt));
 for(let i=0;i<statements.length;i+=40)await db.batch(statements.slice(i,i+40));
 await db.batch([
  db.prepare('INSERT INTO catalog_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('event-sync-status',JSON.stringify(eventSnapshot.sync)),
  db.prepare('INSERT INTO catalog_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('event-snapshot-revision',eventSnapshot.revision),
 ]);
}

async function seedLinkedEventUpdates(db:D1Database){
 const key='event-link-updates-revision';
 const prior=await db.prepare('SELECT value FROM catalog_meta WHERE key=?').bind(key).first<{value:string}>();
 if(prior?.value===eventLinkUpdates.revision)return;
 const statements=eventLinkUpdates.events.map(o=>db.prepare('INSERT INTO catalog_events (id,kind,issuer,status,payload,verified_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,issuer=excluded.issuer,status=excluded.status,payload=excluded.payload,verified_at=excluded.verified_at').bind(o.id,o.kind,o.issuer,o.status,JSON.stringify(o),o.verifiedAt));
 for(let i=0;i<statements.length;i+=40)await db.batch(statements.slice(i,i+40));
 await db.prepare('INSERT INTO catalog_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,eventLinkUpdates.revision).run();
}
