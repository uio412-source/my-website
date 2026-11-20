import './ensure-card-data.mjs';
import fs from 'node:fs';import {normalizeCard} from '../lib/card-themes.ts';
const cards=JSON.parse(fs.readFileSync('data/cards.json','utf8')).map(normalizeCard);
fs.writeFileSync('data/cards.json',JSON.stringify(cards,null,2)+'\n');
const stats=JSON.parse(fs.readFileSync('data/stats.json','utf8'));
Object.assign(stats,{documentCount:cards.filter(c=>c.termsUrl).length,productPdfCount:cards.filter(c=>(c.databaseAudit?.pdfRead??0)>0).length,spendConditionCount:cards.filter(c=>c.spendExclusions.length).length,benefitConditionCount:cards.filter(c=>c.benefitExclusions.length).length,bothConditionCount:cards.filter(c=>c.spendExclusions.length&&c.benefitExclusions.length).length});
fs.writeFileSync('data/stats.json',JSON.stringify(stats,null,2)+'\n');
console.log(JSON.stringify({cards:cards.length,productPdfCount:stats.productPdfCount,giftEligible:cards.filter(c=>c.paymentEligibility?.['상품권 가능']?.benefit==='allowed').length}));
