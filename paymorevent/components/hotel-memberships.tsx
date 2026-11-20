'use client';
import {useMemo,useState} from 'react';
import accor from '@/data/seoul-accor.json';
import marriott from '@/data/seoul-marriott.json';

type Hotel={id:string;name:string;district:string;stars:string;url:string;note?:string};
type Chain='accor'|'ihg'|'hotelux'|'marriott'|'hilton';
const accorInfo:Record<string,[string,string,string?]>={
'b1v3':['중구','5성','참여 혜택 확인'],b200:['영등포구','5성','페어몬트 골드 라운지 다이아몬드부터'], '9470':['용산구','5성','플래티넘 라운지'],c3e4:['강남구','5성'],b5e0:['마포구','5성'], '8002':['종로구','3성'], '6317':['중구','3성'], '3730':['강남구','3성'], '9771':['중구','4성'], '9469':['용산구','4성'],c6m1:['중구','확인 중'],b696:['마포구','4성'],c0g5:['강서구','4성'],b771:['용산구','5성','참여 혜택 확인'],a5u6:['중구','5성','플래티넘 라운지 · 조식 라운지'], '1633':['강남구','5성','플래티넘 라운지'], '9472':['용산구','5성','플래티넘 라운지'], '9473':['용산구','5성','플래티넘 라운지'],c173:['광진구','5성'],b220:['송파구','5성','플래티넘 라운지 · 조식 클럽 밀레짐'], '0966':['중구','5성','플래티넘 라운지']};
const marriottInfo:Record<string,[string,string]>={selag:['강남구','4성'],selal:['강남구','4성'],selmo:['중구','4성'],selcs:['강서구','4성'],selsn:['중구','4성'],selcy:['영등포구','4성'],selfi:['영등포구','4성'],selfd:['중구','4성'],selfp:['용산구','4성'],selfg:['강남구','4성'],selfu:['구로구','4성'],sellc:['강남구','5성'],seldp:['종로구','5성'],seljw:['서초구','5성'],selmm:['중구','5성'],sellm:['중구','4성'],selox:['종로구','3성'],selmx:['중구','4성'],seltx:['구로구','확인 중'],selak:['중구','5성'],selwi:['중구','5성'],seler:['영등포구','5성']};
const fromAccor:Hotel[]=accor.filter(p=>accorInfo[p.id.replace('accor-','')]).map(p=>{const [district,stars,note]=accorInfo[p.id.replace('accor-','')];return{id:p.id,name:p.nameKo||p.name,district,stars,url:p.url,note}});
const fromMarriott:Hotel[]=marriott.filter(p=>marriottInfo[p.id.replace('marriott-','')]).map(p=>{const [district,stars]=marriottInfo[p.id.replace('marriott-','')];return{id:p.id,name:p.nameKo||p.name,district,stars,url:p.url}});
const data:Record<Chain,Hotel[]>={accor:fromAccor,marriott:fromMarriott,ihg:[
{id:'voco-m',name:'voco 서울 명동',district:'중구',stars:'4성',url:'https://www.ihg.com/ko/seoul-korea-republic-of'},
{id:'voco-g',name:'voco 서울 강남',district:'강남구',stars:'4성',url:'https://www.ihg.com/ko/seoul-korea-republic-of'},
{id:'ihg-h',name:'홀리데이 인 익스프레스 서울 홍대',district:'마포구',stars:'4성',url:'https://www.ihg.com/holidayinnexpress/hotels/us/en/seoul/seohg/hoteldetail',note:'기본 조식 포함'},
{id:'ihg-p',name:'그랜드 인터컨티넨탈 서울 파르나스',district:'강남구',stars:'5성',url:'https://www.ihg.com/ko/seoul-korea-republic-of'}],
hilton:[{id:'conrad',name:'콘래드 서울',district:'영등포구',stars:'5성',url:'https://www.hilton.com/en/hotels/selcici-conrad-seoul/',note:'다이아몬드 라운지'},
{id:'hgi',name:'힐튼 가든 인 서울 강남',district:'서초구',stars:'4성',url:'https://www.hilton.com/en/hotels/selgigi-hilton-garden-inn-seoul-gangnam/'},
{id:'hotel28',name:'호텔28 명동 (SLH)',district:'중구',stars:'확인 중',url:'https://www.hilton.com/en/locations/south-korea/seoul/',note:'SLH 별도 약관'}],hotelux:[]};
const tabs:[Chain,string][]=[['accor','Accor'],['ihg','IHG'],['hotelux','HOTELLUX'],['marriott','Marriott'],['hilton','Hilton']];
const links:Record<Chain,string>={accor:'https://all.accor.com/loyalty-program/cards-status-benefits-details/index.ko.shtml',ihg:'https://www.ihg.com/onerewards/content/us/en/benefits',hotelux:'https://www.hotelux.com/',marriott:'https://www.marriott.com/loyalty/member-benefits.mi',hilton:'https://www.hilton.com/ko/hilton-honors/member-benefits/'};
const tiers:Record<Chain,string[]>={accor:['실버','골드','플래티넘','다이아몬드'],ihg:['실버','골드','플래티넘','다이아몬드'],marriott:['실버','골드','플래티넘','티타늄'],hilton:['실버','골드','다이아몬드'],hotelux:[]};
function benefit(c:Chain,t:string,h:Hotel){
 if(c==='accor') {if(h.note==='참여 혜택 확인') return '호텔별 ALL 참여 및 등급 혜택 확인';
 if(t==='실버')return '레이트 체크아웃 가능';
 if(t==='골드')return '객실 업그레이드 · 얼리 또는 레이트';
 const lounge=h.note?.includes('페어몬트')?(t==='다이아몬드'?' · 골드 라운지':' · 골드 라운지 제외'):h.note?.includes('플래티넘 라운지')?' · 라운지':h.note?.includes('라운지 조건')?' · 라운지 확인':'';
 return '조식(참여 호텔) · 객실 업그레이드 · 얼리/레이트'+lounge+(h.note?.includes('조식')?' (조식 라운지)':'');}
 if(c==='ihg'){if(t==='다이아몬드')return '조식 선택 가능 · 객실 업그레이드 · 레이트 체크아웃';if(t==='플래티넘')return '객실 업그레이드 · 레이트 체크아웃';return '레이트 체크아웃 · 호텔 조건 확인';}
 if(c==='marriott'){if(t==='실버')return '레이트 체크아웃 가능';if(t==='골드')return '객실 업그레이드 · 오후 2시 체크아웃 가능';return '객실 업그레이드 · 오후 4시 체크아웃 · 조식/라운지 브랜드별 상이';}
 if(h.id==='hotel28')return 'SLH 별도 조건 · 공식 약관 확인';if(t==='실버')return '레이트 체크아웃 가능';if(t==='골드')return '조식 선택 · 객실 업그레이드';return '조식 · 객실 업그레이드'+(h.id==='conrad'?' · 라운지':' · 라운지 운영 시 이용');}
