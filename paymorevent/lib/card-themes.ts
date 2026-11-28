import {applyRewardValuations} from './reward-valuation';
import type {Card} from './catalog-types';
export const ELIGIBILITY_THEMES=['상품권 가능','관리비','국세','지방세'] as const;
const ELIGIBILITY_SEARCH_TAGS=new Set<string>([...ELIGIBILITY_THEMES,'상품권','세금']);
export const PAYMENT_RULE_THEMES=['상품권·선불카드 충전','아파트 관리비','국세','지방세','공과금','4대보험','등록금','무이자할부','연회비·수수료','할인받은 이용금액'] as const;
export type PaymentEligibility={spend:'allowed'|'excluded'|'unknown';benefit:'allowed'|'excluded'|'unknown';sourceUrl:string;note:string;scope?:string;checkedAt?:string;basis?:'explicit'|'full_exclusion_list'|'manual'|'extracted';evidence?:string;limit?:string;channel?:string};
const aliases:Record<string,string[]>={'상품권·선불카드 충전':['상품권 가능','상품권'],'아파트 관리비':['관리비']};
const patterns:Record<string,RegExp>={'상품권 가능':/상품권|기프트카드|선불카드|선불전자지급수단/i,'상품권·선불카드 충전':/상품권|기프트카드|선불카드|선불전자지급수단/i,'관리비':/관리비|APT\s*관리비/i,'아파트 관리비':/관리비|APT\s*관리비/i,'국세':/국세|제세공과금|각종\s*세금|국가\/?공공기관|공공단체/,'지방세':/지방세|제세공과금|각종\s*세금|국가\/?공공기관|공공단체/,'공과금':/전기요금|도시가스|상하수도|공과금/i,'4대보험':/4대\s*보험|사대보험|건강보험|국민연금|고용보험|산재보험/i,'등록금':/대학(?:교)?\s*등록금|등록금|학비/i,'무이자할부':/무이자\s*할부/i,'연회비·수수료':/연회비|카드\s*수수료|이자|연체료/i,'할인받은 이용금액':/할인(?:이)?\s*적용된?\s*(?:매출|이용금액|결제)|할인받은\s*(?:매출|이용금액|결제)/i};
export function paymentEligibility(c:Card,theme:string):PaymentEligibility{
 const saved=c.paymentEligibility?.[theme]??aliases[theme]?.map(x=>c.paymentEligibility?.[x]).find(Boolean);if(saved)return saved;
 const re=patterns[theme];if(!re)return {spend:'unknown',benefit:'unknown',sourceUrl:c.sourceUrl,note:'자료 미확인'};
 return {spend:c.spendExclusions.some(x=>re.test(x))?'excluded':'unknown',benefit:c.benefitExclusions.some(x=>re.test(x))?'excluded':'unknown',sourceUrl:c.conditionEvidence?.url??c.sourceUrl,note:'원문에서 제외 여부를 확인합니다. 일부 발췌에 단어가 없다는 이유로 가능 판정하지 않습니다.'};
}
/** "이렇게 써도 될까?" 표에 보여 줄 결제 항목. 사람들이 가장 많이 묻는 순서. */
export const PAYMENT_CHECKS=[
 {key:'관리비',label:'아파트 관리비'},
 {key:'4대보험',label:'4대보험',hint:'건강·연금·고용·산재'},
 {key:'국세',label:'국세',hint:'소득세·부가세 등'},
 {key:'지방세',label:'지방세',hint:'재산세·자동차세 등'},
 {key:'공과금',label:'전기·가스·수도'},
 {key:'자동차 구매',label:'자동차 구매',hint:'딜러 카드결제 한도는 따로 확인'},
 {key:'상품권 가능',label:'상품권·선불 충전'},
 {key:'등록금',label:'등록금·학교 납입금'},
 {key:'임대료',label:'월세·임대료'},
 {key:'무이자할부',label:'무이자할부'},
 {key:'할인받은 이용금액',label:'혜택받은 결제',hint:'할인·적립받은 결제도 실적에 들어가는지',spendOnly:true},
] as const;
const CHECK_PATTERNS:Record<string,RegExp>={
 '4대보험':/4대\s*(?:사회\s*)?보험|사회\s*보험|국민건강보험|건강보험료|국민연금|고용보험|산재보험/,
 '공과금':/전기\s*요금|도시가스|상하수도|수도\s*요금|공과금/,
 '자동차 구매':/자동차\s*(?:구매|구입|매매|판매)|신차\s*구매|중고차|차량\s*(?:구매|구입)/,
 '등록금':/등록금|학교\s*납입금|학부모\s*(?:부담|분담)금|수업료/,
 '임대료':/임대료|월세/,
 '무이자할부':/무이자\s*할부/,
 '할인받은 이용금액':/(?:할인|적립|혜택)[^,，。;\n]{0,25}(?:받은|적용(?:된|받은)?|제공된)\s*(?:전체\s*)?(?:이용|매출|결제|금액|건|전표)/,
};
export type PaymentCheck={spend:PaymentEligibility['spend'];benefit:PaymentEligibility['benefit']|'na';spendEvidence?:string;benefitEvidence?:string};
const snippet=(texts:string[],re:RegExp)=>{for(const t of texts){const m=re.exec(t);if(m){const a=Math.max(0,m.index-40),b=Math.min(t.length,m.index+m[0].length+40);return (a?'…':'')+t.slice(a,b).replace(/\s+/g,' ').trim()+(b<t.length?'…':'');}}return undefined;};
/** 저장된 판정(상품권·관리비·국세·지방세)은 그대로 쓰고, 나머지는 원문 제외 목록에서 찾습니다.
 * 제외 목록 전체를 확인한 카드(full_exclusion_list)만 '목록에 없음 = 인정'으로 봅니다. */
