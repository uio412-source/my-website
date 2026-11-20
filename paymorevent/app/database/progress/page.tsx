import {getChatGPTUser,requireChatGPTUser} from '@/app/chatgpt-auth';
import NormalizationProgress from '@/components/normalization-progress';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/database/progress');const u=await getChatGPTUser();if(u?.email.toLowerCase()!=='uio412@gmail.com')return <main><h1>관리자 권한이 필요합니다.</h1></main>;return <main className="pm-detail-main"><NormalizationProgress/></main>;}
