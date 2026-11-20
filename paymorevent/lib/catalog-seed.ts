import seed from '@/data/card-seed.json';
import type {Card} from './catalog-types';
let cached:Promise<Card[]>|null=null;
/** Large seed records stay compressed until a database revision needs them. */
export function readSeedCards():Promise<Card[]>{
 if(!cached)cached=(async()=>{
  const bytes=Uint8Array.from(atob(seed),c=>c.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const cards=await new Response(stream).json() as Card[];
  if(!Array.isArray(cards))throw Error('Invalid card seed');return cards;
 })().catch(error=>{cached=null;throw error;});
 return cached;
}
