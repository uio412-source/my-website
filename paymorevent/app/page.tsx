import Catalog from "@/components/catalog";
import cards from "@/data/home-cards.json";
import eventsSource from "@/data/events.json?raw";
const events=JSON.parse(eventsSource) as Offer[];
import {dedupeOffers,currentMonthOffer,visibleOffer} from "@/lib/catalog-model";
import type { Card, Offer } from "@/lib/catalog-types";
export default function Home() {
  return <Catalog initialCards={([...cards].sort((a,b)=>(b.benefitCount+Number(!!b.termsUrl))-(a.benefitCount+Number(!!a.termsUrl))).slice(0,24)) as Card[]} initialEvents={dedupeOffers(events as Offer[]).filter(o=>visibleOffer(o)&&currentMonthOffer(o))} />;
}
