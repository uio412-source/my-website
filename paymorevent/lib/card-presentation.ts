import type { Card, Benefit } from "./catalog-types";

export const cardPath = (id:string) => `/cards/${encodeURIComponent(id)}`;
export const moneyText = (value:number|null) => value===null?"미확인":value===0?"없음":`${value.toLocaleString("ko-KR")}원`;
export const spendText = (value:number|null) => value===null?"개별 조건 확인":value===0?"실적 조건 없음":`${moneyText(value)} 이상`;
export function benefitSpendText(benefit:Benefit) {
  const text=(benefit.title+' '+benefit.detail).replace(/\s+/g,'');
  const explicit=/전월(?:이용금액|실적|이용실적).{0,8}(?:관계없|상관없)|실적.{0,5}(?:제한없|조건없)|무실적/.test(text);
  if(benefit.minimumSpend===0&&!benefit.minimumSpendVerified&&!explicit)return '무실적 여부 확인 필요';
  return spendText(benefit.minimumSpend);
}
export const issuanceText = (card:Card) => card.issuanceStatus==="confirmed"?"발급 안내 확인":card.issuanceStatus==="catalog"?"공식 목록 확인":"발급 여부 확인 필요";

export function shortText(value:string,limit=110) {
  const clean=value.replace(/\s+/g," ").trim();
  return clean.length>limit?`${clean.slice(0,limit).trim()}…`:clean;
}

export function textLines(value:string) {
  return value.replace(/\s+/g," ").split(/\s*;\s*|\s+※\s*|\s+▶\s*/).map(v=>v.trim()).filter(Boolean);
}

export function annualFeeRows(card:Card):{label:string;amount:string}[] {
  const original=card.annualFeeText.trim();
  if(!original||original==="미확인")return [{label:"연회비",amount:"미확인"}];
  const parts=original.split(/\s*;\s*|\s*\|\s*/).filter(Boolean);
  const rows=parts.flatMap(part=>{
    // Separate slash-delimited variants only when each segment names its own fee.
    const variants=part.split(/\s+\/\s+/);
    return variants.length>1&&variants.every(v=>/\d[\d,]*\s*(?:원|천원|만원)/.test(v))?variants:[part];
  });
  return rows.map(row=>{
    const index=row.search(/\d[\d,]*(?:\.\d+)?\s*(?:만\s*원|천\s*원|원)/);
    if(index<0)return {label:"연회비 안내",amount:row};
    const label=row.slice(0,index).replace(/[\s/:：]+$/g,"").trim();
    return {label:label||"연회비",amount:row.slice(index).trim()};
  });
}

export type NetworkBrand={key:string;label:string;image:string|null};
export function networkBrand(value:string):NetworkBrand {
  const key=value.toLowerCase().replace(/[\s·_-]/g,"");
  if(/master|마스터/.test(key))return {key:"mastercard",label:"Mastercard",image:"/brands/mastercard.svg"};
  if(/visa|비자/.test(key))return {key:"visa",label:"Visa",image:"/brands/visa.svg"};
  if(/unionpay|은련|유니온페이|유피아이|upi|kworld/.test(key))return {key:"unionpay",label:"UnionPay",image:"/brands/unionpay.png"};
  if(/amex|americanexpress|아멕스/.test(key))return {key:"amex",label:"American Express",image:"/brands/amex.png"};
  if(/jcb|제이씨비/.test(key))return {key:"jcb",label:"JCB",image:"/brands/jcb.png"};
  if(/diners|다이너스/.test(key))return {key:"diners",label:"Diners Club",image:"/brands/diners.png"};
  if(/국내전용|^local$/.test(key))return {key:"domestic",label:"국내전용",image:"/brands/domestic.svg"};
  return {key:value,label:value,image:null};
}

export function networkBrands(values:string[]) {
  return [...new Map(values.map(v=>{const b=networkBrand(v);return [b.key,b] as const;})).values()];
}
