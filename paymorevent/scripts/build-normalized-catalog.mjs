import {applyRewardValuations} from '../lib/reward-valuation.ts';
import './ensure-card-data.mjs';
import fs from 'node:fs';import crypto from 'node:crypto';import {gunzipSync,gzipSync} from 'node:zlib';
import {normalizeBundle,ENTITY_KINDS} from '../lib/normalized-card.ts';
const cards=JSON.parse(fs.readFileSync('data/cards.json')).map(applyRewardValuations);
const foundation=JSON.parse(gunzipSync(fs.readFileSync('data/card-foundation.json.gz')));
const grouped=new Map(cards.map(c=>[c.id,Object.fromEntries(ENTITY_KINDS.map(k=>[k,[]]))]));
for(const kind of ENTITY_KINDS)for(const row of foundation[kind]??[])grouped.get(row.cardId)?.[kind].push(row);
// Preserve each official table as a matrix; never infer a benefit from its neighbouring column.
for(const data of grouped.values()){const tables=new Map();for(const r of data.sourceTables){let t=tables.get(r.tableId);if(!t){t={id:r.tableId,cardId:r.cardId,tableId:r.tableId,scope:r.scope,documentId:r.documentId,sourceUrl:r.sourceUrl,checkedAt:r.checkedAt,status:'candidate',rows:[]};tables.set(r.tableId,t);}t.rows.push({row:r.row,cells:r.cells});}data.sourceTables=[...tables.values()];}
const stats={schemaVersion:4,cards:cards.length,stages:{},rows:Object.fromEntries(ENTITY_KINDS.map(k=>[k,0])),pickingAvailable:0};
const seed=[],bundles=[];
for(const c of cards){const bundle=normalizeBundle(c,grouped.get(c.id));bundle.review.updatedAt=(c.databaseAudit?.processedAt??c.verifiedAt)+'T00:00:00.000Z';bundles.push(bundle);c.normalization={stage:bundle.review.stage,qualityScore:bundle.review.qualityScore,missing:bundle.review.missing,serviceCount:bundle.review.serviceCount,modelCount:bundle.review.modelCount};stats.stages[bundle.review.stage]=(stats.stages[bundle.review.stage]??0)+1;if(bundle.review.pickingRate!==null)stats.pickingAvailable++;for(const k of ENTITY_KINDS)stats.rows[k]+=bundle.entities[k].length;seed.push({id:c.id,packed:gzipSync(JSON.stringify(bundle)).toString('base64')});}
const revision=crypto.createHash('sha256').update(JSON.stringify(seed)).digest('hex');
fs.writeFileSync('data/normalized-card-seed.json',JSON.stringify({schemaVersion:4,revision,items:seed}));
fs.writeFileSync('data/normalization-stats.json',JSON.stringify({...stats,revision,updatedAt:new Date().toISOString()},null,2));
fs.writeFileSync('data/cards.json',JSON.stringify(cards,null,2)+'\n');
fs.mkdirSync('public/downloads',{recursive:true});fs.writeFileSync('public/downloads/paymorevent-normalized-db.json.gz',gzipSync(JSON.stringify({schemaVersion:4,revision,statistics:stats,products:bundles}),{level:9}));
console.log(JSON.stringify(stats));
