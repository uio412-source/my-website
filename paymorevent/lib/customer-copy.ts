import type {Card,Benefit} from './catalog-types';
import {cardThemes,paymentEligibility} from './card-themes';
const cleanTag=(value:string)=>value.replace(/^#+/,'').trim();
export function featureTags(card:Card){
 const benefitText=card.benefits.map(b=>b.category+' '+b.title+' '+b.detail).join(' ');
 const serviceText=JSON.stringify(card.networkServices??[]);
 const text=[card.name,benefitText,serviceText].join(' ');
 const controlled=new Set(['상품권','상품권 가능','관리비','국세','지방세','세금']);
 const tags=new Set([...card.tags.map(cleanTag).filter(tag=>tag&&!controlled.has(tag)),...cardThemes(card)].map(cleanTag).filter(Boolean));
 if(card.minimumSpend===0)tags.add('무실적');
 if(/마티나\s*골드/i.test(text))tags.add('마티나골드');
 if(/K[-\s]?패스|K[-\s]?PASS/i.test(text))tags.add('K패스');
 if(/해외|외화/.test(benefitText+' '+serviceText))tags.add('해외');
 if(/호텔|리조트|숙박/.test(benefitText+' '+serviceText))tags.add('호텔');
 if(/라운지/.test(benefitText+' '+serviceText))tags.add('라운지');
 const gift=paymentEligibility(card,'상품권 가능');
 if(gift.benefit==='allowed'){tags.add('상품권');tags.add('상품권 가능');}
 const national=paymentEligibility(card,'국세'),local=paymentEligibility(card,'지방세');
 if(national.spend==='allowed'||national.benefit==='allowed'||local.spend==='allowed'||local.benefit==='allowed')tags.add('세금');
 return [...tags];
}
export function browseThemes(card:Card){
 const text=[...card.tags,...card.benefits.map(b=>b.title+' '+b.category)].join(' ');const tags=new Set(featureTags(card));
 if(card.minimumSpend===0)tags.add('무실적');
 if(/쇼핑|마트|백화점|쿠팡|온라인몰|네이버|편의점/.test(text))tags.add('쇼핑');
 if(/커피|카페|스타벅스|투썸|이디야|메가커피/.test(text))tags.add('커피');
 if(/교통|버스|지하철|택시|K-패스|K패스/.test(text))tags.add('교통');
 if(/라운지/.test(text))tags.add('라운지');
 return [...tags];
}
export function customerLines(value:string){
 return value.split(/\n|\s*;\s*|\s+※\s*|\s+▶\s*/).map(v=>v.trim()).filter(v=>v&&!/^(?:실적 확인[:：]|공식 공통|확인 범위[:：]|수집 범위[:：]|출처[:：]|자료 확인[:：]|공식 목록의|공식 안내에서 대상.*(?:확인|참조)|세부 조건은.*(?:확인|참조)|자세한 내용은.*(?:확인|참조))/.test(v)).map(v=>v.replace(/발급 시 유의 사항 닫기 열기/g,'').trim()).filter(Boolean);
}
export function customerSpend(b:Benefit){
 const explicit=/무실적|실적.{0,5}(?:관계없|상관없|조건없|제한없)/.test(b.title+' '+b.detail);
 if(b.minimumSpend===null||(b.minimumSpend===0&&!b.minimumSpendVerified&&!explicit))return '—';
 return b.minimumSpend===0?'무실적':`${(b.minimumSpend/10000).toLocaleString('ko-KR')}만원 이상`;
}
