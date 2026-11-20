import {applyRewardValuations} from '../lib/reward-valuation.ts';
import fs from 'node:fs';
import {pickingOptions,bestPicking} from '../lib/catalog-model.ts';
const cards=JSON.parse(fs.readFileSync('data/cards.json')).map(applyRewardValuations);
fs.mkdirSync('work',{recursive:true});
fs.writeFileSync('work/workbook-input.json',JSON.stringify({cards,options:Object.fromEntries(cards.map(c=>[c.id,pickingOptions(c)]))}));
const audit=JSON.parse(fs.readFileSync('data/product-review-audit.json'));
audit.records=cards.map(c=>{const old=audit.records.find(r=>r.id===c.id);const checks={...old.checks,'적립 단위·가치':!!c.rewardRates?.length,'금전 혜택 모델 연결':!c.rewardCoveragePending,'최고피킹률 산출':!!bestPicking(c)};return {...old,checks,missing:Object.entries(checks).filter(([,v])=>!v).map(([k])=>k),reviewStatus:c.databaseAudit.reviewStatus};});
fs.writeFileSync('data/product-review-audit.json',JSON.stringify(audit,null,2)+'\n');
