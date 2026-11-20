import fs from 'node:fs/promises';
const out='work/event-sources';
const extra=[
['hyundai-apb-detail','https://card.hyundaicard.com/include2026/event/apb_10.html'],
['shinhan-haru','https://www.shinhancard.com/pconts/html/benefit/event/1238686_2239.html'],
['shinhan-mrlife','https://www.shinhancard.com/pconts/html/benefit/event/1238675_2239.html'],
['shinhan-hi-point','https://www.shinhancard.com/pconts/html/benefit/event/2014020_2239.html'],
['shinhan-hi-point-plus','https://www.shinhancard.com/pconts/html/benefit/event/2014021_2239.html'],
['hana-random','https://m.hanacard.co.kr/MKEVT1010M.web?EVN_SEQ=7254'],
['hana-shinsegae','https://m.hanacard.co.kr/MKEVT1010M.web?EVN_SEQ=60592'],
['hana-ai','https://m.hanacard.co.kr/MKEVT1010M.web?EVN_SEQ=60590'],
['hana-list-ajax','https://m.hanacard.co.kr/MKEVT1000M.ajax?page=1&evnCate=00000'],
['bc-paybooc','https://web.paybooc.co.kr/app/paybooc/RNowEventList.do'],
['nh-agoda','https://card.nonghyup.com/servlet/IpCb2002R.act?EVT_CRT_SQNO=4123'],
['lotte-hilton','https://www.lottecard.co.kr/app/LPBNFDA_V300.lc?evnBultSeq=11232'],
['lotte-trip','https://www.lottecard.co.kr/app/LPBNFDA_V300.lc?evnBultSeq=8011'],
['naver-cashback','https://campaign2.naver.com/cardcashback/'],
['cardgorilla-cashback','https://www.card-gorilla.com/event'],
];
let rows=await Promise.all(extra.map(async([id,url])=>{try{let r=await fetch(url,{signal:AbortSignal.timeout(40000)});let b=await r.arrayBuffer();let h=new TextDecoder(/euc-kr/i.test(r.headers.get('content-type')??'')?'euc-kr':'utf8').decode(b);let t=h.replace(/<!--[\s\S]*?-->/g,' ').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();await fs.writeFile(`${out}/${id}.html`,h);await fs.writeFile(`${out}/${id}.txt`,t);return{id,url,httpStatus:r.status,length:t.length,checkedAt:new Date().toISOString()}}catch(e){return{id,url,error:e.message}}}));await fs.writeFile(`${out}/extra-manifest.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(rows,null,2));
