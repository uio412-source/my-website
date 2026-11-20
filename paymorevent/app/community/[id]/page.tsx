import {notFound} from 'next/navigation';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {readPost,postPublic} from '@/lib/discussion-db';
import {Comments} from '@/components/comments';
import {PostActions} from '@/components/post-actions';
export const dynamic='force-dynamic';
export default async function CommunityPage({params}:{params:Promise<{id:string}>}){const {id}=await params,row=await readPost(id);if(!row)notFound();const p=postPublic(row,await getChatGPTUser());return <div className="site"><header className="site-header"><div className="header-inner"><a className="brand" href="/">paymorevent<span className="brand-ko">페이모먼트</span></a><a href="/#community">커뮤니티</a></div></header><main className="card-detail-main"><nav className="detail-breadcrumb"><a href="/#community">커뮤니티</a><span>/</span><span>{p.topic}</span></nav><article className="community-detail"><span>{p.topic}</span><h1>{p.title}</h1><p className="table-note">{p.author} · {new Date(p.createdAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</p><div className="community-body">{p.body}</div>{p.canDelete&&<PostActions id={p.id}/>}</article><Comments kind="community" targetId={id}/><a className="secondary-button" href="/#community">커뮤니티 목록으로</a></main><footer className="site-footer"><p>카드와 여행, 함께 나누는 혜택 정보.</p><a className="footer-admin" href="/admin">관리자</a></footer></div>;}
