import type {Card,EligibilityRule} from '@/lib/catalog-types';
import {PAYMENT_RULE_THEMES,paymentEligibility} from '@/lib/card-themes';

const label={allowed:'가능',excluded:'불가',unknown:'미확인'};
function Status({value}:{value:keyof typeof label}){return <span className={'pm-rule-status eligibility-'+value}><i aria-hidden="true"/>{label[value]}</span>}

function RuleSource({rule}:{rule:Pick<EligibilityRule,'note'|'limit'|'channel'|'sourceUrl'>}){return <details className="pm-rule-condition"><summary>근거 보기</summary><p>{rule.note}</p>{rule.limit&&<p>한도: {rule.limit}</p>}{rule.channel&&<p>거래 조건: {rule.channel}</p>}<a className="pm-inline-source" href={rule.sourceUrl} target="_blank" rel="noopener noreferrer">근거 원문 ↗</a></details>}

function ScopedRules({scope,rules}:{scope:string;rules:EligibilityRule[]}){
 const showBenefit=rules.some(r=>r.benefit!=='unknown');
 return <section className="pm-eligibility-scope"><h4>{scope}</h4><table className="pm-info-table"><thead><tr><th>결제 항목</th><th>실적 산정</th>{showBenefit&&<th>혜택 제공</th>}</tr></thead><tbody>{rules.map((r,i)=><tr key={r.item+'-'+i}><th>{r.item}<RuleSource rule={r}/></th><td><Status value={r.spend}/></td>{showBenefit&&<td><Status value={r.benefit}/></td>}</tr>)}</tbody></table></section>;
}

export function PaymentEligibilityTable({card}:{card:Card}){
 const rows=PAYMENT_RULE_THEMES.map(t=>({theme:t,...paymentEligibility(card,t)}));
 const groups=Object.entries((card.eligibilityRules??[]).reduce<Record<string,EligibilityRule[]>>((all,rule)=>{(all[rule.scope]??=[]).push(rule);return all;},{}));
 return <div className="pm-eligibility-matrix">
  <div className="pm-eligibility-heading"><div><h3>결제 항목별 인정 여부</h3><small>같은 결제도 전월실적·적립·연간/부가혜택에 따라 다르게 판정합니다.</small></div><p><span><i className="allowed"/>가능</span><span><i className="excluded"/>불가</span><span><i className="unknown"/>미확인</span></p></div>
  <section className="pm-eligibility-scope"><h4>대표 전월실적 · 기본 적립/할인</h4><table className="pm-info-table"><thead><tr><th>결제 항목</th><th>전월실적</th><th>혜택 제공</th></tr></thead><tbody>{rows.map(e=><tr key={e.theme}><th>{e.theme}{e.scope&&<small className="pm-rule-scope">{e.scope}</small>}<RuleSource rule={e}/></th><td><Status value={e.spend}/></td><td><Status value={e.benefit}/></td></tr>)}</tbody></table></section>
  {groups.length>0&&<div className="pm-scope-rules"><h3>부가혜택별 별도 기준</h3>{groups.map(([scope,rules])=><ScopedRules key={scope} scope={scope} rules={rules}/>)}</div>}
  {(card.spendExclusions.length>0||card.benefitExclusions.length>0)&&<details className="pm-raw-exclusions"><summary>카드사 원문 제외 문구</summary>{card.spendExclusions.length>0&&<><strong>전월실적 제외</strong><ul>{card.spendExclusions.map((x,i)=><li key={'s'+i}>{x}</li>)}</ul></>}{card.benefitExclusions.length>0&&<><strong>혜택 제공 제외</strong><ul>{card.benefitExclusions.map((x,i)=><li key={'b'+i}>{x}</li>)}</ul></>}</details>}
 </div>;
}
