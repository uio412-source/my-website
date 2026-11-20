import './ensure-card-data.mjs';
import {pathToFileURL} from 'node:url';
// Exercises the built Worker directly; this does not start a browser preview.
import assert from "node:assert/strict";
import { readFileSync, existsSync, realpathSync, readdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root=process.cwd();
const require=createRequire(realpathSync(path.join(root,"node_modules/wrangler/package.json")));
const {Miniflare}=await import(pathToFileURL(require.resolve("miniflare")).href);
const config=JSON.parse(readFileSync("dist/server/wrangler.json","utf8"));
const cards=JSON.parse(readFileSync("data/cards.json","utf8"));
const images=JSON.parse(readFileSync("data/card-images.json","utf8"));
for(const image of Object.values(images))if(image)assert(existsSync(path.join(root,"public",image)),`Missing asset ${image}`);
const serverRoot=path.resolve("dist/server");
const main=path.resolve(serverRoot,config.main);
const moduleFiles=readdirSync(serverRoot,{recursive:true}).filter(file=>/\.(?:m?js)$/.test(file)).map(file=>path.resolve(serverRoot,file));
const worker=new Miniflare({
  name:config.name,
  scriptPath:path.resolve("dist/server",config.main),
  modules:[main,...moduleFiles.filter(file=>file!==main)].map(file=>({type:"ESModule",path:file})),
  modulesRoot:serverRoot,
  compatibilityDate:config.compatibility_date,
  compatibilityFlags:config.compatibility_flags,
  d1Databases:{DB:"paymorevent-check"},
  assets:{directory:path.resolve("dist/client"),routerConfig:{has_user_worker:true}},
});
try {
  const db=await worker.getD1Database('DB');
  for(const file of ['0000_ambiguous_richard_fisk.sql','0001_foamy_genesis.sql'])for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').filter(s=>s.trim()))await db.exec(sql.replace(/\n/g,' '));
  const home=await worker.dispatchFetch("http://paymorevent.test/");
  assert.equal(home.status,200);const homeHtml=await home.text();
  assert(homeHtml.includes('href="/cards/'),"Catalog must contain real product-page links");
  assert(homeHtml.includes('data-navigation="document"'),"Products must use native document navigation");
  const productPaths=[...new Set([...homeHtml.matchAll(/href="(\/cards\/[^"?#]+)"/g)].map(match=>match[1]))];
  assert(productPaths.length>=24,"All initial products must be navigable");
  for(const route of productPaths){const response=await worker.dispatchFetch(`http://paymorevent.test${route}`);assert.equal(response.status,200,`Catalog product route failed: ${route}`);await response.body?.cancel();}
  assert(/name="viewport"[^>]*content="[^"]*width=device-width/.test(homeHtml),"Device viewport must be set");
  const styles=[...homeHtml.matchAll(/<link\b([^>]+)>/g)].filter(match=>/rel="stylesheet"/.test(match[1])).map(match=>match[1].match(/href="([^"]+)"/)?.[1]).filter(Boolean);
  assert(styles.length>0,"The page must load stylesheets");
  let css="";
  for(const asset of styles){const response=await worker.dispatchFetch(`http://paymorevent.test${asset}`);assert.equal(response.status,200,`Stylesheet not served: ${asset}`);assert(response.headers.get("content-type")?.includes("text/css"));css+=await response.text();}
  assert(css.includes("pm-card-grid")&&css.includes("650px"),"Customer responsive grid styles must reach the built page");
  assert(!homeHtml.includes("전체 적용 조건"),"Full product details must be on their own page");
  for(const copy of ["조건까지 함께 살펴보세요", "조건 확인 중", "공식 목록 수록", "정보 충실도순"])assert(!homeHtml.includes(copy),`Internal copy leaked into customer list: ${copy}`);
  const ids=["woori-500045","kb-09162","hana-7969","hyundai-ampte2","kb-09563","kb-09562","kb-09565"];
  const debit=cards.find(c=>c.type==="debit"&&images[c.id]);if(debit)ids.push(debit.id);
  const withoutImage=cards.find(c=>!images[c.id]);if(withoutImage)ids.push(withoutImage.id);
  for(const id of ids){
    const response=await worker.dispatchFetch(`http://paymorevent.test/cards/${encodeURIComponent(id)}`);
    assert.equal(response.status,200,`Direct URL must work: ${id}`);
    const html=await response.text();
    assert(html.includes('id="card-name"'));
    for(const section of ["benefits","conditions"])assert(html.includes(`id="${section}"`));
    assert((html.match(/<table\b/g)||[]).length>=1);
    assert(!html.includes("수집 범위"));
    assert(!html.includes("미확인 · 제외 항목이 없다는 뜻은 아닙니다."));
    if(images[id])assert(html.includes(images[id]),`Product artwork missing: ${id}`);
    else assert(html.includes("artwork-unavailable"));
    if(cards.find(c=>c.id===id).benefits.length)assert(html.includes("이용 조건"));
  }
  const travelersResponse=await worker.dispatchFetch('http://paymorevent.test/cards/kb-09563');const travelersHtml=await travelersResponse.text();
  assert(travelersHtml.includes('이 카드로 챙기는 이벤트'));
  assert(travelersHtml.includes('분기별 활성화'));
  assert(travelersHtml.includes('조건 확인이 필요한 이벤트'));
  for(const id of ['event-a8968cc','event-c896bf2','event-1068070c'])assert(travelersHtml.includes('/events/'+id),'Missing family event '+id);
  for(const id of ['event-a8968cc','event-c896bf2','event-1068070c']){const r=await worker.dispatchFetch('http://paymorevent.test/events/'+id);assert.equal(r.status,200);const html=await r.text();assert(html.includes('조건 확인일'));assert(html.includes('/cards/kb-095'));}
  const missing=await worker.dispatchFetch("http://paymorevent.test/cards/not-a-real-card");
  assert.equal(missing.status,404);assert((await missing.text()).includes("상품을 찾을 수"));
  const logos=["visa.svg","mastercard.svg","unionpay.png","domestic.svg","amex.png","jcb.png","diners.png"];
  const samples=[...new Map(cards.filter(c=>images[c.id]).map(c=>[c.issuer,images[c.id]])).values()];
  for(const asset of [...logos.map(f=>`/brands/${f}`),...samples]){
    const response=await worker.dispatchFetch(`http://paymorevent.test${asset}`);
    assert.equal(response.status,200,`Asset must be served: ${asset}`);
    assert(response.headers.get("content-type")?.startsWith("image/"),`Not an image: ${asset}`);
    assert((await response.arrayBuffer()).byteLength>100);
  }
  console.log(JSON.stringify({result:"passed",nativeProductRoutes:productPaths.length,stylesheets:styles.length,detailPages:ids.length,unknownProduct:404,brandAssets:logos.length,issuerImageSamples:samples.length,localCardImages:Object.values(images).filter(Boolean).length}));
} finally {await worker.dispose();}

