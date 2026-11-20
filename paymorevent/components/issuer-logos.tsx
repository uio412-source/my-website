"use client";
import {useState} from 'react';
import {assetPath} from '@/lib/site-path';
import {CreditCard,CheckIcon as Check} from 'lucide-react';
import logos from '@/data/issuer-logos.json';
import {ISSUERS} from '@/lib/catalog-model';
import {issuerIdentity} from '@/lib/issuer-identity';
export function IssuerLogo({issuer,hideName=true}:{issuer:string;hideName?:boolean}){
 const identity=issuerIdentity(issuer);const asset=(logos as Record<string,{image:string}|null>)[identity.key];const [failedSource,setFailedSource]=useState('');
 return <span className={'issuer-logo'+(!asset||failedSource===asset.image?' issuer-logo-fallback':'')} title={identity.name} aria-label={identity.name}><span className="issuer-logo-mark" aria-hidden="true">{asset&&failedSource!==asset.image?<img src={assetPath(asset.image)} alt="" width={56} height={24} onError={()=>setFailedSource(asset.image)}/>:<CreditCard size={19}/>}</span>{(!hideName||!asset||failedSource===asset.image)&&<span className="issuer-logo-name">{identity.name}</span>}</span>;
}
export function IssuerLogoFilter({value,onChange}:{value:string;onChange:(s:string)=>void}){
 return <section className="issuer-picker" aria-label="카드사 선택"><div className="issuer-picker-heading"><span>카드사</span><span>{value==='all'?'모든 카드사':issuerIdentity(value).name}</span></div><div className="issuer-logo-filter">{['all',...ISSUERS,'기타'].map(i=><button type="button" key={i} aria-label={i==='all'?'모든 카드사 보기':issuerIdentity(i).name+'만 보기'} aria-pressed={value===i} onClick={()=>onChange(value===i?'all':i)}>{i==='all'?<span className="issuer-all">전체 카드사</span>:<IssuerLogo issuer={i}/>}<span className="issuer-selection" aria-hidden="true">{value===i&&<Check size={14}/>}</span></button>)}</div></section>;
}
