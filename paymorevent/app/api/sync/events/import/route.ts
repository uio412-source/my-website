import {eventSchema} from '@/lib/catalog-validation';
import {getCatalogDatabase,initializeCatalog,readCatalog} from '@/lib/catalog-db';
import type {Offer} from '@/lib/catalog-types';
export const dynamic='force-dynamic';
// The linked cloud task uses the same owner-private Sites service boundary as /api/sync/events.
const domains=['samsungcard.com','kbcard.com','shinhancard.com','wooricard.com','hanacard.co.kr','hyundaicard.com','lottecard.co.kr','nonghyup.com','bccard.com','paybooc.co.kr','pay.naver.com','card-gorilla.com','banksalad.com','toss.im','kakaopay.com'];
export async function POST(r:Request){try{const raw=await r.json();const parsed=eventSchema.array().max(250).safeParse(raw);if(!parsed.success)return Response.json({error:parsed.error.message},{status:400});const catalog=await readCatalog();const ids=new Set(catalog.cards.map(c=>c.id));for(const o of parsed.data){const host=new URL(o.sourceUrl).hostname;if(!domains.some(d=>host===d||host.endsWith('.'+d)))return Response.json({error:'공식 카드사 또는 등록된 발급 채널 출처가 필요합니다.'},{status:400});if(o.cardIds?.some(id=>!ids.has(id)))return Response.json({error:'존재하지 않는 대상 카드상품'},{status:400});}
 const db=getCatalogDatabase();await initializeCatalog(db);const statements=parsed.data.map(o=>db.prepare('INSERT INTO catalog_events (id,kind,issuer,status,payload,verified_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,issuer=excluded.issuer,status=excluded.status,payload=excluded.payload,verified_at=excluded.verified_at').bind(o.id,o.kind,o.issuer,o.status,JSON.stringify(o as Offer),o.verifiedAt));for(let i=0;i<statements.length;i+=40)await db.batch(statements.slice(i,i+40));return Response.json({ok:true,count:parsed.data.length});
 }catch(e){return Response.json({error:String(e)},{status:400});}}
