import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';import {readFileSync,realpathSync,readdirSync} from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(realpathSync('node_modules/wrangler/package.json')), {Miniflare}=await import(pathToFileURL(require.resolve('miniflare')).href);
const config=JSON.parse(readFileSync('dist/server/wrangler.json','utf8')),root=path.resolve('dist/server'),main=path.resolve(root,config.main),files=readdirSync(root,{recursive:true}).filter(f=>/\.(?:m?js)$/.test(f)).map(f=>path.resolve(root,f));
const mf=new Miniflare({name:config.name,scriptPath:main,modules:[main,...files.filter(f=>f!==main)].map(f=>({type:'ESModule',path:f})),modulesRoot:root,compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,d1Databases:{DB:'discussion-test'},assets:{directory:path.resolve('dist/client'),routerConfig:{has_user_worker:true}}});
const base='http://paymorevent.test',headers=(id,email)=>({'oai-authenticated-user-id':id,'oai-authenticated-user-email':email,Origin:base,'Content-Type':'application/json'}),alice=headers('alice','alice@example.com'),bob=headers('bob','bob@example.com'),admin=headers('owner','uio412@gmail.com');
const request=(route,method,body,h=alice)=>mf.dispatchFetch(base+route,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)});
try{
 const db=await mf.getD1Database('DB');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const s of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint').filter(s=>s.trim()))await db.exec(s.replace(/\n/g,' '));
 assert.equal((await request('/api/community','POST',{topic:'카드 추천',title:'질문',body:'내용'},{Origin:base,'Content-Type':'application/json'})).status,403);
 assert.equal((await request('/api/community','POST',{topic:'카드 추천',title:'질문',body:'내용'},{...alice,Origin:'http://evil.test'})).status,403);
 let r=await request('/api/community','POST',{topic:'실적·혜택 질문',title:'상품권 실적 문의',body:'<script>unsafe()</script>\n공식 조건을 함께 확인해주세요.',author:'테스트회원'});assert.equal(r.status,201,await r.clone().text());const postId=(await r.json()).id;
 const board=await(await request('/api/community?topic='+encodeURIComponent('실적·혜택 질문'),'GET')).json();assert(board.posts.some(p=>p.id===postId));assert.equal(board.posts[0].author,'테스트회원');assert(!JSON.stringify(board).includes('alice@example.com'));assert(!('author_id' in board.posts[0]));
 let html=await(await request('/community/'+postId,'GET')).text();assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>unsafe()'));
 assert.equal((await request('/api/comments','POST',{kind:'card',targetId:'missing',body:'댓글'},bob)).status,404);
 r=await request('/api/comments','POST',{kind:'community',targetId:postId,body:'좋은 정보 감사합니다.',author:'두번째회원'},bob);assert.equal(r.status,201,await r.clone().text());const commentId=(await r.json()).id;
 let list=await(await request('/api/comments?kind=community&id='+postId,'GET',undefined,alice)).json();assert.equal(list.total,1);assert.equal(list.comments[0].canDelete,false);
 assert.equal((await request('/api/comments','DELETE',{id:commentId},alice)).status,403);
 assert.equal((await request('/api/community','DELETE',{id:postId},bob)).status,403);
 assert.equal((await request('/api/comments','POST',{kind:'community',targetId:postId,body:'너무 빠른 댓글'},bob)).status,429);
 await db.prepare("UPDATE discussion_comments SET created_at='2026-01-01T00:00:00.000Z'").run();
 r=await request('/api/comments','POST',{kind:'card',targetId:'bc-102040',body:'상품 댓글'},bob);assert.equal(r.status,201);const cardComment=(await r.json()).id;
 await db.prepare("UPDATE discussion_comments SET created_at='2026-01-01T00:00:00.000Z'").run();
 r=await request('/api/comments','POST',{kind:'event',targetId:'kb-everland-panda-oct-2026',body:'이벤트 댓글'},bob);assert.equal(r.status,201);
 await db.prepare("UPDATE catalog_meta SET value='force-new-revision' WHERE key='revision'").run();await request('/api/catalog','GET');list=await(await request('/api/comments?kind=card&id=bc-102040','GET',undefined,bob)).json();assert.equal(list.comments[0].id,cardComment,'Catalog reseeding must preserve comments');
 assert.equal((await request('/api/comments','DELETE',{id:commentId},admin)).status,200);
 assert.equal((await request('/api/community','DELETE',{id:postId},alice)).status,200);assert.equal((await request('/community/'+postId,'GET')).status,404);
 console.log(JSON.stringify({status:'passed',persistentComments:true,communityTopics:true,authorPrivacy:true,csrf:true,ownership:true,rateLimit:true,escapedText:true,seedPreservation:true}));
}finally{await mf.dispose();}
