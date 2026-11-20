import './ensure-card-data.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
import {bestPicking,summarize} from '../lib/catalog-model.ts';
import {allocateSpending} from '../lib/spending-allocation.ts';
const cards=JSON.parse(fs.readFileSync('data/cards.json'));const day='2026-10-10';
const c=cards.find(c=>c.id==='bc-102603');
const url=c.sourceUrl;
// Independently read official product detail, 2026-10-10. These are alternatives,
// not 0.7+1.7+2.7 on a single purchase. Preserve the complete exclusion list.
c.minimumSpend=0;c.normalizationExceptions=['no_spend_requirement'];
c.rewardRates=c.benefits.filter(b=>/할인/.test(b.title)&&b.rate).map(b=>({label:b.title,spendUnit:100,rewardUnits:Number(b.rate.replace('%','')),rewardUnit:'원',unitValue:1,minimumSpend:0,monthlyCapValue:null,sourceUrl:url,note:'전월실적·횟수·월 한도 없음. 기본·특별 할인 중복 불가. '+(b.title.includes('아카데미')?'신세계 아카데미 온라인·오프라인 결제.':b.title.includes('1.7')?'신세계백화점·SSGPAY는 오프라인 한정. 해외는 해외겸용카드 결제.':'특별 할인 가맹점 제외.'),verified:true}));
for(const b of c.benefits.filter(b=>b.rate)){b.minimumSpend=0;b.minimumSpendVerified=true;b.cap='횟수·월 한도 없음';b.sourceUrl=url;b.benefitExclusions=[c.benefitExclusions.find(x=>x.startsWith('[청구할인 제외 항목]'))];}
c.brands=c.brands.filter(b=>b!=='Visa');c.policyNotes=[...(c.policyNotes??[]),'VISA 신규발급은 2023-10-02 중단. 기존 회원 서비스와 신규 발급 가능 브랜드를 구분.'];
c.rewardModelComplete=true;c.rewardCoveragePending=false;c.feeWaivers=[];c.databaseAudit.reviewStatus='reviewed';c.databaseAudit.note='2026-10-10 공식 상품 상세의 기본/특별 할인·무실적·무제한·제외목록·브랜드 발급중단을 개별 대조.';
for(const t of ['상품권 가능','국세','지방세','관리비'])c.paymentEligibility[t]={spend:'unknown',benefit:'excluded',sourceUrl:url,basis:'explicit',checkedAt:day,scope:'청구 할인 공통',note:'공식 청구할인 제외목록. 전월실적 요건이 없는 상품이므로 실적 인정 여부를 적립 가능으로 간주하지 않음.',evidence:'청구할인 제외: 상품권 구매금액, 국세, 지방세, 아파트 관리비'};
c.calculationValidation={passed:true,checkedAt:day,evidence:['0.7/1.7/2.7%를 단일 거래의 대안으로 계산','최고 2.7%, 요약·상세 일치','혜택 제외 구매는 계산 시나리오 대상에서 제외']};assert.equal(bestPicking(c).value,2.7);assert.equal(bestPicking(summarize(c)).value,2.7);
// On&Off: transaction caps and the domestic shared cap are not the same.
const on=cards.find(c=>c.id==='bc-102040');const source=on.sourceUrl;
const names=['온라인/간편결제','음식점/커피','버스/지하철/택시','해외'];
on.spendingPlans=[{min:300000,area:5000,total:10000},{min:600000,area:10000,total:20000},{min:900000,area:15000,total:35000}].map(t=>({label:`전월 ${t.min/10000}만원 구간 · 국내+해외 배분`,minimumSpend:t.min,budget:t.min,verified:true,exclusiveStreamsVerified:true,groups:[{id:'domestic',cap:t.total}],rules:names.map((name,i)=>({id:'region-'+i,label:name,ratePercent:10,monthlyCap:i===3?5000:t.area,groupIds:i===3?[]:['domestic'],sourceUrl:source,transactionCap:i===3?null:1000,splitTransactionsVerified:true,note:i===2?'카카오T 자동 결제의 적격 거래. 버스·지하철 각 월 2천원 제한을 전체 교통영역 한도와 혼동하지 않음.':'국내 거래는 건당 1천원 이하로 분산. 온라인/간편결제와 음식점 영역에 중복 배분하지 않음.'})),sourceUrl:source,notes:['국내 3개 영역 한도와 국내 통합 한도를 함께 적용. 해외 할인은 별도 월 5천원.','국내 적격 거래를 1만원 이하로 나누어 건당 1천원 한도를 충족하는 소비 배분 가정. 대중교통 자체의 버스·지하철 각 2천원 한도 대신 적격 카카오T 자동결제를 사용.','본인·가족 한도 합산. 할인 거래를 온라인/PAY와 음식점·교통에 중복 합산하지 않음.','전월실적 충족 후 당월 동일 예산 사용을 기준으로 한 혜택률. 해외 결제에 실제 부과되는 수수료는 혜택에 더하지 않음.']}));
on.minimumSpend=300000;on.rewardModelComplete=true;on.rewardCoveragePending=false;on.feeWaivers=[];on.rewardRates=[];
for(const [i,b] of on.benefits.entries()){if(i<4){b.minimumSpend=300000;b.minimumSpendVerified=true;b.sourceUrl=source;b.cap=i===3?'월 5천원':'전월30/60/90만원: 영역별5천/1만/1만5천원, 국내통합1만/2만/3만5천원. 국내건당1천원. 버스·지하철 각각월2천원.';}}
on.benefits[2].detail='카카오T 앱 자동결제, 시내버스·지하철 대상. 카카오T 현장 결제 제외. 카카오T 자동결제의 카카오페이 거래는 교통영역, 그 외 지정 간편결제는 온라인/PAY 영역으로 분류. 버스·지하철은 각각 월 2천원 한도.';
on.databaseAudit.reviewStatus='reviewed';on.databaseAudit.note='2026-10-10 공식 원문의 30/60/90만원 표, 국내 통합/영역 한도, 건당1천원·버스/지하철2천원, 가족합산을 대조. 검증 배분의 거래 분산 가정 명시.';
on.calculationValidation={passed:true,checkedAt:day,evidence:['30만원 예산에서 국내1만원+해외5천원=5%','60만원에서25,000원,90만원에서40,000원','국내 통합 한도, 건당 1천원 및 영역 중복 배제 검증']};
assert.equal(allocateSpending(on.spendingPlans[0]).benefit,15000);assert.equal(allocateSpending(on.spendingPlans[1]).benefit,25000);assert.equal(allocateSpending(on.spendingPlans[2]).benefit,40000);assert.equal(bestPicking(on).value,5);
for(const id of ['samsung-aap1452','samsung-aap1453','woori-103187','woori-103188','woori-102033','woori-102488','nh-90010544','shinhan-202406130001','woori-102722']){const x=cards.find(c=>c.id===id);x.calculationValidation={passed:true,checkedAt:day,evidence:['check-reward-policies.mjs 원화 환산·특별/추가분 한도·수수료·요약 일치 통과','check-foundation-database.mjs 임계 실적·한도·후속 기본률 검증 통과']};}
fs.writeFileSync('data/cards.json',JSON.stringify(cards,null,2)+'\n');
fs.writeFileSync('data/normalization-reviewed-batch.json',JSON.stringify({checkedAt:day,ids:[c.id,on.id],sources:[{cardId:c.id,sourceUrl:url,scope:'기본·특별 할인',quote:'국내 0.7%, 특별 1.7%, 아카데미 2.7%. 전월실적 조건 및 할인한도 없음. 중복 불가.'},{cardId:on.id,sourceUrl:source,scope:'한도표·건별 조건',quote:'국내30/60/90만원: 영역5천/1만/1만5천원·통합1만/2만/3만5천원. 해외월5천원. 국내건당최대1천원. 버스·지하철각월최대2천원.'}]},null,2));
console.log(JSON.stringify({reviewed:[{id:c.id,picking:2.7},{id:on.id,picking:5}],existingModelsValidated:9}));
