import fs from 'node:fs';
import crypto from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';

const read=(file)=>JSON.parse(fs.readFileSync(file,'utf8'));
const cards=read('data/cards.json');
const events=read('data/events.json');
const byId=new Map(cards.filter(c=>c.networkServices?.length).map(c=>[c.id,c.networkServices]));
const attach=(list)=>{for(const item of list){const services=byId.get(item.id);if(services)item.networkServices=services;}return list;};

const summaries=attach(read('data/summaries.json'));
fs.writeFileSync('data/summaries.json',JSON.stringify(summaries));
const snapshot=read('public/catalog-snapshot.json');attach(snapshot.cards);fs.writeFileSync('public/catalog-snapshot.json',JSON.stringify(snapshot));
fs.writeFileSync('data/card-seed.json',JSON.stringify(gzipSync(JSON.stringify(cards)).toString('base64')));
fs.writeFileSync('data/revision.json',JSON.stringify({value:crypto.createHash('sha256').update(JSON.stringify([cards,events])).digest('hex')}));

const seed=read('data/normalized-card-seed.json');let count=0;
for(const item of seed.items){const bundle=JSON.parse(gunzipSync(Buffer.from(item.packed,'base64')));bundle.schemaVersion=4;bundle.entities.networkServices=(byId.get(item.id)??[]).map(s=>({...s,cardId:item.id,status:s.verified?'verified':'candidate'}));count+=bundle.entities.networkServices.length;item.packed=gzipSync(JSON.stringify(bundle)).toString('base64');}
seed.schemaVersion=4;seed.revision=crypto.createHash('sha256').update(JSON.stringify(seed.items)).digest('hex');
fs.writeFileSync('data/normalized-card-seed.json',JSON.stringify(seed));

const stats=read('data/normalization-stats.json');stats.schemaVersion=4;stats.rows.networkServices=count;stats.revision=seed.revision;stats.updatedAt=new Date().toISOString();fs.writeFileSync('data/normalization-stats.json',JSON.stringify(stats,null,2));
const downloadFile='public/downloads/paymorevent-normalized-db.json.gz';const download=JSON.parse(gunzipSync(fs.readFileSync(downloadFile)));download.schemaVersion=4;download.revision=seed.revision;download.statistics.schemaVersion=4;download.statistics.rows.networkServices=count;for(const bundle of download.products){bundle.schemaVersion=4;bundle.entities.networkServices=(byId.get(bundle.cardId)??[]).map(s=>({...s,cardId:bundle.cardId,status:s.verified?'verified':'candidate'}));}fs.writeFileSync(downloadFile,gzipSync(JSON.stringify(download),{level:9}));
console.log(JSON.stringify({cards:byId.size,networkServices:count,schemaVersion:4}));
