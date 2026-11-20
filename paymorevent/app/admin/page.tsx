import {getChatGPTUser,requireChatGPTUser} from '@/app/chatgpt-auth';
import Admin from '@/components/admin';
export const dynamic='force-dynamic';
export default async function AdminPage(){await requireChatGPTUser('/admin');const u=await getChatGPTUser();if(u?.email.toLowerCase()!=='uio412@gmail.com')return <main className="card-detail-main"><h1>관리자 권한이 필요합니다.</h1><a href="/">홈으로</a></main>;return <Admin/>;}
