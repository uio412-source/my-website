import {applyRewardValuations} from '@/lib/reward-valuation';
import type {Card} from '@/lib/catalog-types';
import {formatPicking,pickingOptions} from '@/lib/catalog-model';

const money=(amount:number)=>amount.toLocaleString('ko-KR',{maximumFractionDigits:0})+'원';

/** 전월 실적 구간별 최대 피킹률(바우처성 혜택 제외). 카드 상세 위쪽의 최고피킹률과 아래 표가 같은 값을 씀 */
export function pickingSummary(input:Card){
 const card=applyRewardValuations(input);
 const voucherTitles=card.benefits.filter(b=>b.kind==='voucher'||/바우처|연간\s*기프트|기프트\s*제공/.test(b.category+' '+b.title)).map(b=>b.title);
 const options=pickingOptions({...card,rewardRates:card.rewardRates?.filter(rule=>!voucherTitles.some(title=>(rule.serviceTitle??rule.label).includes(title)))});
 const byTier=new Map<number,typeof options[number]>();
 for(const option of options){
  const threshold=option.scenario.minimumEligibleSpend;
  if(threshold==null)continue;
  const previous=byTier.get(threshold);
  if(!previous||option.value>previous.value)byTier.set(threshold,option);
 }
 const tiers=[...byTier].sort(([a],[b])=>a-b);
 return {card,tiers,max:tiers.length?Math.max(...tiers.map(([,option])=>option.value)):null};
}

export function PickingDetail({card:input}:{card:Card}){
 const {card,tiers}=pickingSummary(input);
 const valuations=[...new Set((card.rewardRates??[]).filter(r=>r.verified&&r.rewardUnit!=='원').map(r=>r.rewardUnit+' 1단위 = '+r.unitValue.toLocaleString('ko-KR')+'원'))];
 const reason=card.sourceReviewPending?'변경된 공식 원문 대조 필요':card.rewardCoveragePending?'금전 혜택 모델·한도 대조 필요':'실적·공유 한도·수수료 조건 확인 필요';
 return <section className="pm-section picking-section pm-picking-simple" id="picking">
  <h2>최소 실적 기준 최대 피킹률</h2>
  {tiers.length ? <>
   <p className="pm-picking-note">전월 인정 실적과 당월 소비액을 구분합니다. 각 구간의 최대 적립·할인과 해당 결제의 수수료 면제를 반영합니다. 연회비·바우처·연간 보너스는 계산에서 제외합니다.</p>
   <table className="pm-info-table"><thead><tr><th>전월 인정 실적</th><th>당월 소비 예시</th><th>월 혜택</th><th>최대 피킹률</th></tr></thead>
    <tbody>{tiers.map(([threshold,{value,scenario}])=><tr key={threshold}>
     <th scope="row">{threshold===0?'무실적':money(threshold)+'부터'}</th>
     <td>{scenario.monthlySpend==null?'이용금액 비례':money(scenario.monthlySpend)}</td>
     <td>{scenario.monthlyBenefit==null?'이용금액에 따라':money(scenario.monthlyBenefit)}</td>
     <td><strong>{formatPicking(value)}%</strong></td>
    </tr>)}</tbody>
   </table>
   <div className="pm-accordions">{tiers.map(([threshold,{scenario}])=><details key={threshold}>
    <summary>{threshold===0?'무실적':money(threshold)} 계산 조건</summary>
    <p>{scenario.label}</p>
    {scenario.components?.length ? <ul>{scenario.components.map((component,i)=><li key={i}>{component.label} · {money(component.amount)} · {component.cap}</li>)}</ul> : null}
    <ul>{scenario.assumptions.map((assumption,i)=>assumption&&<li key={i}>{assumption}</li>)}</ul>
    {scenario.sourceUrl&&<a href={scenario.sourceUrl} target="_blank" rel="noopener noreferrer">카드사 근거</a>}
   </details>)}</div>
   {valuations.length>0&&<p className="pm-picking-note">환산 기준 · {valuations.join(' · ')}</p>}
  </>:<div className="pm-simple-message">피킹률 계산 검토 중 · {reason}</div>}
 </section>;
}
