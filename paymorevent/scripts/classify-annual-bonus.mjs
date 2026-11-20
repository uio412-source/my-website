import fs from 'node:fs';

const path=new URL('../data/cards.json',import.meta.url);
const cards=JSON.parse(fs.readFileSync(path,'utf8'));
let changed=0;
for(const card of cards)for(const benefit of card.benefits??[]){
  if(card.id==='nh-90010544'&&benefit.title==='보너스 포인트 : 연간 이용금액 1천만원 이상시 NH포인트 적립'&&benefit.kind!=='voucher'){
    benefit.kind='voucher';
    changed++;
  }
  if(card.id==='woori-102033'&&['프리미엄 여행 할인권 20만원','국제 브랜드 서비스(해외겸용카드 전용)'].includes(benefit.title)&&benefit.kind!=='voucher'){
    benefit.kind='voucher';
    changed++;
  }
}
fs.writeFileSync(path,JSON.stringify(cards,null,2)+'\n');
console.log(JSON.stringify({changed}));