export function paymentCheck(c:Card,key:string):PaymentCheck{
 const spendOnly=key==='할인받은 이용금액';
 const re=CHECK_PATTERNS[key];
 const free=spendFreeCard(c);
 // 무실적 카드는 실적 칸을 ✓로 두고, 누르면 이유를 보여 줍니다(?로 남겨 오해를 사지 않게)
 const freeNote=free?SPEND_FREE_NOTE:undefined;
 if(!re){const saved=paymentEligibility(c,key),e=paymentVerdict(c,key),lines=(saved.evidence??'').split('\n'),pr=patterns[key]??/$^/;return {spend:e.spend,benefit:e.benefit,spendEvidence:e.spend==='excluded'?snippet(lines.slice(0,1),pr)??snippet(c.spendExclusions,pr):e.spend==='allowed'?freeNote:undefined,benefitEvidence:e.benefit==='excluded'?snippet(lines.slice(-1),pr)??snippet(c.benefitExclusions,pr):undefined};}
 const complete=Object.values(c.paymentEligibility??{}).some(e=>e.basis==='full_exclusion_list');
 const spendEvidence=snippet(c.spendExclusions,re),benefitEvidence=spendOnly?undefined:snippet(c.benefitExclusions,re);
 const spend=spendEvidence||(spendOnly&&c.benefitSpendExcluded)?'excluded':complete?'allowed':free?'allowed':'unknown';
 return {spend,benefit:spendOnly?'na':benefitEvidence?'excluded':complete?'allowed':'unknown',spendEvidence:spendEvidence??(spend==='allowed'?freeNote:undefined),benefitEvidence};
}
export function scopedPaymentEligibility(c:Card,theme:string):PaymentEligibility[]{
 const re=patterns[theme];
 return (c.eligibilityRules??[]).filter(rule=>rule.item===theme||aliases[theme]?.includes(rule.item)||!!re?.test(rule.item));
}
/** 전월 이용금액 조건이 아예 없는 카드(무실적). 카드 값과 혜택·요율·배분 어디에도 양수 실적 조건이 없을 때만 참.
 * 이런 카드는 어떤 결제든 실적을 채울 필요가 없어서 '실적 ?'로 두면 오해만 생깁니다(2026-11-28 삼성 앤마일리지). */
