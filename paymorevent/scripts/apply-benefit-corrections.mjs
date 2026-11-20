import fs from 'node:fs';
export function applyBenefitCorrections(cards){
 const path='data/benefit-minimum-corrections.json';if(!fs.existsSync(path))return;
 const {corrections,unchangedOrMixed}=JSON.parse(fs.readFileSync(path,'utf8'));
 for(const r of [...corrections,...unchangedOrMixed.filter(r=>Number.isInteger(r.benefitIndex))]){
  const card=cards.find(c=>c.id===r.id),b=card?.benefits[r.benefitIndex];if(!b)throw Error('Correction identity not found '+r.id+':'+r.benefitIndex);if(r.benefitTitle&&b.title!==r.benefitTitle)throw Error('Correction title mismatch '+r.id);
  b.minimumSpend=r.minimumSpend;b.minimumSpendVerified=true;b.sourceUrl=r.sourceUrl;
  const note=[r.excerpt,r.note].filter(Boolean).join(' / ');if(note&&!b.detail.includes(note))b.detail+=(b.detail?'\n':'')+'실적 확인: '+note;
 }
}
