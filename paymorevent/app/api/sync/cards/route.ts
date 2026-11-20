import {applyRewardValuations} from '@/lib/reward-valuation';
import {cardSchema} from '@/lib/catalog-validation';
import {getCatalogDatabase,readCard,initializeCatalog} from '@/lib/catalog-db';
import {normalizationStatus,seedNormalizedBatch,readNormalizedCard,updateNormalizedCard,checkpointCard,recordRun,initializeNormalization} from '@/lib/normalized-db';
import {reviewCard} from '@/lib/normalized-card';
import {officialSource,cardContentHash,refreshCardSource,watchOfficialLists} from '@/lib/card-source-watch';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import type {Card} from '@/lib/catalog-types';
export const dynamic='force-dynamic';
// Unattended calls use the existing single-owner Sites service boundary.
// The service bearer is consumed by Sites, not stored or forwarded by this app.
async function allowed(r:Request){
 // Sites authenticates originless support-service calls before dispatch. Avoid
 // blocking unattended normalization on an interactive ChatGPT user lookup.
 if(!r.headers.get('origin'))return true;
 const u=await getChatGPTUser();
 return !!u&&u.email.toLowerCase()==='uio412@gmail.com'&&r.headers.get('origin')===new URL(r.url).origin;
}
class CardSyncError extends Error{status:number;details?:Record<string,unknown>;constructor(message:string,status=400,details?:Record<string,unknown>){super(message);this.status=status;this.details=details;}}
async function importCard(x:any,now:string){
 const parsed=cardSchema.safeParse(x.card);if(!parsed.success)throw new CardSyncError(parsed.error.message);
 const db=getCatalogDatabase(),card=applyRewardValuations(parsed.data as Card),current=await readCard(card.id);
 if(current&&x.expectedHash!==await cardContentHash(current))throw new CardSyncError('현재 상품이 변경됐습니다. 다시 읽고 변경사항을 합치세요.',409);
 if(!officialSource(card.sourceUrl))throw new CardSyncError('등록된 공식 상품 출처가 필요합니다.');
 const manual=await db.prepare('SELECT value FROM catalog_meta WHERE key=?').bind('override:card:'+card.id).first();
 if(manual)throw new CardSyncError('수동 편집 상품입니다. 자동 작업으로 덮어쓰지 않고 검토 목록에 유지합니다.',409);
 const definitions=(c:Card)=>({benefits:c.benefits,rewardRates:c.rewardRates,spendingPlans:c.spendingPlans,rewardModelComplete:c.rewardModelComplete,minimumSpend:c.minimumSpend,spendExclusions:c.spendExclusions,benefitExclusions:c.benefitExclusions});
 const changed=!current||await cardContentHash(definitions(current))!==await cardContentHash(definitions(card));
 const pendingSource=await db.prepare('SELECT value FROM catalog_meta WHERE key=?').bind('source-review:'+card.id).first<{value:string}>();
 if(pendingSource){const marker=JSON.parse(pendingSource.value);if(x.reviewedSourceHash!==marker.sha256)throw new CardSyncError('변경된 원문의 해시·조건을 대조한 뒤 저장하세요.',409,{sourceChange:marker});card.sourceReviewPending=false;}
 if((card.rewardModelComplete||card.rewardRates?.some(v=>v.verified))&&(changed||pendingSource)){if(!Array.isArray(x.evidence)||!x.evidence.length||x.evidence.some((e:Record<string,unknown>)=>typeof e.quote!=='string'||!(e.quote as string).trim()||typeof e.sourceUrl!=='string'||!officialSource(e.sourceUrl as string)||typeof e.scope!=='string'))throw new CardSyncError('검증 모델 변경에는 공식 원문·적용 범위·발췌 근거가 필요합니다.');}
 if(JSON.stringify(card).length>500000)throw new CardSyncError('상품 데이터가 너무 큽니다.');
 const review=reviewCard(card);card.normalization={stage:review.stage,qualityScore:review.qualityScore,missing:review.missing,serviceCount:review.serviceCount,modelCount:review.modelCount};
 await db.prepare('INSERT INTO catalog_background_cards(id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(card.id,JSON.stringify(card),now).run();
 const prior=(await readNormalizedCard(card.id)).entities;if(x.evidence)prior.constraints.push(...x.evidence.map((e:Record<string,unknown>,i:number)=>({id:`${card.id}:review:${now}:${i}`,cardId:card.id,status:'verified',...e,checkedAt:now})));
 const normalized=await updateNormalizedCard(card,prior);
 await db.prepare('UPDATE card_review_queue SET attempts=attempts+1,next_attempt_at=NULL,last_error=NULL WHERE card_id=?').bind(card.id).run();
 if(pendingSource)await db.prepare('DELETE FROM catalog_meta WHERE key=?').bind('source-review:'+card.id).run();
 return {ok:true,cardId:card.id,review:normalized,contentHash:await cardContentHash(card)};
}
export async function GET(r:Request){if(!await allowed(r))return Response.json({error:'관리자 권한이 필요합니다.'},{status:403});const q=new URL(r.url).searchParams;const id=q.get('card');if(id){const card=await readCard(id);if(!card)return Response.json({error:'상품이 없습니다.'},{status:404});return Response.json({card,contentHash:await cardContentHash(card),normalized:await readNormalizedCard(id),sourceChange:(await getCatalogDatabase().prepare('SELECT value FROM catalog_meta WHERE key=?').bind('source-review:'+id).first<{value:string}>())?.value??null},{headers:{'Cache-Control':'no-store'}});}return Response.json(await normalizationStatus(q.get('issuer')??undefined,q.get('stage')??undefined,Number(q.get('limit')??30)),{headers:{'Cache-Control':'no-store'}});}
export async function POST(r:Request){if(!await allowed(r))return Response.json({error:'관리자 권한이 필요합니다.'},{status:403});const db=getCatalogDatabase();await initializeCatalog(db);await initializeNormalization();const x=await r.json().catch(()=>null) as any;if(!x)return Response.json({error:'JSON 입력 필요'},{status:400});const now=new Date().toISOString();const lock=await db.prepare("INSERT INTO catalog_meta(key,value) VALUES('card-normalization-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE catalog_meta.value<?").bind(now,new Date(Date.now()-10*60000).toISOString()).run();if(!lock.meta.changes)return Response.json({status:'running'},{status:202});
 try{
 if(x.action==='initialize')return Response.json(await seedNormalizedBatch(Number(x.limit??20)));
 if(x.action==='reconcile'){
  if(!Array.isArray(x.cardIds)||!x.cardIds.length||x.cardIds.length>50||x.cardIds.some((id:unknown)=>typeof id!=='string'))return Response.json({error:'정규화 재대조 상품은 1~50건이어야 합니다.'},{status:400});
  const results=[];
  for(const id of [...new Set<string>(x.cardIds)]){
   const card=await readCard(id);
   if(!card){results.push({cardId:id,ok:false,error:'상품이 없습니다.'});continue;}
   // Rebuild from the current canonical card, including manual overrides.
   // This does not import a stale client payload or count as new review work.
   results.push({cardId:id,ok:true,review:await updateNormalizedCard(card)});
  }
  await recordRun('reconcile','refreshed',results.filter(r=>r.ok).map(r=>r.cardId),'현재 카드 원본과 정규화 대표 판정 재대조 · 신규 완료건수에 재집계하지 않음');
  return Response.json({ok:results.every(r=>r.ok),results});
 }
 if(x.action==='checkpoint'){if(typeof x.cardId!=='string'||typeof x.note!=='string')throw Error('상품코드·중단 사유 필요');await checkpointCard(x.cardId,x.note,Number(x.retryHours??24));await recordRun('checkpoint','paused',[x.cardId],x.note);return Response.json({ok:true});}
 if(x.action==='source'){const data=await refreshCardSource(String(x.cardId),x.url);await recordRun('source','collected',[x.cardId],data.format==='pdf'?'PDF 메타데이터 확보 · 본문 추출 필요':'HTML 원문 후보 확보');return Response.json(data);}
 if(x.action==='batch_source'){
  if(!Array.isArray(x.items)||!x.items.length||x.items.length>10)return Response.json({error:'원문 수집 묶음은 1~10건이어야 합니다.'},{status:400});
  const results:Array<Record<string,unknown>>=[];for(let i=0;i<x.items.length;i+=4){const chunk=x.items.slice(i,i+4);results.push(...await Promise.all(chunk.map(async(item:any)=>{const cardId=String(item?.cardId??'');try{const data=await refreshCardSource(cardId,item?.url);return {ok:true,cardId,data};}catch(e){return {ok:false,cardId,error:String(e)};}})));}
  const succeeded=results.filter(v=>v.ok).map(v=>String(v.cardId)),failed=results.length-succeeded.length;await recordRun('batch_source',failed?'partial':'collected',succeeded,`${succeeded.length}건 수집 · ${failed}건 실패`);return Response.json({ok:failed===0,processed:results.length,succeeded:succeeded.length,failed,results});
 }
 if(x.action==='watch'){const result=await watchOfficialLists(x.issuer,Number(x.limit??3));await recordRun('watch','checked',[],`${result.checked}개 공식 목록·공시 확인`);return Response.json(result);}
 if(x.action==='import'){const result=await importCard(x,now);await recordRun('import',result.review.stage,[result.cardId],`검증된 조건 저장 · 누락 ${result.review.missing.length}개`);return Response.json(result);}
 if(x.action==='batch_import'){
  if(!Array.isArray(x.items)||!x.items.length||x.items.length>50)return Response.json({error:'카드 저장 묶음은 1~50건이어야 합니다.'},{status:400});
  const results:Array<Record<string,unknown>>=[],succeeded:string[]=[];for(const item of x.items){const id=String(item?.card?.id??'');try{const result=await importCard(item,new Date().toISOString());succeeded.push(result.cardId);results.push(result);}catch(e){const error=e instanceof Error?e.message:String(e),status=e instanceof CardSyncError?e.status:400,details=e instanceof CardSyncError?e.details:undefined;results.push({ok:false,cardId:id,status,error,...details});}}
  const failed=results.length-succeeded.length;await recordRun('batch_import',failed?'partial':'complete',succeeded,`${succeeded.length}건 저장 · ${failed}건 보류`);return Response.json({ok:failed===0,processed:results.length,succeeded:succeeded.length,failed,results});
 }
 return Response.json({error:'지원하지 않는 작업'},{status:400});
 }catch(e){await recordRun(String(x.action??'unknown'),'failed',x.cardId?[String(x.cardId)]:[],String(e));const status=e instanceof CardSyncError?e.status:400,details=e instanceof CardSyncError?e.details:undefined;return Response.json({error:e instanceof Error?e.message:String(e),...details},{status});}finally{await db.prepare("DELETE FROM catalog_meta WHERE key='card-normalization-lock' AND value=?").bind(now).run();}
}
