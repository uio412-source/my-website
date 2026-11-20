import {applyRewardValuations,rewardValuation} from '@/lib/reward-valuation';
import type {Card} from '@/lib/catalog-types';
import {bestPicking,formatPicking,pickingRange} from '@/lib/catalog-model';
export function PickingDetail({card}:{card:Card}){
 card=applyRewardValuations(card);
 const voucherTitles=card.benefits.filter(b=>b.kind==='voucher'||/바우처|연간\s*기프트|기프트\s*제공|선택\s*서비스/i.test(b.category+' '+b.title)).map(b=>b.title);
 const pickingCard={...card,rewardRates:card.rewardRates?.filter(r=>!voucherTitles.some(title=>(r.serviceTitle??r.label).includes(title)))};
 const best=bestPicking(pickingCard),range=pickingRange(pickingCard);
 const pendingReason=card.sourceReviewPending?'변경된 공식 원문 대조 필요':!(card.rewardRates?.length||card.spendingPlans?.length)?'적립·할인 수치 모델 미등록':card.rewardCoveragePending?'전체 금전 혜택 모델·한도 대조 미완료':'실적 구간·공유 한도·수수료 조건 추가 검증 필요';
 const program=rewardValuation('포인트',card.name);
 const valuations=Array.from(new Set((card.rewardRates??[]).filter(r=>r.verified&&r.rewardUnit!=='원').map(r=>`${r.rewardUnit} 1단위 = ${r.unitValue.toLocaleString('ko-KR')}원`)));
 if(!valuations.length&&program&&program.id!=='cash')valuations.push(`${program.label} 1 ${program.unit} = ${program.value}원`);
 const base=Math.max(0,...(pickingCard.rewardRates??[]).filter(r=>r.verified&&/기본|일반/.test(r.label)).map(r=>r.rewardUnits*r.unitValue/r.spendUnit*100));
 const special=best?Math.max(0,best.value-base):0;
 const total=range?(range.min===range.max?`${formatPicking(range.max)}%`:`${formatPicking(range.min)}%~${formatPicking(range.max)}%`):null;
 return <section className="pm-section picking-section pm-picking-simple" id="picking"><h2>전월실적 최소 충족 소비 시 피킹률</h2>{best&&total?<><p className="pm-picking-formula"><span>기본혜택 <strong>{formatPicking(base)}%</strong></span><b>+</b><span>특별적립 최대 <strong>{formatPicking(special)}%</strong></span><b>=</b><em>{total}</em></p><p className="pm-picking-note">월간 적립·할인과 같은 결제의 확인된 수수료 면제를 반영합니다. 바우처·연회비·연간 보너스는 제외합니다.</p>{valuations.length>0&&<p className="pm-picking-note">환산 기준 · {valuations.join(' · ')}</p>}</>:<div className="pm-simple-message">피킹률 계산 검토 중 · {pendingReason}</div>}</section>;
}
