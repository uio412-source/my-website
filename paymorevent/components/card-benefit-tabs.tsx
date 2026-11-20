'use client';
import {useState} from 'react';
import type {Benefit,NetworkService} from '@/lib/catalog-types';
import {customerLines,customerSpend} from '@/lib/customer-copy';
import {shortText} from '@/lib/card-presentation';

const networkScope:Record<string,string>={domestic_airports:'국내 공항',worldwide_airports:'전 세계 공항',incheon_airport:'인천공항',domestic_hotels:'국내 호텔',domestic:'국내',other:'기타'};
const matinaGold:Record<string,string>={included:'무료 이용 가능',discounted:'할인 이용',excluded:'무료 이용 제외',unknown:'확인 중',not_applicable:'해당 없음'};
const audience=(holder:boolean|null,guests:number|null)=>holder===null?'대상 확인 중':holder?(guests&&guests>0?`본인 + 동반 ${guests}인`:'본인'):'동반인';
const limitText=(s:NetworkService)=>[s.dailyLimit&&`일 ${s.dailyLimit}회`,s.monthlyLimit&&`월 ${s.monthlyLimit}회`,s.annualLimit&&`연 ${s.annualLimit}회`].filter(Boolean).join(' · ')||'횟수 제한 없음';
const useful=(value:string|null|undefined)=>!!value&&value.trim()!==''&&!/^[-—]$/.test(value.trim());
const isVoucher=(b:Benefit)=>b.kind==='voucher'||/바우처|연간\s*기프트|기프트\s*제공|선택\s*서비스/i.test(b.category+' '+b.title);
function Lines({value}:{value:string}){return <div className="pm-lines">{customerLines(value).map((line,i)=><p key={i}>{line}</p>)}</div>}

function CardBenefits({benefits}:{benefits:Benefit[]}){
 const regular=benefits.filter(b=>!isVoucher(b)&&useful(b.title));
 const vouchers=benefits.filter(b=>isVoucher(b)&&useful(b.title));
 return <div className="pm-benefit-panel" role="tabpanel" id="card-benefits-panel" aria-labelledby="card-benefits-tab">
  {regular.length?<div className="pm-benefit-table pm-card-benefit-table"><table><caption className="sr-only">카드 혜택과 적용 조건</caption><thead><tr><th>혜택</th><th>할인·적립 / 한도</th><th>전월실적</th></tr></thead>{regular.map((b,i)=><tbody key={b.title+'|'+i}><tr className="pm-benefit-summary"><th scope="row"><span className="pm-benefit-number">{i+1}.</span>{b.title}</th><td data-label="할인·적립 / 한도"><div className="pm-benefit-value">{useful(b.rate)?<strong>{b.rate}</strong>:<span className="pm-muted">혜택률 확인 중</span>}{useful(b.cap)?<small>한도 {shortText(b.cap!,80)}</small>:<small className="pm-muted">한도 확인 중</small>}</div></td><td data-label="전월실적">{customerSpend(b)==='—'?<span className="pm-muted">조건 확인 중</span>:customerSpend(b)}</td></tr>{!!(useful(b.detail)||b.spendExclusions?.length||b.benefitExclusions?.length)&&<tr className="pm-benefit-full"><td colSpan={3}><details><summary>세부 이용 조건</summary>{useful(b.detail)&&<Lines value={b.detail}/>} {!!b.spendExclusions?.length&&<div className="pm-condition-cap"><strong>전월실적 제외</strong><Lines value={b.spendExclusions.join('; ')}/></div>}{!!b.benefitExclusions?.length&&<div className="pm-condition-cap"><strong>혜택 제공 제외</strong><Lines value={b.benefitExclusions.join('; ')}/></div>}</details></td></tr>}</tbody>)}</table></div>:<div className="pm-simple-message">확인된 카드 혜택을 정리하고 있습니다.</div>}
  {!!vouchers.length&&<div className="pm-vouchers"><strong>바우처</strong>{vouchers.map((b,i)=><p key={i}>{b.title}{useful(b.detail)&&b.detail!==b.title?` · ${shortText(b.detail,150)}`:''}</p>)}<small>바우처 가치는 피킹률 계산에 포함하지 않습니다.</small></div>}
 </div>;
}

function NetworkBenefits({services}:{services:NetworkService[]}){
 return <div className="pm-benefit-panel" role="tabpanel" id="network-benefits-panel" aria-labelledby="network-benefits-tab">
  {services.length?<div className="pm-benefit-table"><table><caption className="sr-only">국제브랜드 서비스 대상과 조건</caption><thead><tr><th>국제브랜드 혜택</th><th>이용 범위</th><th>이용 대상</th><th>실적·횟수</th></tr></thead>{services.map(s=><tbody key={s.id}><tr className="pm-benefit-summary"><th scope="row"><small>{s.network} · {s.tier}</small><br/>{s.title}</th><td data-label="이용 범위"><strong>{networkScope[s.scope]??s.scope}</strong>{s.category==='airport_lounge'&&<><br/><span className="pm-muted">마티나골드: {matinaGold[s.matinaGold]}</span></>}</td><td data-label="이용 대상">{audience(s.holderIncluded,s.guestCount)}</td><td data-label="실적·횟수">{s.minimumSpend===null?'실적 조건 없음':`${(s.minimumSpend/10000).toLocaleString('ko-KR')}만원 이상`}<br/>{limitText(s)}</td></tr><tr className="pm-benefit-full"><td colSpan={4}><details><summary>대상처·이용 조건</summary><p>{s.coverageText}</p>{s.sharedLimitGroup&&<p><strong>통합 한도:</strong> {s.sharedLimitGroup}</p>}{s.conditions.length>0&&<ul>{s.conditions.map((c,i)=><li key={i}>{c}</li>)}</ul>}<a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">공식 안내 원문 ↗</a></details></td></tr></tbody>)}</table></div>:<div className="pm-simple-message">이 상품의 국제브랜드·등급별 서비스를 확인하고 있습니다.</div>}
 </div>;
}

export function CardBenefitTabs({benefits,networkServices=[]}:{benefits:Benefit[];networkServices?:NetworkService[]}){
 const [tab,setTab]=useState<'card'|'network'>('card');
 return <section className="pm-section pm-benefit-tabs" id="benefits"><div className="pm-tab-buttons" role="tablist" aria-label="혜택 구분"><button id="card-benefits-tab" role="tab" aria-selected={tab==='card'} aria-controls="card-benefits-panel" onClick={()=>setTab('card')}>카드혜택</button><button id="network-benefits-tab" role="tab" aria-selected={tab==='network'} aria-controls="network-benefits-panel" onClick={()=>setTab('network')}>국제브랜드 혜택</button></div>{tab==='card'?<CardBenefits benefits={benefits}/>:<NetworkBenefits services={networkServices}/>}</section>;
}
