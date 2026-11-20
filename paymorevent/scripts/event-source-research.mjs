import fs from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve('work/event-sources'); await fs.mkdir(out,{recursive:true});
const seeds=[
['hyundai-cashback','현대카드','https://card.hyundaicard.com/EVENT?id=apb_10'],
['hyundai-events','현대카드','https://www.hyundaicard.com/cpb/ev/CPBEV0101_01.hc'],
['hyundai-energy','현대카드','https://www.hyundaicard.com/cpb/ev/CPBEV0101_06.hc?bnftWebEvntCd=CNE507'],
['shinhan-cashback','신한카드','https://www.shinhancard.com/pconts/html/landing/bestCardC.html?epCase=naver'],
['shinhan-events','신한카드','https://www.shinhancard.com/mob/MOBFW11011N/MOBFW11011C02.shc'],
['kb-panda','KB국민카드','https://card.kbcard.com/BON/DVIEW/HBBMCXCRVNEC0001?eventNum=1002195&mainCC=a'],
['kb-events','KB국민카드','https://card.kbcard.com/BON/DVIEW/HBBMCXCRVNEC0001'],
['hana-events','하나카드','https://m.hanacard.co.kr/MPAEVT100M.web'],
['lotte-events','롯데카드','https://www.lottecard.co.kr/app/LPBNFDA_V100.lc'],
['lotte-travel','롯데카드','https://www.lottecard.co.kr/app/LPBNFDA_V300.lc?evnBultSeq=8466'],
['nh-events','NH농협카드','https://card.nonghyup.com/servlet/IpCb0005M.act'],
['bc-events','BC카드','https://www.bccard.com/app/card/EventListActn.do'],
['samsung-events','삼성카드','https://www.samsungcard.com/home/benefit/event/PGHPPCCBenefitEventViewIndex001'],
['samsung-recommend','삼성카드','https://www.samsungcard.com/personal/services/recom/UHPPPS0103M0.jsp'],
['woori-events','우리카드','https://pc.wooricard.com/dcpc/yh1/bnf/bnf01/H1BNF101S01.do'],
['woori-home','우리카드','https://pc.wooricard.com/'],
];
const textify=h=>h.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();
const rows=await Promise.all(seeds.map(async([id,issuer,url])=>{try{
 const res=await fetch(url,{signal:AbortSignal.timeout(45000),headers:{'User-Agent':'Mozilla/5.0'}});const bytes=await res.arrayBuffer();const contentType=res.headers.get('content-type')??'';
 let html=new TextDecoder(/euc-kr|ks_c_5601/i.test(contentType)?'euc-kr':'utf-8').decode(bytes); if(/charset\s*=\s*["']?(?:euc-kr|ks_c_5601)/i.test(html.slice(0,2000))) html=new TextDecoder('euc-kr').decode(bytes);
 await fs.writeFile(path.join(out,id+'.html'),html); const text=textify(html);await fs.writeFile(path.join(out,id+'.txt'),text);
 return {id,issuer,url,finalUrl:res.url,httpStatus:res.status,bytes:bytes.byteLength,checkedAt:new Date().toISOString(),title:(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]??'').trim(),textLength:text.length};
 }catch(e){return{id,issuer,url,status:'fetch_failed',error:e.message,checkedAt:new Date().toISOString()}}}));
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify(rows,null,2));