export function HotelMemberships({query}:{query:string}){const [chain,setChain]=useState<Chain>('accor');const [tier,setTier]=useState('플래티넘');const [district,setDistrict]=useState('전체');
 const items=useMemo(()=>data[chain].filter(h=>(district==='전체'||h.district===district)&&[h.name,h.district].join(' ').toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>a.district.localeCompare(b.district,'ko')||a.name.localeCompare(b.name,'ko')),[chain,district,query]);
 function select(c:Chain){setChain(c);setDistrict('전체');setTier(c==='hilton'?'다이아몬드':c==='marriott'?'플래티넘':'플래티넘')}
 return <section className="hotel-directory"><div className="hotel-chain-tabs" aria-label="호텔 프로그램">{tabs.map(([id,label])=><button key={id} onClick={()=>select(id)} aria-pressed={chain===id}>{label}</button>)}</div><div className="hotel-controls"><label>국가<select value="한국" onChange={()=>{}}><option>한국</option></select></label><label>도시<select value="서울" onChange={()=>{}}><option>서울</option></select></label><label>구<select value={district} onChange={e=>setDistrict(e.target.value)}><option>전체</option>{[...new Set(data[chain].map(h=>h.district))].sort().map(d=><option key={d}>{d}</option>)}</select></label>{chain!=='hotelux'&&<label>등급<select value={tier} onChange={e=>setTier(e.target.value)}>{tiers[chain].map(t=><option key={t}>{t}</option>)}</select></label>}</div>
 {chain==='hotelux'?<div className="hotel-empty"><strong>서울 제휴 호텔 확인 중</strong><p>HOTELLUX는 호텔 체인이 아닌 예약 플랫폼으로, 예약 상품에 따라 혜택이 달라집니다. 확인된 목록을 준비하고 있습니다.</p><a href={links.hotelux} target="_blank" rel="noreferrer">HOTELLUX 확인 ↗</a></div>:<><div className="hotel-list-head"><strong>서울 호텔 {items.length}곳</strong><a href={links[chain]} target="_blank" rel="noreferrer">등급별 공식 혜택 ↗</a></div><div className="hotel-table-wrap"><table className="hotel-directory-table"><thead><tr><th>구</th><th>호텔 이름</th><th>성급</th><th>{tier} 혜택</th></tr></thead><tbody>{items.map(h=><tr key={h.id}><td>{h.district}</td><td><a href={h.url} target="_blank" rel="noreferrer">{h.name} ↗</a></td><td>{h.stars}</td><td>{benefit(chain,tier,h)}{h.note==='기본 조식 포함'&&<small> · 기본 조식 포함</small>}</td></tr>)}</tbody></table>{!items.length&&<p className="hotel-empty">검색 결과가 없습니다.</p>}</div><p className="hotel-footnote">업그레이드와 체크인·체크아웃은 객실 상황에 따라 달라집니다. 혜택은 적격 예약, 브랜드 및 호텔별 조건이 적용됩니다. {chain==='ihg'?'IHG 라운지는 등급 자체가 아닌 별도 연간 라운지 멤버십 선택이 필요합니다. ':''}{chain==='accor'?'조식은 참여 호텔 기준이며, 라운지 표시는 공식 목록 확인 호텔에 한합니다. ':''}최종 조건은 예약 전 호텔에 확인하세요.</p></>}
 </section>}
