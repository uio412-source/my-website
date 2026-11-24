export const valetDate = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

export function valetStatus(program, hotel, day = valetDate()) {
  if (!program.hotelIds.includes(hotel.id)) return 'unlisted';
  if (hotel.closure && hotel.closure.from <= day) return 'closed';
  if (program.validThrough && program.validThrough < day) return 'expired';
  return 'available';
}

// 50000 → 5만원, 25000 → 2만5천원, 그 밖은 12,500원
const wonKo = (n) => (n % 10000 === 0 ? `${n / 10000}만원` : n > 10000 && n % 1000 === 0 ? `${Math.floor(n / 10000)}만${(n % 10000) / 1000}천원` : `${n.toLocaleString()}원`);

/**
 * 실적 말고 이 호텔에서 따로 붙는 무료 조건(없으면 '').
 * 당일 객실·식당 이용은 모든 카드 공통이라 조건으로 보지 않고, '당일 ○만원 이상 영수증'처럼 금액이 붙는 것만 셈.
 * 수집 데이터는 hotelOverrides.<호텔>.minReceipt(원), 예전 데이터는 메모 문구로 판단.
 */
export function valetExtra(program, hotel) {
  const o = hotel && program.hotelOverrides?.[hotel.id];
  if (o?.minReceipt) return `당일 ${wonKo(o.minReceipt)} 이상 영수증`;
  if (o?.note && /이상 영수증/.test(o.note)) return '당일 영수증 금액 조건';
  if (o?.note && /호텔별 조건/.test(o.note)) return '호텔별 조건 있음';
  if (program.receiptByHotel) return '호텔별 영수증 금액 확인';
  return '';
}

export function valetQuota(program, hotel) {
  const scope = {
    per_hotel: '호텔별',
    hotel_shared: '호텔 통합',
    hotel_airport: '호텔·공항 통합',
  }[program.quotaScope];
  // 안내문에 '이용횟수 제한 없이'면 수집 데이터의 monthlyLimit이 null
  const general = program.monthlyLimit == null ? '횟수 제한 없음' : `${scope} 월 ${program.monthlyLimit}회`;
  const override = hotel && program.hotelOverrides?.[hotel.id];
  return override && override.monthlyLimit != null && override.monthlyLimit !== program.monthlyLimit ? `이 호텔 월 ${override.monthlyLimit}회 · ${general}` : general;
}
