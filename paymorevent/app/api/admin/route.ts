import { getChatGPTUser } from '@/app/chatgpt-auth';
import { readCatalog,readCard,writeOverride } from '@/lib/catalog-db';
import type {Card,Offer} from '@/lib/catalog-types';

import {normalizeCard} from '@/lib/card-themes';
import {cardSchema,eventSchema} from '@/lib/catalog-validation';
async function isAdmin(){const u=await getChatGPTUser();return u?.email.toLowerCase()==='uio412@gmail.com';}
function forbidden(){return Response.json({error:'관리자 권한이 필요합니다.'},{status:403});}
function sameOrigin(r:Request){return r.headers.get('origin')===new URL(r.url).origin;}
export async function GET(r:Request){if(!await isAdmin())return forbidden();const id=new URL(r.url).searchParams.get('card');return Response.json(id?await readCard(id):await readCatalog(),{headers:{'Cache-Control':'no-store'}});}
export async function POST(r:Request){if(!await isAdmin()||!sameOrigin(r))return forbidden();try{const x=await r.json() as {kind:string;payload:unknown;id:string};if(!['card','event'].includes(x.kind))return Response.json({error:'잘못된 항목 종류'},{status:400});const kind=x.kind==='card'?'card':'event';const result=(kind==='card'?cardSchema:eventSchema).safeParse(x.payload);if(!result.success)return Response.json({error:result.error.issues.map(i=>i.path.join('.')+': '+i.message).join('\n')},{status:400});if(JSON.stringify(x).length>200000)return Response.json({error:'데이터가 너무 큽니다.'},{status:400});await writeOverride(kind,result.data.id,kind==='card'?normalizeCard(result.data as Card):result.data as Offer);return Response.json({ok:true,id:result.data.id});}catch{return Response.json({error:'저장 실패: 입력 형식을 확인하세요.'},{status:400});}}
export async function DELETE(r:Request){if(!await isAdmin()||!sameOrigin(r))return forbidden();const x=await r.json() as {kind:string;payload:unknown;id:string};if(!['card','event'].includes(x.kind)||typeof x.id!=='string'||x.id.length>150)return Response.json({error:'잘못된 항목'},{status:400});await writeOverride(x.kind as 'card'|'event',x.id,null);return Response.json({ok:true});}



