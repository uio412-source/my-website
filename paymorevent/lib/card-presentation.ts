import {sitePath} from './site-path';
import type { Card, Benefit } from "./catalog-types";
import {brandText} from './network-brand';

export const cardPath = (id:string) => sitePath(`cards/${encodeURIComponent(id)}/`);
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
    if(index<0)return {label:"연회비 안내",amount:brandText(row)};
    const label=brandText(row.slice(0,index).replace(/[\s/:：]+$/g,"").trim());
    return {label:label||"연회비",amount:row.slice(index).trim()};
  });
}

export {networkBrand, networkBrands, type NetworkBrand} from './network-brand';
