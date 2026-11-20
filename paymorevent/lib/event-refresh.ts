import type {Offer} from './catalog-types';
/** A list-only refresh may update listing freshness, but cannot erase reviewed links. */
export function mergeEventRefresh(next:Offer,previous?:Offer):Offer{
 if(!previous||next.verificationLevel!=='official_list'||previous.verificationLevel!=='official_detail'||next.startsAt!==previous.startsAt||next.endsAt!==previous.endsAt)return next;
 if(previous.status==='needs_review')return {...previous,listingVerifiedAt:next.verifiedAt};
 return {...previous,status:next.status,listingVerifiedAt:next.verifiedAt,detailVerifiedAt:previous.detailVerifiedAt??previous.verifiedAt};
}
