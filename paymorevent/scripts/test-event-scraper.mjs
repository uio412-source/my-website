import './ensure-card-data.mjs';
import fs from 'node:fs';
let s=fs.readFileSync('lib/event-scraper.ts','utf8').replace("import research from '@/data/events-research.json';", "import fs from 'node:fs'; const research = JSON.parse(fs.readFileSync('data/events-research.json', 'utf8'));");
s=s.replace("import personalSources from '@/data/personal-benefit-sources.json';","const personalSources = JSON.parse(fs.readFileSync('data/personal-benefit-sources.json','utf8')); ").replace("from './catalog-model'", "from '../lib/catalog-model.ts'").replace("from './event-period'", "from '../lib/event-period.ts'");
s += "\nconst result=await scrapeEvents(JSON.parse(fs.readFileSync('data/cards.json','utf8')));fs.writeFileSync('work/event-sources/live-scrape-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({events:result.events.length,cashback:result.events.filter(e=>e.kind==='cashback').length,sources:result.sources},null,2));";
fs.writeFileSync('work/test-event-scraper.ts',s);
