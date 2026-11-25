// 카드 브랜드(국제 결제망) 이름 통일: 카드사마다 같은 브랜드를 다르게 적어서(제이씨비·유피아이·Union Pay(K-WORLD)·S& …)
// 화면·필터·비교에서는 결제망 이름 하나로 씁니다. 카드사 자체 브랜드는 실제로 쓰는 해외 결제망으로 묶습니다.
//   신한 S&(에스앤) → American Express · 신한 URS(유어스) → JCB · NH 더블류(W) → JCB (2017 출시 기사: 해외에서는 JCB 네트워크)
//   유피아이·UPI·K-WORLD(UPI)·Union Pay → UnionPay · 우리카드의 'BC'(국내 BC) → 국내전용
// BC Global·L·Global처럼 결제망이 하나로 정해지지 않은 자체 브랜드는 그대로 둡니다.
export type NetworkBrand = {key: string; label: string; image: string | null};

export function networkBrand(value: string): NetworkBrand {
  const key = value.toLowerCase().replace(/[\s·_-]/g, '');
  if (/master|마스터/.test(key)) return {key: 'mastercard', label: 'Mastercard', image: '/brands/mastercard.svg'};
  if (/visa|비자/.test(key)) return {key: 'visa', label: 'Visa', image: '/brands/visa.svg'};
  if (/unionpay|은련|유니온페이|유피아이|upi|kworld/.test(key)) return {key: 'unionpay', label: 'UnionPay', image: '/brands/unionpay.png'};
  if (/amex|americanexpress|아멕스|아메리칸익스프레스|^s&$|에스앤/.test(key)) return {key: 'amex', label: 'American Express', image: '/brands/amex.png'};
  if (/jcb|제이씨비|^urs$|유어스|더블류|^w$/.test(key)) return {key: 'jcb', label: 'JCB', image: '/brands/jcb.png'};
  if (/diners|다이너스/.test(key)) return {key: 'diners', label: 'Diners Club', image: '/brands/diners.png'};
  if (/국내전용|^local$|^bc$|^국내$/.test(key)) return {key: 'domestic', label: '국내전용', image: '/brands/domestic.svg'};
  return {key: value, label: value, image: null};
}

export function networkBrands(values: string[]) {
  return [...new Map(values.map(v => { const b = networkBrand(v); return [b.key, b] as const; })).values()];
}

/** 카드 DB의 brands를 통일한 이름으로(같은 결제망은 한 번만) */
export const normalizeBrands = (values: string[] | undefined) => networkBrands(values ?? []).map(b => b.label);

/** 연회비 문구 속 브랜드 이름도 같은 이름으로 ('S& 기본' → 'American Express 기본', '유피아이 (일반)' → 'UnionPay (일반)') */
export function brandText(text: string) {
  return text
    .replace(/K-?WORLD\s*\(UPI\)|Union\s*Pay\s*\(K-?WORLD\)|Union\s*Pay|유피아이|\bUPI\b/gi, 'UnionPay')
    .replace(/(^|[\s/(])S&(?=\s|$|\))/g, '$1American Express')
    .replace(/\bURS\b|더블류|제이씨비/g, 'JCB')
    .replace(/마스터카드|마스터(?=\s|\()/g, 'Mastercard')
    .replace(/(^|[\s/(])비자(?=\s|\()/g, '$1Visa');
}