export function spendFreeCard(c:Pick<Card,'minimumSpend'|'benefits'|'rewardRates'|'spendingPlans'>):boolean{
 if(c.minimumSpend!==0)return false;
 const spends=[
  ...c.benefits.map(b=>b.minimumSpend),
  ...(c.rewardRates??[]).map(r=>r.minimumSpend),
  ...(c.spendingPlans??[]).map(p=>p.minimumSpend),
 ];
 return !spends.some(v=>typeof v==='number'&&v>0);
}
/** 무실적 카드에서 '실적 인정'이 뜻하는 것(표 아래·줄을 누를 때 보여 줄 설명) */
export const SPEND_FREE_NOTE='전월 이용금액 조건이 없는 카드예요 — 이 결제로 채울 실적이 없어 실적을 따지지 않아요.';
/** 카드 단위 판정(paymentEligibility)이 먼저입니다. 카드 단위로 확인된 판정은 범위별 규칙으로 뒤집지 않고,
 * 확인되지 않은(unknown) 항목만 범위별 규칙(eligibilityRules)으로 채웁니다.
 * 상품설명서의 계산 예시처럼 제외·인정 문구가 아닌 발췌에서 파생된 '가능' 규칙이
 * 카드 단위 '제외'를 '혜택 O'로 바꾸지 못하게 하기 위함입니다(하나 CLUB H 상품권 사례).
 * 같은 항목에 '제외'와 '가능'이 섞여 있으면 혜택을 약속하지 않도록 '제외'를 씁니다. */
export function paymentVerdict(c:Card,theme:string):{spend:PaymentEligibility['spend'];benefit:PaymentEligibility['benefit']}{
 const base=paymentEligibility(c,theme);
 if(base.spend!=='unknown'&&base.benefit!=='unknown')return {spend:base.spend,benefit:base.benefit};
 const scoped=scopedPaymentEligibility(c,theme);
 const free=spendFreeCard(c);
 const fill=(key:'spend'|'benefit'):'allowed'|'excluded'|'unknown'=>{
  if(base[key]!=='unknown')return base[key];
  if(scoped.some(rule=>rule[key]==='excluded'))return 'excluded';
  if(scoped.some(rule=>rule[key]==='allowed'))return 'allowed';
  return key==='spend'&&free?'allowed':'unknown';
 };
 return {spend:fill('spend'),benefit:fill('benefit')};
}
export function matchesPaymentEligibility(c:Card,theme:string,mode:'spend'|'benefit'|'both'|'any'){
 const e=paymentVerdict(c,theme);
 return mode==='both'?e.spend==='allowed'&&e.benefit==='allowed':mode==='spend'?e.spend==='allowed':mode==='benefit'?e.benefit==='allowed':e.spend==='allowed'||e.benefit==='allowed';
}
/** 가입 대상이 정해진 카드(공무원·법인 등). 목록 추천순에서 아래로, 쓰임 필터에서는 뺍니다. */
export const RESTRICTED = /교육청|공무원|도청|시청|군청|경찰|소방|국방|나라사랑|국민행복|바우처|복지카드|화물복지|법인|BIZ|비즈니스|사업자|학생증|ISIC|협회|연합회|조합원|운송사업자|다자녀|꿈디딤|꿈드리미|교육사랑|머니카드\s*Y/i;

