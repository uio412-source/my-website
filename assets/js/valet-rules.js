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
  const general = `${scope} 월 ${program.monthlyLimit}회`;
  const override = hotel && program.hotelOverrides?.[hotel.id];
  return override ? `이 호텔 월 ${override.monthlyLimit}회 · ${general}` : general;
}
