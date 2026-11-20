import {getChatGPTUser,requireChatGPTUser} from '@/app/chatgpt-auth';
import CardDatabase from '@/components/card-database';
export const dynamic='force-dynamic';
export default async function DatabasePage(){await requireChatGPTUser('/database');const u=await getChatGPTUser();if(u?.email.toLowerCase()!=='uio412@gmail.com')return <main className="pm-detail-main"><h1>DB 편집은 관리자만 가능합니다.</h1><a href="/">홈으로</a></main>;return <CardDatabase/>;}
