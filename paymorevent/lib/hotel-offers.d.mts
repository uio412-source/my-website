export function isHotelOffer(offer: {kind?: string; title?: string; benefitText?: string; description?: string; cardNames?: string[]}): boolean;
export function withoutHotelOffers<T extends {kind?: string; title?: string; benefitText?: string; description?: string; cardNames?: string[]}>(offers: T[]): T[];
