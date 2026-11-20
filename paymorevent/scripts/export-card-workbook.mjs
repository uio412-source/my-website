import {rewardValuation,REWARD_VALUATIONS} from '../lib/reward-valuation.ts';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {Workbook,SpreadsheetFile}=await import(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/@oai/artifact-tool/dist/artifact_tool.mjs':'@oai/artifact-tool');
process.on('uncaughtException',error=>{console.error(String(error.message).slice(0,1500));process.exit(1);});
process.on('unhandledRejection',error=>{console.error(String(error?.message??error).slice(0,1500));process.exit(1);});
const root=process.env.CARD_PROJECT_ROOT;
const snapshotDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
const audit=JSON.parse(await fs.readFile(root+'/data/product-review-audit.json','utf8'));
const {cards,options}=JSON.parse(await fs.readFile(root+'/work/workbook-input.json','utf8'));
const foundation=JSON.parse(await fs.readFile(root+'/work/card-foundation.json','utf8'));
const wb=Workbook.create();
const names=['카드상품','피킹률 계산','적립 모델','혜택','실적·한도 구간','구간 수치','결제항목 판정','제외사항','공식 혜택표','상품설명서','원문 재확보','정책안내','상품별 점검','필드별 점검','DB 작성 기준'];
const sheets=Object.fromEntries(names.map(n=>[n,wb.worksheets.add(n)]));
const statuses={allowed:'가능',excluded:'제외',unknown:'미확인'};
const txt=x=>typeof x==='string'?x:JSON.stringify(x??'');
// PDF extraction can contain XML-forbidden control codes. Keep readable text,
// tabs and newlines, while stripping only characters XLSX cannot represent.
const safe=v=>{if(typeof v!=='string')return v;v=v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g,'');return v.startsWith('=')?"'"+v:v;};
const rows={};
const chunks=s=>Array.from({length:Math.max(1,Math.ceil(s.length/30000))},(_,i)=>s.slice(i*30000,(i+1)*30000));
const calculations=[],bounds={};
for(const c of cards){
 const start=calculations.length+8;
 for(const o of options[c.id]){
  const s=o.scenario,r=c.rewardRates?.find(r=>r.label===s.label);
  calculations.push([c.id,c.name,s.label,s.calculation==='unit-rate'?'적립 단위 환산':'최소 실적 월 최대',s.minimumEligibleSpend,
   r?.spendUnit??s.minimumEligibleSpend,r?.rewardUnits??s.monthlyBenefit,r?.rewardUnit??'원',r?.unitValue??1,null,r?r.monthlyCapValue:s.monthlyBenefit??null,s.assumptions.join('\n'),s.sourceUrl,(r?.feeWaiver?.verified?r.feeWaiver.rate??0:0)/100,r?.feeWaiver?.sourceUrl??'',r?.feeWaiver?.note??'',s.monthlySpend??r?.spendUnit??s.minimumEligibleSpend,r?.fallbackRewardUnits??0,r?.additionalMonthlyCapValue??null,null,null,null,r?.specialRewardCapUnits??null,r?.additionalMonthlyCapUnits??null,r?.monthlyCapUnits??null]);
 }
 if(calculations.length+7>=start)bounds[c.id]=[start,calculations.length+7];
}
rows['카드상품']=[['상품코드','카드사','상품명','구분','상품 전월실적(원) · 상태 참조','최저 연회비(원)','최저피킹률','최고피킹률','상품권 실적','상품권 혜택','국세 실적','국세 혜택','지방세 실적','지방세 혜택','관리비 실적','관리비 혜택','검토 상태','브랜드','상품 설명','공식 상품 URL','설명서 URL','전월실적 대조 상태','혜택 수','적립 모델 수','추가 모델링할 혜택'],
 ...cards.map(c=>[c.id,c.issuer,c.name,c.type==='credit'?'신용':'체크',c.minimumSpend,c.annualFeeMin,null,null,...['상품권 가능','국세','지방세','관리비'].flatMap(t=>[statuses[c.paymentEligibility[t].spend],statuses[c.paymentEligibility[t].benefit]]),c.databaseAudit?.reviewStatus??'unreviewed',c.brands.join(' · '),c.description,c.sourceUrl,c.termsUrl,c.databaseAudit?.reviewStatus==='reviewed'?'개별 대조':'추출 후보 · 혜택별 구간 대조 필요',c.benefits.length,c.rewardRates?.length??0,c.rewardCoveragePending?c.rewardCoverageNote:''])];
