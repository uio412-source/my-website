export const valetDate = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

export function valetStatus(program, hotel, day = valetDate()) {
  if (!program.hotelIds.includes(hotel.id)) return 'unlisted';
  if (hotel.closure && hotel.closure.from <= day) return 'closed';
  if (program.validThrough && program.validThrough < day) return 'expired';
  return 'available';
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
