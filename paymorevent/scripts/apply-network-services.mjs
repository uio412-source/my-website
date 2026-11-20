import './ensure-card-data.mjs';
import fs from 'node:fs';
import {gzipSync} from 'node:zlib';

const cards=JSON.parse(fs.readFileSync('data/cards.json','utf8'));
const checkedAt='2026-10-10';
const eliteGuide='https://static11.samsungcard.com/wcms/personal/files/2604_AMEX_E_002.pdf';
const reserveGuide='https://static11.samsungcard.com/wcms/personal/files/2604_AMEX_E_004.pdf';
const base=(sourceUrl)=>({network:'American Express',tier:'PLATINUM ELITE',verifiedAt:checkedAt,verified:true,sourceUrl});
const premium=(sourceUrl)=>[
 {...base(sourceUrl),id:'amex-platinum-elite-lounge-discount',provider:'international_network',category:'airport_lounge',title:'인천공항 라운지 동반 할인',scope:'domestic_airports',coverageText:'인천공항 스카이허브·마티나·마티나 골드 라운지 성인 요금',holderIncluded:true,guestCount:2,matinaGold:'discounted',minimumSpend:null,dailyLimit:null,monthlyLimit:null,annualLimit:null,sharedLimitGroup:null,conditions:['본인 및 동반자 2인까지 성인 요금 30% 할인','무료 입장이 아닌 국제브랜드 할인 서비스','해당 아멕스 카드 제시 또는 결제 등 공식 이용 조건 적용']},
 {...base(sourceUrl),id:'amex-platinum-elite-baekmidang',provider:'international_network',category:'dining',title:'백미당 1+1 선택 무료',scope:'domestic',coverageText:'백미당 일부 제외 매장에서 대상 메뉴 1개 구매 시 아메리카노(R)·백미당 라떼(R)·카페라떼(R)·소프트아이스크림 중 1개 무료',holderIncluded:null,guestCount:null,matinaGold:'not_applicable',minimumSpend:null,dailyLimit:null,monthlyLimit:1,annualLimit:2,sharedLimitGroup:null,conditions:['베이커리류 제외','일부 매장 제외','월 1회, 연 2회','서비스 연도는 1월 1일~12월 31일']},
];
const eliteServices=[...premium(eliteGuide),
 {...base(eliteGuide),id:'samsung-amex-elite-incheon-valet',provider:'issuer_selection',category:'airport_valet',title:'인천공항 발렛파킹',scope:'incheon_airport',coverageText:'인천공항 제1·제2여객터미널 공식 주차대행',holderIncluded:true,guestCount:null,matinaGold:'not_applicable',minimumSpend:300000,dailyLimit:null,monthlyLimit:5,annualLimit:null,sharedLimitGroup:'공항 발렛파킹 통합 월 5회',conditions:['사전 예약 고객 대상이며 현장 상황에 따라 미예약 접수 불가','주차요금은 본인 부담','발급월+1개월까지 실적 유예','본인카드와 가족카드의 실적·횟수는 각각 산정']},
 {...base(eliteGuide),id:'samsung-amex-elite-hotel-valet',provider:'issuer_selection',category:'hotel_valet',title:'국내 특급호텔 발렛파킹',scope:'domestic_hotels',coverageText:'공식 안내에 명시된 국내 특급호텔 23개',holderIncluded:true,guestCount:null,matinaGold:'not_applicable',minimumSpend:300000,dailyLimit:null,monthlyLimit:5,annualLimit:null,sharedLimitGroup:null,conditions:['호텔별 월 5회','객실·식음료 매장 이용 당일 영수증 제시','본인 방문에 한해 제공','일 3시간 무료 주차, 초과 주차요금 별도','발급월+1개월까지 실적 유예']},
 {...base(eliteGuide),id:'samsung-amex-elite-domestic-lounge',provider:'issuer_selection',category:'airport_lounge',title:'인천공항 라운지 무료',scope:'domestic_airports',coverageText:'인천공항 제1·제2여객터미널 마티나 라운지',holderIncluded:true,guestCount:0,matinaGold:'excluded',minimumSpend:300000,dailyLimit:1,monthlyLimit:null,annualLimit:2,sharedLimitGroup:'마티나 라운지 통합 일 1회·연 2회',conditions:['본인 명의 당일 탑승권·여권과 대상 카드 제시','마티나 골드 무료 입장은 포함되지 않으며 별도 30% 할인 서비스 적용','발급월+1개월까지 실적 유예','본인카드와 가족카드의 실적·횟수는 각각 산정']},
];
const reserveServices=[...premium(reserveGuide),
 {...base(reserveGuide),id:'samsung-amex-reserve-incheon-valet',provider:'issuer_selection',category:'airport_valet',title:'인천공항 발렛파킹',scope:'incheon_airport',coverageText:'인천공항 제1·제2여객터미널 공식 주차대행',holderIncluded:true,guestCount:null,matinaGold:'not_applicable',minimumSpend:500000,dailyLimit:null,monthlyLimit:5,annualLimit:null,sharedLimitGroup:'국내호텔 발렛과 통합 월 5회',conditions:['사전 예약 고객 대상이며 현장 상황에 따라 미예약 접수 불가','주차요금은 본인 부담','발급월+1개월까지 실적 유예']},
 {...base(reserveGuide),id:'samsung-amex-reserve-hotel-valet',provider:'issuer_selection',category:'hotel_valet',title:'국내 특급호텔 발렛파킹',scope:'domestic_hotels',coverageText:'공식 안내에 명시된 국내 특급호텔 22개',holderIncluded:true,guestCount:null,matinaGold:'not_applicable',minimumSpend:500000,dailyLimit:null,monthlyLimit:5,annualLimit:null,sharedLimitGroup:'인천공항 발렛과 통합 월 5회',conditions:['객실·식음료 매장 이용 당일 영수증 제시','본인 방문에 한해 제공','일 3시간 무료 주차, 초과 주차요금 별도','발급월+1개월까지 실적 유예']},
 {...base(reserveGuide),id:'samsung-amex-reserve-domestic-lounge',provider:'issuer_selection',category:'airport_lounge',title:'국내 공항 라운지 무료',scope:'domestic_airports',coverageText:'인천공항 마티나·스카이허브 라운지와 김해공항 스카이허브 라운지',holderIncluded:true,guestCount:0,matinaGold:'excluded',minimumSpend:500000,dailyLimit:1,monthlyLimit:null,annualLimit:5,sharedLimitGroup:'국내·해외 공항 라운지 통합 연 5회',conditions:['본인 명의 당일 탑승권·여권과 대상 카드 제시','마티나 골드 무료 입장은 포함되지 않으며 별도 30% 할인 서비스 적용','발급월+1개월까지 실적 유예']},
 {...base(reserveGuide),id:'samsung-amex-reserve-worldwide-lounge',provider:'issuer_selection',category:'airport_lounge',title:'전 세계 공항 라운지 무료',scope:'worldwide_airports',coverageText:'Digital Priority Pass 참여 전 세계 공항 라운지',holderIncluded:true,guestCount:0,matinaGold:'not_applicable',minimumSpend:500000,dailyLimit:null,monthlyLimit:null,annualLimit:5,sharedLimitGroup:'국내·해외 공항 라운지 통합 연 5회',conditions:['본인용 Digital Priority Pass 제공','등록일로부터 1년 기준','Priority Pass 앱 멤버십 카드와 당일 탑승권 제시','초과 이용금액은 본인 부담']},
];

const eliteIds=new Set(['samsung-aap1450','samsung-aap1451','sc-4231','sc-5350']);
let updated=0;
for(const card of cards){
 if(eliteIds.has(card.id)){card.networkServices=eliteServices;updated++;}
 else if(card.id==='samsung-aap1692'){card.networkServices=reserveServices;updated++;}
}
if(updated!==5)throw new Error(`Expected 5 exact card matches, got ${updated}`);
fs.writeFileSync('data/cards.json',JSON.stringify(cards,null,2)+'\n');
fs.writeFileSync('data/cards.json.gz',gzipSync(JSON.stringify(cards),{level:9}));
console.log(JSON.stringify({updated,services:cards.reduce((n,c)=>n+(c.networkServices?.length??0),0)}));
