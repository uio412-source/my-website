import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {readFileSync,realpathSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(realpathSync('node_modules/wrangler/package.json'));const {Miniflare}=await import(pathToFileURL(require.resolve('miniflare')).href);
const config=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));const root=path.resolve('dist/server');const main=path.resolve(root,config.main);const files=readdirSync(root,{recursive:true}).filter(f=>/\.(?:m?js)$/.test(f)).map(f=>path.resolve(root,f));
const mf=new Miniflare({name:config.name,scriptPath:main,modules:[main,...files.filter(f=>f!==main)].map(f=>({type:'ESModule',path:f})),modulesRoot:root,compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,d1Databases:{DB:'catalog-management-test'},assets:{directory:path.resolve('dist/client'),routerConfig:{has_user_worker:true}}});
const base='http://paymorevent.test';const auth={'oai-authenticated-user-id':'test-owner','oai-authenticated-user-email':'uio412@gmail.com','Origin':base,'Content-Type':'application/json'};
try{const db=await mf.getD1Database('DB');for(const f of ['0000_ambiguous_richard_fisk.sql','0001_foamy_genesis.sql','0002_graceful_hercules.sql']){const sql=readFileSync('drizzle/'+f,'utf8');for(const stmt of sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.exec(stmt.replace(/\n/g,' '));}
 let r=await mf.dispatchFetch(base+'/api/catalog');assert.equal(r.status,200);const initial=await r.json();assert.equal(initial.cards.length,1536);
 const nh=initial.cards.find(c=>c.id==='nh-90010544');assert.equal(nh.paymentEligibility['지방세'].benefit,'allowed');assert(nh.themeTags.includes('지방세'));
 for(const [id,label] of [['samsung-aap1452','2~4%'],['woori-103187','1.3~5%'],['woori-102488','2~5.3%'],['woori-102033','1~2.3%']]){const html=await(await mf.dispatchFetch(base+'/cards/'+id)).text();assert(html.includes(label));assert(html.includes('최고피킹률'));if(id==='woori-102488'){assert(html.includes('5.3%'));assert(html.includes('1.3%'));}if(id==='woori-102033'){assert(html.includes('69,000'));assert(html.includes('3,000,000'));}assert(!html.includes('class="issuer-logo-name"'),'Known issuers show wordmark only');}
 const download=await mf.dispatchFetch(base+'/downloads/paymorevent-card-database.xlsx');assert.equal(download.status,200);assert.equal((new Uint8Array(await download.arrayBuffer()))[0],80,'Excel asset must be a real XLSX ZIP');
 const eventPage=await mf.dispatchFetch(base+'/events/kb-everland-panda-oct-2026');assert.equal(eventPage.status,200);const eventHtml=await eventPage.text();assert(eventHtml.includes('이벤트 참여하기'));assert(!eventHtml.includes('공식 목록의 행사명·기간을 확인했습니다'));
 assert.equal((await mf.dispatchFetch(base+'/events/not-a-real-event')).status,404);
 const familyPage=await(await mf.dispatchFetch(base+'/cards/lotte-P14430-A14430')).text();assert(familyPage.includes('다른 브랜드·디자인'));assert(familyPage.includes('href="/cards/lotte-'), 'Family variants must remain navigable');
 assert.equal((await mf.dispatchFetch(base+'/api/admin')).status,403);
 assert.equal((await mf.dispatchFetch(base+'/api/admin',{headers:{...auth,'oai-authenticated-user-email':'viewer@example.com'}})).status,403);
 const id=initial.cards[0].id;r=await mf.dispatchFetch(base+'/api/admin?card='+id,{headers:auth});assert.equal(r.status,200);const original=await r.json();const c={...original,id:'qa-card',name:'QA 직접 등록',pickingScenarios:[],benefits:[{kind:'voucher',category:'호텔',title:'QA 바우처',detail:'공식 적용 조건',rate:null,cap:'연 1회',minimumSpend:300000}]};
 r=await mf.dispatchFetch(base+'/api/admin',{method:'POST',headers:{...auth,Origin:'http://evil.test'},body:JSON.stringify({kind:'card',payload:c})});assert.equal(r.status,403);
 r=await mf.dispatchFetch(base+'/api/admin',{method:'POST',headers:auth,body:JSON.stringify({kind:'card',payload:c})});assert.equal(r.status,200,await r.text());
 assert.equal((await mf.dispatchFetch(base+'/cards/qa-card')).status,200);let next=await(await mf.dispatchFetch(base+'/api/catalog')).json();assert(next.cards.some(x=>x.id==='qa-card'));
 c.name='QA 수정';r=await mf.dispatchFetch(base+'/api/admin',{method:'POST',headers:auth,body:JSON.stringify({kind:'card',payload:c})});assert.equal(r.status,200);const saved=await(await mf.dispatchFetch(base+'/api/cards/qa-card')).json();assert.equal(saved.name,c.name);assert.equal(saved.benefits[0].kind,'voucher','Explicit voucher classification must survive storage');

 assert.equal((await mf.dispatchFetch(base+'/api/admin',{method:'POST',headers:auth,body:JSON.stringify({kind:'invalid',payload:c})})).status,400);
 c.themeTags=['상품권 가능'];c.paymentEligibility={'상품권 가능':{spend:'unknown',benefit:'excluded',sourceUrl:c.sourceUrl,note:'공식 상품권 적립 제외'}};
 c.benefits[0].spendExclusions=['해당 혜택 상품권 실적 제외'];c.benefits[0].benefitExclusions=['해당 혜택 상품권 적립 제외'];
 r=await mf.dispatchFetch(base+'/api/admin',{method:'POST',headers:auth,body:JSON.stringify({kind:'card',payload:c})});assert.equal(r.status,200);
 next=await(await mf.dispatchFetch(base+'/api/catalog')).json();let edited=next.cards.find(x=>x.id==='qa-card');assert(!edited.themeTags.includes('상품권 가능'),'Stale cached theme must disappear after an exclusion edit');assert.equal(edited.paymentEligibility['상품권 가능'].benefit,'excluded');
 let detailRecord=await(await mf.dispatchFetch(base+'/api/cards/qa-card')).json();assert.equal(detailRecord.benefits[0].spendExclusions[0],c.benefits[0].spendExclusions[0]);assert.equal(detailRecord.benefits[0].benefitExclusions[0],c.benefits[0].benefitExclusions[0]);
 c.paymentEligibility['상품권 가능'].benefit='allowed';c.paymentEligibility['상품권 가능'].note='상품권 기본 적립 가능 · 추가 적립은 별도';
 r=await mf.dispatchFetch(base+'/api/admin',{method:'POST',headers:auth,body:JSON.stringify({kind:'card',payload:c})});assert.equal(r.status,200);
 next=await(await mf.dispatchFetch(base+'/api/catalog')).json();edited=next.cards.find(x=>x.id==='qa-card');assert(edited.themeTags.includes('상품권 가능'),'Eligibility edit must immediately update filter data');
 c.paymentEligibility['상품권 가능'].benefit='sometimes';r=await mf.dispatchFetch(base+'/api/admin',{method:'POST',headers:auth,body:JSON.stringify({kind:'card',payload:c})});assert.equal(r.status,400,'Invalid eligibility status must be rejected');
 c.paymentEligibility['상품권 가능'].benefit='allowed';c.paymentEligibility['상품권 가능'].note='';r=await mf.dispatchFetch(base+'/api/admin',{method:'POST',headers:auth,body:JSON.stringify({kind:'card',payload:c})});assert.equal(r.status,400,'Positive eligibility requires conditions');
 const samsung=initial.cards.filter(x=>['samsung-aap1452','samsung-aap1453'].includes(x.id));assert.equal(samsung.length,2);for(const x of samsung){assert.equal(x.paymentEligibility['상품권 가능'].benefit,'allowed');assert(x.themeTags.includes('상품권 가능'));assert(!('documents' in x),'Document bodies do not belong in search summary');}
 assert((await(await mf.dispatchFetch(base+'/database',{headers:auth})).text()).includes('DB 조회·수정'));
 assert((await(await mf.dispatchFetch(base+'/',{headers:auth})).text()).includes('href="/database"'));
 await db.prepare("UPDATE catalog_meta SET value='force-new-seed' WHERE key='revision'").run();next=await(await mf.dispatchFetch(base+'/api/catalog')).json();assert(next.cards.some(x=>x.id==='qa-card'&&x.name==='QA 수정'),'Manual data must survive seed revision');
 r=await mf.dispatchFetch(base+'/api/admin',{method:'DELETE',headers:auth,body:JSON.stringify({kind:'card',id:c.id})});assert.equal(r.status,200);assert.equal((await mf.dispatchFetch(base+'/cards/qa-card')).status,404);
 const detail=await(await mf.dispatchFetch(base+'/cards/'+id)).text();if(original.spendExclusions.length)assert(detail.includes('전월실적에서 제외되는 결제'));if(original.benefitExclusions.length)assert(detail.includes('할인·적립에서 제외되는 결제'));
 console.log(JSON.stringify({status:'passed',cards:initial.cards.length,adminAuthentication:403,csrf:403,create:true,update:true,delete:true,seedPreservation:true,detail:true,databasePage:true,eligibilityEdit:true,invalidEligibilityRejected:true,samsungGiftFilter:true}));
}finally{await mf.dispose();}