// ---------- 국내 전 가맹점 기본 적립·할인 ----------
// 세금·관리비·상품권처럼 업종 혜택이 붙지 않는 결제에 실제로 남는 건 '전 가맹점 기본 혜택'뿐입니다.
const RATE_GENERAL=/기본|(?:국내외?|모든|전)\s*(?:전\s*)?가맹점|가맹점\s*(?:구분|제한)\s*없|^국내\s*(?:이용\s*)?(?:적립|할인|캐시백)/;
const TITLE_GENERAL=/기본\s*(?:적립|할인|캐시백|마일|포인트)|(?:국내외?|모든|전)\s*(?:전\s*)?가맹점|^국내\s*[:：]?\s*\d/;
const TEXT_GENERAL=/(?:국내외?|모든|전)\s*(?:전\s*)?가맹점[^/;\n]{0,30}?(?:\d+(?:\.\d+)?\s*%|[\d,]+\s*원당)|가맹점\s*(?:구분|제한)\s*없이[^/;\n]{0,30}?\d|(?:이용\s*(?:금액|실적)|사용액)[^/;\n]{0,25}?[\d,]+\s*원당\s*[\d.]+\s*(?:마일|포인트|점|P\b|M)/;
const rateText=(t:string)=>{
 const mile=/([\d,]+)\s*원당\s*(?:최대\s*)?([\d.]+)\s*(?:[가-힣A-Za-z]+\s+)?(마일리지|마일|포인트|점|P|M)/.exec(t);
 if(mile)return `${mile[1]}원당 ${mile[2]}${/마일/.test(mile[3])?'마일':'P'}`;
 const pct=/(\d+(?:\.\d+)?)\s*%/.exec(t);
 return pct?`${pct[1]}%`:'';
};
const kindOf=(t:string)=>/마일/.test(t)?'마일 적립':/캐시백/.test(t)?'캐시백':/할인/.test(t)?'할인':'적립';
/** 전 가맹점 기본 혜택이 있으면 짧은 이름("기본 1.2% 적립", "기본 1,000원당 1마일"), 없으면 null */
export function generalReward(c:Card):string|null{
 for(const r of c.rewardRates??[]){
  if(!RATE_GENERAL.test(r.label)||(/해외/.test(r.label)&&!/국내/.test(r.label)))continue;
  const unit=String(r.rewardUnit??'');
  if(/마일/.test(unit)||/마일/.test(r.label))return `기본 ${r.spendUnit.toLocaleString('ko-KR')}원당 ${r.rewardUnits}마일`;
  if(r.spendUnit>0&&r.rewardUnits>0&&r.unitValue>0){const pct=Math.round(r.rewardUnits*r.unitValue/r.spendUnit*1000)/10;if(pct>0)return `기본 ${pct}% ${kindOf(r.label)}`;}
 }
 for(const b of c.benefits){
  const t=b.title+' '+b.detail;
  if(/해외/.test(b.title)&&!/국내/.test(b.title))continue;
  if(TITLE_GENERAL.test(b.title)||TEXT_GENERAL.test(b.detail)){const rate=rateText(TITLE_GENERAL.test(b.title)?b.title+' '+b.detail:b.detail);return rate?`기본 ${rate}${/마일|P$/.test(rate)?'':' '+kindOf(t)}`:`기본 ${kindOf(t)}`;}
 }
 return null;
}
const ANNUAL_REWARD=/연간\s*(?:이용|실적|사용)[^/;\n]{0,40}?(?:바우처|마일|포인트|숙박권|연회비|면제|기프트|캐시백|상품권)/;
/** 상품권·관리비·국세·지방세: 실제로 써서 남는 게 있는 카드면 이유("혜택 O · 기본 1% 적립"), 아니면 null.
 * - 국세·지방세: 혜택이 적용되고(혜택 O) 전 가맹점 기본 혜택이 있어야 함
 * - 상품권(상테크)·관리비: 혜택 O + 기본 혜택(관리비는 관리비 할인도), 또는 실적 O + 채울 전월실적·연간 실적 혜택이 있어야 함 */
export function useFit(c:Card,theme:string):string|null{
 if(RESTRICTED.test(c.name))return null;
 const verdict=paymentVerdict(c,theme),benefitOk=verdict.benefit==='allowed',spendOk=verdict.spend==='allowed';
 const general=generalReward(c);
 if(theme==='국세'||theme==='지방세')return benefitOk&&general?`혜택 O · ${general}`:null;
 if(theme==='관리비'){
  const own=c.benefits.find(b=>/관리비/.test(b.title+' '+b.detail)&&/할인|적립|캐시백/.test(b.title+' '+b.detail)&&!/제외/.test(b.title));
  if(own&&verdict.benefit!=='excluded'){
   // 관리비 바로 뒤의 금액·율을 씀 (앞쪽 '월 최대 3,000원' 같은 통합 한도와 헷갈리지 않게)
   const t=own.title+' '+own.detail,near=t.slice(t.indexOf('관리비'),t.indexOf('관리비')+90);
   const amount=/([\d,]+(?:천|만)?원)\s*(?:결제일|청구)?\s*(?:할인|캐시백|적립)/.exec(near)?.[1];
   const rate=rateText(own.title)||amount||rateText(near);
   return `혜택 O · 관리비${rate?' '+rate:''} ${kindOf(/할인|캐시백|적립|마일/.test(own.title)?own.title:near)}`;
  }
 }
 if(benefitOk&&general)return `혜택 O · ${general}`;
 if(spendOk){
  if((c.minimumSpend??0)>0)return `실적 O · 전월 ${(c.minimumSpend!/10000).toLocaleString('ko-KR')}만원 채우기`;
  if(c.benefits.some(b=>ANNUAL_REWARD.test(b.title+' '+b.detail)))return '실적 O · 연간 실적 혜택 채우기';
 }
 return null;
}

