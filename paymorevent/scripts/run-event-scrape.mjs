import './ensure-card-data.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {registerHooks} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=process.cwd();
registerHooks({
 resolve(specifier,context,next){
  let target;
  if(specifier.startsWith('@/'))target=path.join(root,specifier.slice(2));
  else if(specifier.startsWith('.')&&context.parentURL?.startsWith('file:'))target=path.resolve(path.dirname(fileURLToPath(context.parentURL)),specifier);
  if(target){if(!path.extname(target)&&fs.existsSync(target+'.ts'))target+='.ts';return next(pathToFileURL(target).href,context);}
  return next(specifier,context);
 },
 load(url,context,next){if(url.startsWith('file:')&&url.endsWith('.json'))return {format:'module',source:'export default '+fs.readFileSync(fileURLToPath(url),'utf8'),shortCircuit:true};return next(url,context);}
});
const {scrapeEvents}=await import('../lib/event-scraper.ts');
const result=await scrapeEvents(JSON.parse(fs.readFileSync('data/cards.json','utf8')),process.argv[2]);
fs.mkdirSync('work/event-sources',{recursive:true});
fs.writeFileSync('work/event-sources/live-scrape-result.json',JSON.stringify(result,null,2));
const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
for(const o of result.events){
 if((!o.startsAt&&o.startsAtLabel!=='수신일')||!o.endsAt||o.endsAt<today||(o.startsAt&&o.startsAt>today.slice(0,7)+'-31'))throw Error('Out-of-period event: '+o.id);
 if(o.verificationLevel==='official_list'&&(o.cashbackAmount!==null||o.cardIds?.length))throw Error('Unverified list assigned amount or card: '+o.id);
}
if(new Set(result.events.map(o=>o.id)).size!==result.events.length)throw Error('Duplicate event IDs');
console.log(JSON.stringify({eventCount:result.events.length,active:result.events.filter(o=>o.status==='active').length,upcoming:result.events.filter(o=>o.status==='upcoming').length,sources:result.sources},null,2));