rows['피킹률 계산']=[['상품코드','상품명','적용 혜택','계산 방식','혜택 실적조건(원)','사용 단위(원)','혜택 단위 수','혜택 단위','단위 가치(원)','피킹률','총 월 한도(원)','한도·조건·계산 근거','공식 출처','동일 결제 수수료 면제율','수수료 공식 출처','수수료 적용 조건','계산 사용금액(원)','초과분 기본 단위','추가분 월 한도(원)','적립·할인액(원)','수수료 면제액(원)','총 혜택(원)','특별 총 적립단위 한도','추가분 적립단위 한도','총 적립단위 한도'],...calculations];
rows['혜택']=[['상품코드','상품명','혜택 고유번호','구분','혜택명','대상','요율 원문','대조한 전월실적(원)','추출 실적 후보(원)','실적 대조 상태','한도 원문','혜택 상세 원문','실적 제외','혜택 제외','문서 고유번호','공식 출처','본문 대조 상태','실제 원문 확보일'],...foundation.services.map(s=>[s.cardId,s.name,s.serviceId,s.kind==='voucher'?'바우처/연간기프트':'혜택',s.title,s.category,s.rateText,s.minimumSpend,s.minimumSpendCandidate,s.minimumSpendStatus,s.capText,s.detail,s.spendExclusions.join('\n'),s.benefitExclusions.join('\n'),s.documentId,s.sourceUrl,s.status,s.sourceCheckedAt])];
rows['실적·한도 구간']=[['상품코드','혜택 고유번호','조건 고유번호','조건 항목','원문 근거','대조 상태','문서 고유번호','공식 출처'],...foundation.constraints.map(s=>[s.cardId,s.serviceId,s.constraintId,s.field,s.quote,s.status,s.documentId,s.sourceUrl])];
rows['구간 수치']=[['상품코드','상품명','구간 고유번호','혜택 고유번호','적용 범위','표의 수치 항목','실적 하한(원)','하한 포함','실적 상한(원)','상한 포함','요율(%)','한도 수량','한도 단위','표 행·열 관계','대조 상태','원문 근거','문서/표 번호','공식 출처'],...foundation.tiers.map(r=>[r.cardId,r.name,r.tierId,r.serviceId,r.scope,r.field,r.minimumSpend,r.minimumInclusive?'이상':'초과',r.maximumSpend,r.maximumInclusive===null?'':r.maximumInclusive?'이하':'미만',r.ratePercent,r.capAmount,r.capUnit,r.relation,r.status,r.quote,r.documentId??r.tableId,r.sourceUrl])];
rows['결제항목 판정']=[['상품코드','상품명','규칙 고유번호','결제 항목','적용 범위','전월실적','혜택 제공','조건','원문 근거','판정 방법','확인일','공식 출처'],...foundation.paymentRules.map(e=>[e.cardId,e.name,e.ruleId,e.item,e.scope,statuses[e.spend],statuses[e.benefit],e.note,txt(e.evidence),e.basis??'',e.checkedAt??'',e.sourceUrl])];
rows['공식 혜택표']=[['상품코드','상품명','문서 고유번호','표 고유번호','원문 제목','원문 행 번호',...Array.from({length:8},(_,i)=>`${i+1}열`),'원문 전체 열 (JSON)','본문 확보일','공식 출처'],...foundation.sourceTables.flatMap(t=>chunks(JSON.stringify(t.cells)).map(s=>[t.cardId,t.name,t.documentId,t.tableId,t.scope,t.row,...Array.from({length:8},(_,i)=>t.cells[i]?.slice(0,30000)??''),s,t.checkedAt,t.sourceUrl]))];
rows['제외사항']=[['상품코드','상품명','제외 구분','원문 전체','공식 상품 URL'],...cards.flatMap(c=>[...c.spendExclusions.map(s=>[c.id,c.name,'전월실적 제외',s,c.sourceUrl]),...c.benefitExclusions.map(s=>[c.id,c.name,'혜택 제공 제외',s,c.sourceUrl])])];
rows['상품설명서']=[['상품코드','상품명','자료 구분','파일 형식','본문 확보','상품 일치','확인일','원문 해시','발췌 순번','공식 원문 URL','혜택·제외조건 발췌'],...cards.flatMap(c=>(c.documents??[]).flatMap(d=>chunks(JSON.stringify(d.excerpts)).map((s,i)=>[c.id,c.name,d.kind,d.format,d.readStatus,d.identityStatus,d.checkedAt,d.sha256??'',i+1,d.url,s])))];
rows['원문 재확보']=[['상품코드','상품명','문서 고유번호','자료 구분','상품 일치','본문 재확보','재확보 시도일','파일 형식','원문 해시','확보 결과·추가 대조','공식 출처'],...foundation.sourceRefresh.map(r=>[r.cardId,r.name,r.documentId,r.kind,r.identityStatus,r.readStatus,r.attemptedAt,r.format,r.sha256,r.note,r.sourceUrl])];
rows['정책안내']=[['상품코드','상품명','정책·서비스 변경 안내','공식 출처'],...cards.flatMap(c=>(c.policyNotes??[]).map(s=>[c.id,c.name,s,c.sourceUrl]))];
rows['상품별 점검']=[['상품코드','상품명','카드사',...Object.keys(audit.records[0].checks),'추가 확인 항목','검토 상태'],...audit.records.map(r=>[r.id,r.name,r.issuer,...Object.values(r.checks).map(x=>x?'확인':'확인 필요'),r.missing.join(' · '),r.reviewStatus])];
rows['필드별 점검']=[['상품코드','상품명','혜택 고유번호','적용 범위','확인할 항목','상태','안내','공식 출처'],...foundation.fieldAudit.map(r=>[r.cardId,r.name,r.serviceId,r.scope,r.field,r.status,r.note,r.sourceUrl])];
rows['DB 작성 기준']=[['구분','DB 항목','정의'],...REWARD_VALUATIONS.programs.map(p=>['평가 가치',p.label,`1 ${p.unit} = ${p.value}원 · 사용자 지정`]),...foundation.dataDictionary.map(r=>[r.group,r.field,r.definition])];
rows['적립 모델']=[['상품코드','상품명','모델 고유번호','혜택 고유번호','적용 혜택','전월실적 조건(원)','실적 범위','결제 채널','사용 단위(원)','총 적립 단위','단위 명칭','단위 가치(원)','총 월 한도(원)','초과분 기본 단위','추가분 월 한도(원)','전월 사용금액(원)','당월 계산 사용액(원)','적립·할인액(원)','수수료 면제율','수수료 면제액(원)','총 혜택(원)','해당 혜택 피킹률','카드 전체 모델 대조','공식 출처','한도·조건 근거','특별 총 적립단위 한도','추가분 적립단위 한도','총 적립단위 한도'],...foundation.models.map(r=>[r.cardId,r.name,r.modelId,r.serviceId,r.label,r.minimumSpend,r.minimumSpendScope??'원문 조건 참조',r.channel??'대상 가맹점 조건 참조',r.spendUnit,r.rewardUnits,r.rewardUnit,r.unitValue,r.monthlyCapValue,r.fallbackRewardUnits??0,r.additionalMonthlyCapValue??null,r.minimumSpend,r.minimumSpend||r.spendUnit,null,(r.feeWaiver?.verified&&r.feeWaiver.minimumSpend!==null&&r.feeWaiver.minimumSpend<=r.minimumSpend?r.feeWaiver.rate??0:0)/100,null,null,null,r.cardMaximumComplete?'대조 완료':'부분 모델 · 최고값 확정 전',r.sourceUrl,r.note,r.specialRewardCapUnits??null,r.additionalMonthlyCapUnits??null,r.monthlyCapUnits??null])];
function col(n){let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
for(const n of names){
 const sh=sheets[n],data=rows[n],start=n==='피킹률 계산'?7:5,last=start+data.length-1,end=col(data[0].length-1);
 sh.showGridLines=false;sh.getRange('A2').values=[['페이모먼트 · '+n]];sh.getRange('A2').format.font={name:'Noto Sans CJK KR',size:14,bold:true,color:'#142F46'};
 sh.getRange('A3:M3').merge();sh.getRange('A3').values=[[snapshotDay+' 기준. 미확인·원문 후보는 확정값이 아닙니다.']];sh.getRange('A3:M3').format.font={name:'Noto Sans CJK KR',size:10,color:'#546579'};sh.getRange('A3:M3').format.horizontalAlignment='left';
 // Block writes keep large source sheets fast and avoid guessing per-cell dimensions.
 const dateColumns=data[0].map((h,i)=>/확인일|확보일|시도일/.test(h)?i:-1).filter(i=>i>=0);
 for(let i=0;i<data.length;i+=1000){const block=data.slice(i,i+1000).map(row=>row.map((v,j)=>dateColumns.includes(j)&&typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?new Date(v+'T00:00:00Z'):safe(v)));sh.getRange(`A${start+i}:${end}${start+i+block.length-1}`).values=block;}
 const area=sh.getRange(`A${start}:${end}${last}`);area.format.verticalAlignment='center';area.format.rowHeight=26;area.format.columnWidth=22;
 sh.getRange(`A${start}:${end}${Math.min(last,start+8)}`).format.font={name:'Noto Sans CJK KR',size:10};
 const header=sh.getRange(`A${start}:${end}${start}`);header.format.fill='#183F5C';header.format.font={name:'Noto Sans CJK KR',size:10,bold:true,color:'#FFFFFF'};header.format.rowHeight=36;header.format.wrapText=true;
 if(last>start){sh.getRange(`B${start+1}:B${last}`).format.columnWidth=38;sh.getRange(`A${start+1}:A${last}`).format.columnWidth=24;}
 sh.freezePanes.freezeRows(start);sh.freezePanes.freezeColumns(n==='카드상품'?3:2);
 const table=sh.tables.add(`A${start}:${end}${last}`,true,'CardData'+names.indexOf(n));table.showFilterButton=true;
 for(const j of dateColumns)if(last>start)sh.getRange(`${col(j)}${start+1}:${col(j)}${last}`).setNumberFormat('yyyy-mm-dd');
 // Narrative cells retain complete source strings. Widen them for in-cell reading.
 for(let j=0;j<data[0].length;j++)if(/원문|상세|조건|근거|URL|출처|안내/.test(data[0][j])&&!/조건\(원\)/.test(data[0][j])){
  const narrative=sh.getRange(`${col(j)}${start}:${col(j)}${last}`);narrative.format.columnWidth=70;
  if(!/URL|출처/.test(data[0][j])){narrative.format.verticalAlignment='top';narrative.format.wrapText=true;if(last>start)sh.getRange(`A${start+1}:${end}${last}`).format.rowHeight=90;}
 }
 for(let j=0;j<data[0].length;j++)if(/상태|대조/.test(data[0][j])&&last>start)sh.getRange(`${col(j)}${start+1}:${col(j)}${last}`).conditionalFormats.add('containsText',{text:'확인 필요',format:{fill:'#FFF0B0',font:{color:'#8B4D00'}}});
 if(n==='실적·한도 구간'||n==='필드별 점검')sh.getRange(`B5:D${last}`).format.columnWidth=32;
 if(n==='혜택'){sh.getRange(`C5:C${last}`).format.columnWidth=32;sh.getRange(`E5:E${last}`).format.columnWidth=55;sh.getRange(`E6:F${last}`).format.wrapText=true;}
 if(n==='피킹률 계산'){sh.getRange(`C7:C${last}`).format.columnWidth=55;sh.getRange(`C8:C${last}`).format.wrapText=true;}
 if(n==='결제항목 판정')sh.getRange(`C5:C${last}`).format.columnWidth=32;
 if(n==='적립 모델'){sh.getRange(`C5:D${last}`).format.columnWidth=32;sh.getRange(`E5:E${last}`).format.columnWidth=55;sh.getRange(`E6:E${last}`).format.wrapText=true;}
 if(n==='공식 혜택표'&&last>start){sh.getRange(`G5:N${last}`).format.wrapText=true;sh.getRange(`C5:D${last}`).format.columnWidth=32;}
 if(n==='DB 작성 기준'){sh.getRange(`C5:C${last}`).format.columnWidth=95;sh.getRange(`C5:C${last}`).format.wrapText=true;area.format.autofitRows();}
 if(n==='정책안내')area.format.autofitRows();
 if(n==='카드상품'){sh.tabColor='#183F5C';sh.getRange(`C5:C${last}`).format.columnWidth=42;sh.getRange(`E6:F${last}`).setNumberFormat('#,##0');sh.getRange(`G6:H${last}`).setNumberFormat('0.00%');sh.getRange('G5:H5').format.columnWidth=18;sh.getRange(`E5:E${last}`).format.columnWidth=27;}
}
const calc=sheets['피킹률 계산'];calc.getRange('A4:G5').format.font={name:'Noto Sans CJK KR',size:10};calc.getRange('A4:B5').values=[['대한항공 1마일 가치(원)',20],['ALL 1포인트 가치(원)',30]];calc.getRange('A4:A5').format.columnWidth=33;calc.getRange('B4:B5').format.fill='#FFF0B0';calc.getRange('B4:B5').format.font={color:'#185ABD'};calc.getRange('D4:G5').merge();calc.getRange('D4').values=[['사용자 평가 가치. ALL 1포인트=30원. 연회비·바우처·연간기프트 제외.']];calc.getRange('D4:G5').format.wrapText=true;
const valuationCells={skypass:'B4',accor:'B5'};const extras=REWARD_VALUATIONS.programs.filter(p=>!valuationCells[p.id]);calc.getRange('AA4:AC4').values=[['추가 평가 가치','단위 가치(원)','평가 기준']];for(const [i,p] of extras.entries()){const n=i+5;calc.getRange(`AA${n}:AC${n}`).values=[[p.label,p.value,'사용자 지정']];valuationCells[p.id]=`AB${n}`;}calc.getRange('AA4:AC9').format.columnWidth=40;calc.getRange('AA4:AC9').format.font={name:'Noto Sans CJK KR',size:10};calc.getRange('AB5:AB9').format.fill='#FFF0B0';calc.getRange('AB5:AB9').format.font={color:'#185ABD'};
for(let i=0;i<calculations.length;i++){const row=i+8,p=rewardValuation(calculations[i][7],calculations[i][1]+' '+calculations[i][2]);if(p)calc.getRange(`I${row}`).formulas=[['=$'+valuationCells[p.id].replace(/(\d+)/,'$$$1')]];}
for(let i=0;i<calculations.length;i++){const n=i+8;if(calculations[i][23]!==null)calc.getRange(`S${n}`).formulas=[[`=X${n}*I${n}`]];if(calculations[i][24]!==null)calc.getRange(`K${n}`).formulas=[[`=Y${n}*I${n}`]];}
if(calculations.length){const last=calculations.length+7;
 calc.getRange(`T8:T${last}`).formulas=calculations.map((_,i)=>{const n=i+8;return [`=MIN(IF(ISNUMBER(K${n}),K${n},1E+99),IF(ISNUMBER(W${n}),MIN(Q${n},W${n}/G${n}*F${n})*G${n}*I${n}/F${n}+MAX(Q${n}-W${n}/G${n}*F${n},0)*R${n}*I${n}/F${n},Q${n}*R${n}*I${n}/F${n}+MIN(Q${n}*(G${n}-R${n})*I${n}/F${n},IF(ISNUMBER(S${n}),S${n},1E+99))))`];});
 calc.getRange(`U8:U${last}`).formulas=calculations.map((_,i)=>[`=Q${i+8}*N${i+8}`]);calc.getRange(`V8:V${last}`).formulas=calculations.map((_,i)=>[`=T${i+8}+U${i+8}`]);calc.getRange(`J8:J${last}`).formulas=calculations.map((_,i)=>[`=V${i+8}/Q${i+8}`]);
 calc.getRange(`J8:J${last}`).setNumberFormat('0.00%');calc.getRange(`N8:N${last}`).setNumberFormat('0.00%');calc.getRange(`E8:F${last}`).setNumberFormat('#,##0');calc.getRange(`K8:K${last}`).setNumberFormat('#,##0');calc.getRange(`Q8:V${last}`).setNumberFormat('#,##0.00');}
const model=sheets['적립 모델'];
for(let i=0;i<foundation.models.length;i++){
 const r=foundation.models[i],n=i+6;
 const p=rewardValuation(r.rewardUnit,r.name+' '+r.label);if(p)model.getRange(`L${n}`).formulas=[["='피킹률 계산'!$"+valuationCells[p.id].replace(/(\d+)/,'$$$1')]];
 if(r.additionalMonthlyCapUnits!==undefined)model.getRange(`O${n}`).formulas=[[`=AA${n}*L${n}`]];
 if(r.monthlyCapUnits!==undefined)model.getRange(`M${n}`).formulas=[[`=AB${n}*L${n}`]];
}
if(foundation.models.length){const end=foundation.models.length+5;
 model.getRange(`R6:R${end}`).formulas=foundation.models.map((_,i)=>{const n=i+6;return [`=IF(P${n}<F${n},"조건미충족",MIN(IF(ISNUMBER(M${n}),M${n},1E+99),IF(ISNUMBER(Z${n}),MIN(Q${n},Z${n}/J${n}*I${n})*J${n}*L${n}/I${n}+MAX(Q${n}-Z${n}/J${n}*I${n},0)*N${n}*L${n}/I${n},Q${n}*N${n}*L${n}/I${n}+MIN(Q${n}*(J${n}-N${n})*L${n}/I${n},IF(ISNUMBER(O${n}),O${n},1E+99)))))`];});
 model.getRange(`T6:T${end}`).formulas=foundation.models.map((_,i)=>[`=Q${i+6}*S${i+6}`]);
 model.getRange(`U6:U${end}`).formulas=foundation.models.map((_,i)=>[`=IF(ISNUMBER(R${i+6}),R${i+6}+T${i+6},"조건미충족")`]);
 model.getRange(`V6:V${end}`).formulas=foundation.models.map((_,i)=>[`=IF(Q${i+6}<=0,"사용액 입력",IF(ISNUMBER(U${i+6}),U${i+6}/Q${i+6},"조건미충족"))`]);
 model.getRange(`P6:Q${end}`).format.fill='#FFF0B0';model.getRange(`P6:Q${end}`).format.font={color:'#185ABD'};model.getRange(`S6:S${end}`).setNumberFormat('0.00%');model.getRange(`V6:V${end}`).setNumberFormat('0.00%');for(const c of ['F','I','M','O','P','Q','R','T','U'])model.getRange(`${c}6:${c}${end}`).setNumberFormat('#,##0');
}
const calcLast=calculations.length+7;
// Join by immutable product ID rather than a physical row block. Sorting the
// calculation table must not assign another card's rate to the master record.
for(let i=0;i<cards.length;i++){const id=cards[i].id.replaceAll('"','""'),b=bounds[cards[i].id];if(b)sheets['카드상품'].getRange(`G${i+6}:H${i+6}`).formulas=[[`=_xlfn.MINIFS('피킹률 계산'!$J$8:$J$${calcLast},'피킹률 계산'!$A$8:$A$${calcLast},"${id}")`,`=_xlfn.MAXIFS('피킹률 계산'!$J$8:$J$${calcLast},'피킹률 계산'!$A$8:$A$${calcLast},"${id}")`]];else sheets['카드상품'].getRange(`G${i+6}:H${i+6}`).values=[['미확인','미확인']];}
wb.recalculate();
for(const c of cards){if(!options[c.id].length)continue;const row=cards.indexOf(c)+6,v=sheets['카드상품'].getRange(`H${row}`).values[0][0];assert(Math.abs(v-Math.max(...options[c.id].map(x=>x.value))/100)<1e-10,'사이트/엑셀 불일치: '+c.id);}
const firstKey=calc.getRange('A8').values,firstRate=calc.getRange('J8').values,firstFormula=calc.getRange('J8').formulas,lastKey=calc.getRange(`A${calcLast}`).values,lastRate=calc.getRange(`J${calcLast}`).values,lastFormula=calc.getRange(`J${calcLast}`).formulas;
calc.getRange('A8').values=lastKey;calc.getRange('J8').values=lastRate;calc.getRange(`A${calcLast}`).values=firstKey;calc.getRange(`J${calcLast}`).values=firstRate;wb.recalculate();
for(const c of cards){if(!options[c.id].length)continue;const row=cards.indexOf(c)+6;assert(Math.abs(sheets['카드상품'].getRange(`H${row}`).values[0][0]-Math.max(...options[c.id].map(x=>x.value))/100)<1e-10,'상품키 정렬 검증: '+c.id);}
calc.getRange('A8').values=firstKey;calc.getRange('J8').formulas=firstFormula;calc.getRange(`A${calcLast}`).values=lastKey;calc.getRange(`J${calcLast}`).formulas=lastFormula;wb.recalculate();
const dinersModels=foundation.models.map((r,i)=>({r,row:i+6})).filter(x=>x.r.cardId==='woori-102033');
for(const [min,expected] of [[1000000,18000],[3000000,69000]]){const x=dinersModels.find(x=>x.r.minimumSpend===min);assert(Math.abs(model.getRange(`U${x.row}`).values[0][0]-expected)<1e-6);}
const tier=dinersModels.find(x=>x.r.minimumSpend===3000000);model.getRange(`Q${tier.row}`).values=[[10000000]];wb.recalculate();assert(Math.abs(model.getRange(`U${tier.row}`).values[0][0]-180000)<1e-6);model.getRange(`P${tier.row}`).values=[[1000000]];wb.recalculate();assert.equal(model.getRange(`U${tier.row}`).values[0][0],'조건미충족');model.getRange(`Q${tier.row}`).values=[[3000000]];model.getRange(`P${tier.row}`).values=[[3000000]];wb.recalculate();
console.log((await wb.inspect({kind:'region',sheetId:'적립 모델',range:`E${tier.row}:V${tier.row}`,maxChars:1800,tableMaxRows:1,tableMaxCols:20})).ndjson);
for(const [id,units,spend,expected] of [['woori-102488',2,2000000,86000],['samsung-aap1452',2,3000000,100000],['woori-103187',5,3000000,127800]]){const i=foundation.models.findIndex(r=>r.cardId===id&&r.rewardUnits===units),n=i+6,original=model.getRange(`Q${n}`).values[0][0];model.getRange(`Q${n}`).values=[[spend]];wb.recalculate();assert(Math.abs(model.getRange(`U${n}`).values[0][0]-expected)<1e-6,id+' 초과분 기본 적립');model.getRange(`Q${n}`).values=[[original]];wb.recalculate();}
// Demonstrate that value assumptions flow through calculations into the headline.
calc.getRange('B4').values=[[25]];wb.recalculate();const samsungRow=cards.findIndex(c=>c.id==='samsung-aap1452')+6;assert(Math.abs(sheets['카드상품'].getRange(`H${samsungRow}`).values[0][0]-.05)<1e-10);const everyRow=cards.findIndex(c=>c.id==='woori-102488')+6;assert(Math.abs(sheets['카드상품'].getRange(`H${everyRow}`).values[0][0]-.063)<1e-10);calc.getRange('B4').values=[[20]];wb.recalculate();
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20},maxChars:1500})).ndjson);
await fs.mkdir(root+'/work/excel-previews',{recursive:true});
for(const n of names.filter(n=>!process.env.EXCEL_RENDER_SHEETS||process.env.EXCEL_RENDER_SHEETS.split(',').includes(n))){const blob=await wb.render({sheetName:n,range:n==='피킹률 계산'?'A1:J11':n==='DB 작성 기준'?'A1:C10':'A1:F9',scale:1.5,format:'png'});await fs.writeFile(root+'/work/excel-previews/'+names.indexOf(n)+'.png',new Uint8Array(await blob.arrayBuffer()));}
const dRender=await wb.render({sheetName:'적립 모델',range:`P${tier.row-1}:V${tier.row+1}`,scale:1.5,format:'png'});await fs.writeFile(root+'/work/excel-previews/diners.png',new Uint8Array(await dRender.arrayBuffer()));
await fs.mkdir(root+'/public/downloads',{recursive:true});const out=await SpreadsheetFile.exportXlsx(wb);await out.save(root+'/public/downloads/paymorevent-card-database.xlsx');
await fs.rm(root+'/public/downloads/paymorevent-card-database.xlsx.inspect.ndjson',{force:true});
await fs.writeFile(root+'/data/database-export.json',JSON.stringify({checkedAt:snapshotDay,cardCount:cards.length,foundationSchema:2,serviceCount:foundation.services.length,modelCount:foundation.models.length},null,2)+'\n');
console.log(JSON.stringify({file:'paymorevent-card-database.xlsx',sheets:names.map(n=>({name:n,records:rows[n].length-1})),formulasRecalculated:true,valuationChangeVerified:true}));
