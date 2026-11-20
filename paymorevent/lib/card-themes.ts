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
export function scopedPaymentEligibility(c:Card,theme:string):PaymentEligibility[]{
 const re=patterns[theme];
 return (c.eligibilityRules??[]).filter(rule=>rule.item===theme||aliases[theme]?.includes(rule.item)||!!re?.test(rule.item));
}
export function matchesPaymentEligibility(c:Card,theme:string,mode:'spend'|'benefit'|'both'|'any'){
 const entries=[paymentEligibility(c,theme),...scopedPaymentEligibility(c,theme)];
 return entries.some(e=>mode==='both'?e.spend==='allowed'&&e.benefit==='allowed':mode==='spend'?e.spend==='allowed':mode==='benefit'?e.benefit==='allowed':e.spend==='allowed'||e.benefit==='allowed');
}
export function cardThemes(c:Card):string[]{
 // Cached themes must never override edited eligibility values.
 const cached=c.themeTags?.filter(t=>!ELIGIBILITY_SEARCH_TAGS.has(t));
 const benefits=c.benefits.filter(b=>b.kind!=='voucher');const t=benefits.map(b=>b.title+' '+b.detail).join(' '),name=c.name;const hotelText=c.benefits.map(b=>b.title+' '+b.detail).join(' ');const themes:string[]=[];
 for(const theme of ELIGIBILITY_THEMES)if(matchesPaymentEligibility(c,theme,'any'))themes.push(theme);
 if(benefits.some(b=>/대한항공|아시아나|스카이패스|SKYPASS|ANA|JAL|KrisFlyer|항공\s*마일/i.test(b.title+' '+b.detail)&&/마일|miles/i.test(b.title+' '+b.detail)))themes.push('마일리지');
 if(/메리어트|Marriott|힐튼|Hilton|아코르|Accor|ALL\s*우리|IHG|하얏트|Hyatt|American\s*Express|아메리칸\s*익스프레스|아멕스/i.test(name)&&/메리어트|Marriott|힐튼|Hilton|아코르|Accor|IHG|하얏트|Hyatt|F[&＆]B|Fine Hotels|FHR|Fine\s*Hotels\s*&\s*Resorts|호텔\s*멤버십/i.test(name+' '+hotelText))themes.push('호텔');
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
