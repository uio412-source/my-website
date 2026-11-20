import {getCatalogDatabase,readCard,readCatalog} from './catalog-db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {COMMUNITY_TOPICS} from './community';
import {visibleOffer} from './catalog-model';
export type PostRow={id:string;topic:string;title:string;body:string;author_id:string;author_name:string;created_at:string;comment_count:number};
export const canDelete=(u:ChatGPTUser|null,id:string)=>!!u&&(u.userId===id||u.email.toLowerCase()==='uio412@gmail.com');
export const postPublic=(p:PostRow,u:ChatGPTUser|null)=>({id:p.id,topic:p.topic,title:p.title,body:p.body,author:p.author_name,createdAt:p.created_at,commentCount:p.comment_count??0,canDelete:canDelete(u,p.author_id)});
export async function readPost(id:string){return getCatalogDatabase().prepare('SELECT p.*, (SELECT count(*) FROM discussion_comments c WHERE c.target_kind=\'community\' AND c.target_id=p.id) AS comment_count FROM community_posts p WHERE p.id=?').bind(id).first<PostRow>();}
export async function validTarget(kind:string,id:string){if(kind==='community')return !!await readPost(id);if(kind==='card')return !!await readCard(id);if(kind==='event')return (await readCatalog()).events.some(o=>o.id===id&&visibleOffer(o));return false;}
export function sameOrigin(r:Request){return r.headers.get('origin')===new URL(r.url).origin;}
export function authorName(name:unknown,u:ChatGPTUser){return typeof name==='string'&&name.trim()?name.trim().slice(0,30):u.fullName?.slice(0,30)||'회원';}
export function validTopic(v:unknown):v is typeof COMMUNITY_TOPICS[number]{return typeof v==='string'&&COMMUNITY_TOPICS.includes(v as typeof COMMUNITY_TOPICS[number]);}
export async function tooFast(userId:string){const db=getCatalogDatabase();const since=new Date(Date.now()-10000).toISOString();const r=await db.prepare('SELECT (SELECT count(*) FROM discussion_comments WHERE author_id=? AND created_at>?) + (SELECT count(*) FROM community_posts WHERE author_id=? AND created_at>?) AS n').bind(userId,since,userId,since).first<{n:number}>();return !!r?.n;}