// ---------- 호텔 멤버십 등급을 주는 카드 ----------
/** Mr. Hotels(assets/js/hotels.js의 P.*.cards)와 같은 내용. 카드를 추가·변경하면 두 곳을 같이 고치세요. */
export const HOTEL_TIERS:{re:RegExp;tier:string}[]=[
 {re:/ALL\s*우리카드\s*Infinite/i,tier:'아코르 골드 · 발급 시 자동'},
 {re:/ALL\s*우리카드\s*Premium/i,tier:'아코르 실버 · 발급 시'},
 {re:/메리어트\s*본보이.*더\s*베스트/,tier:'메리어트 골드 · 발급 시 자동 (연 6천만원 이용 시 플래티넘)'},
 {re:/힐튼\s*아너스\s*아멕스\s*프리미엄/,tier:'힐튼 골드 · 발급 시 (연 2,400만원 이용 시 다이아몬드)'},
 {re:/힐튼\s*아너스\s*아멕스(?!\s*프리미엄)/,tier:'힐튼 실버 · 발급 시 (연 1,200만원 이용 시 골드)'},
 {re:/American\s*Express\s*The\s*Platinum/i,tier:'힐튼·메리어트 골드 · 멤버십 리워즈에서 신청'},
];
export const hotelTier=(c:Card)=>HOTEL_TIERS.find(h=>h.re.test(c.name))?.tier??null;
export function cardThemes(c:Card):string[]{
 // Cached themes must never override edited eligibility values.
 const cached=c.themeTags?.filter(t=>!ELIGIBILITY_SEARCH_TAGS.has(t)&&t!=='호텔');
 const benefits=c.benefits.filter(b=>b.kind!=='voucher');const t=benefits.map(b=>b.title+' '+b.detail).join(' '),name=c.name;const themes:string[]=[];
 // 상품권·관리비·국세·지방세는 실제로 쓸 의미가 있는 카드만 (useFit)
 for(const theme of ELIGIBILITY_THEMES)if(useFit(c,theme))themes.push(theme);
 if(benefits.some(b=>/대한항공|아시아나|스카이패스|SKYPASS|ANA|JAL|KrisFlyer|항공\s*마일/i.test(b.title+' '+b.detail)&&/마일|miles/i.test(b.title+' '+b.detail)))themes.push('마일리지');
 if(hotelTier(c))themes.push('호텔 등급');
 if(benefits.some(b=>/해외|외화/.test(b.title+' '+b.category)&&/적립|할인|캐시백|수수료\s*(면제|우대)/.test(b.title+' '+b.detail)))themes.push('해외');
 if(!/wiz|위즈/i.test(name)&&/(?:CLUB\s*SK|클럽\s*SK|SK패밀리|\bKT\b|\bSKT\b|SK\s*텔레콤|T[-\s]?라이트|T[-\s]?프리미엄|T[-\s]?이코노미|T[-\s]?삼성|LG\s*(?:U|유플러스)|U\+|유플러스|알뜰폰|통신비|통신요금)/i.test(name)&&/통신|휴대폰|이동전화|알뜰폰/.test(t)&&/할인/.test(t))themes.push('통신');
 return [...new Set([...(cached??[]),...themes])];
}
export function normalizeCard(c:Card):Card {
 c=applyRewardValuations(c);
 const value={...c,themeTags:undefined};
 const audit=c.databaseAudit?{...c.databaseAudit,documentsRead:(c.documents??[]).filter(d=>d.readStatus==='read').length,pdfRead:(c.documents??[]).filter(d=>d.readStatus==='read'&&d.format==='pdf'&&d.identityStatus==='matched').length,spendSections:c.spendExclusions.length,benefitSections:c.benefitExclusions.length}:undefined;
 return {...value,databaseAudit:audit,themeTags:cardThemes(value)};
}
