import './ensure-card-data.mjs';
import fs from 'node:fs';import crypto from 'node:crypto';
import {summarize} from '../lib/catalog-model.ts';
import {cardThemes,paymentEligibility} from '../lib/card-themes.ts';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n');
const cards=read('data/cards.json'),evidence=read('data/minimum-picking-evidence.json');
const capDefinitions={
 'samsung-aap1483':{benefit:35000,scope:'라이프스타일·교통·통신·영화 할인 최초 30만원 구간의 단일 월 최대 혜택',parts:[['커피',10000,'월 10,000원'],['쇼핑',5000,'월 5,000원'],['대중교통·택시',5000,'월 5,000원'],['이동통신',5000,'월 5,000원'],['영화',10000,'일 1회·월 2회·연 12회, 1회 5,000원']],notes:['월 최대 할인한도 합계 35,000원 ÷ 최소 실적 300,000원 = 11.67%입니다.','영화는 월 최대 2회, 연 최대 12회입니다. 영화 월 최대를 매월 반복 받을 수 있다는 뜻이 아닙니다.','스타벅스 50%·오픈마켓 7% 등 공식 라이프스타일 옵션과 결제 조건을 충족해야 합니다.','해외 무실적 1.3% 적립은 별도 소비를 가정하지 않아 가산하지 않습니다.']},
 'bc-103112':{benefit:10000,scope:'BC K-패스 카드 자체 할인 최초 30만원~60만원 미만 구간',parts:[['통합 할인한도',10000,'대중교통 최대 7,000원, 카페·편의점·이동통신 등과 통합 월 10,000원']],notes:['정부 K-패스 환급은 카드 자체 적립·할인이 아니므로 제외합니다.','통합한도 10,000원을 영역별 한도와 중복 합산하지 않습니다.']},
 'bc-103127':{benefit:8000,scope:'KT 마이알뜰폰 통신·주유 할인 최초 30만원~70만원 미만 구간',parts:[['KT 알뜰폰 자동납부',7000,'월 7,000원, 대상 알뜰폰 사업자 및 자동납부 조건'],['SK 주유',1000,'1% 할인, 월 1,000원']],notes:['통신요금이 할인한도 이상이고 대상 알뜰폰 자동납부를 이용하는 경우입니다.','주유는 SK 주유소 대상이며 LPG·충전소 등 제외 조건을 적용합니다.']},
 'bc-102040':{benefit:15000,scope:'On＆Off 국내·해외 할인 최초 30만원~60만원 미만 구간',parts:[['국내 통합',10000,'온라인·간편결제, 음식점·커피, 교통 각 5,000원 / 국내 통합 10,000원'],['해외',5000,'해외 월 5,000원']],notes:['국내 영역별 한도를 모두 더하지 않고 통합한도 10,000원을 적용합니다.','국내·해외 공식 대상 거래에서 최대 한도를 이용하는 경우입니다.','해외 수수료·연회비·실적용 별도 소비를 계산에 더하거나 빼지 않습니다.']},
};
for(const c of cards){
 delete c.themeTags;
 c.paymentEligibility=Object.fromEntries(['상품권 가능','관리비','국세','지방세'].map(t=>[t,paymentEligibility(c,t)]));
 // Explicit category benefits prove benefit eligibility, even when they do not count as performance.
 for(const [theme,re] of [['관리비',/아파트\s*관리비|APT\s*관리비/i],['국세',/국세/],['지방세',/지방세/]]){
  const b=c.benefits.find(b=>b.kind!=='voucher'&&re.test(b.title)&&/적립|할인/.test(b.title)&&!(/제외/.test(b.title)));
  if(b)c.paymentEligibility[theme]={...c.paymentEligibility[theme],benefit:'allowed',sourceUrl:b.sourceUrl??c.sourceUrl,note:b.title+' / '+b.detail};
 }
 // Individually reviewed full official performance list. Gift certificates and prepaid gift cards are distinct.
 if(c.id==='shinhan-201709220001'){
  for(const theme of ['상품권 가능','관리비','국세','지방세'])c.paymentEligibility[theme]={spend:'allowed',benefit:theme==='상품권 가능'?'unknown':'excluded',sourceUrl:c.sourceUrl,note:theme==='상품권 가능'?'공식 전월 이용금액 전체 제외목록에는 상품권 구매가 없습니다. 기프트카드 구매·선불카드 충전은 제외됩니다. 상품권의 기본/특별 적립 여부는 가맹점·비쇼핑 조건을 별도 확인해야 합니다.':'공식 전월 이용금액 전체 제외목록에는 해당 납부가 없지만, 포인트 적립에서는 제외됩니다.'};
 }
 if(c.id==='bc-102040')for(const theme of ['국세','지방세'])c.paymentEligibility[theme]={spend:'allowed',benefit:'unknown',sourceUrl:c.sourceUrl,note:'공식 전월실적 전체 제외목록에는 국세·지방세가 없습니다. 적립·할인은 온라인·간편결제 등 대상 거래 조건을 별도 확인해야 합니다.'};
 c.themeTags=cardThemes(c);
 const cap=capDefinitions[c.id],r=evidence.find(r=>r.id===c.id);
 if(cap&&r){c.pickingScenarios=[{label:cap.scope,monthlySpend:r.minimumEligibleSpend,minimumEligibleSpend:r.minimumEligibleSpend,monthlyBenefit:cap.benefit,annualFee:0,annualServiceValue:0,miles:0,sourceUrl:r.sourceUrl,assumptions:cap.notes,verified:true,maximumVerified:true,basis:'minimum-tier',calculation:'tier-cap',benefitScope:cap.scope,components:cap.parts.map(([label,amount,cap])=>({label,amount,cap})),status:'verified_minimum_tier_caps'}];}
 else c.pickingScenarios=[];
}
write('data/cards.json',cards);const summaries=cards.map(summarize);write('data/summaries.json',summaries);write('public/catalog-snapshot.json',{cards:summaries});
write('data/minimum-tier-cap-evidence.json',cards.filter(c=>c.pickingScenarios.length).map(c=>({id:c.id,name:c.name,checkedAt:'2026-10-06',scenario:c.pickingScenarios[0],sources:evidence.find(e=>e.id===c.id)?.sources??[]})));
const revision=crypto.createHash('sha256').update(fs.readFileSync('data/cards.json')).update(fs.readFileSync('data/events.json')).digest('hex');write('data/revision.json',{value:revision});
console.log(JSON.stringify({cards:cards.length,classified:Object.fromEntries(['상품권 가능','관리비','국세','지방세','마일리지','호텔','해외','통신'].map(t=>[t,cards.filter(c=>c.themeTags.includes(t)).length])),verifiedPicking:cards.filter(c=>c.pickingScenarios.length).length}));
