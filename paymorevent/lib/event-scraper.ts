import research from '@/data/events-research.json';
import personalSources from '@/data/personal-benefit-sources.json';
import linkedReviews from '@/data/event-link-updates.json';
import {eventSourceKey} from './event-identity';
export {eventSourceKey} from './event-identity';
import type { Card, Offer } from './catalog-types';
import {eventCategory} from './catalog-model';
import {conflictingEventPeriod} from './event-period';
import {discoverSKW,fetchSKWDetail} from './issuer-skw';
import {discoverHHL} from './issuer-hhl';
import {discoverNSB} from './issuer-nsb';

type Seed = Offer & { sourceFetchUrl: string; evidenceDigest: string; sourceFile?: string; category?: string; channel?: string; cardIds?: string[]; cardNames?: string[]; participation?: string[]; cashbackMax?: number | null };
export type ScrapeSource = { issuer: string; url: string; status: 'ok' | 'partial' | 'fetch_failed' | 'parse_failed' | 'changed'; count: number; discoveredCount?: number; listOnlyCount?: number; reviewCount?: number; expiredCount?:number; error?: string };
export type DiscoveredEvent = { issuer: string; title: string; sourceUrl: string; startsAt: string | null; startsAtLabel?:string; endsAt: string | null; reviewRequired: boolean; summary?: string; imageUrl?: string | null };
type Candidate = DiscoveredEvent & { fetchUrl?: string; parser?: 'samsung' | 'bc' };
const seeds = [...research,...linkedReviews.events.map(o=>({...o,sourceFetchUrl:o.sourceUrl,evidenceScope:'kb_body'}))] as unknown as (Seed & {evidenceScope?:string})[];
const USER_AGENT = 'Mozilla/5.0 Paymoment-SourceCheck/1.0';
const clean = (h: string) => h.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/D-\d+/g, 'D-X').replace(/\s+/g, ' ').trim();
const digest = (s: string) => { let n = 2166136261; for (let i = 0; i < s.length; i++) { n ^= s.charCodeAt(i); n = Math.imul(n, 16777619); } return (n >>> 0).toString(16); };
const day = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const compactDate = (s: unknown): string | null => { const m = String(s ?? '').match(/^(\d{4})(\d{2})(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };
function period(text: string): [string | null, string | null] {
  const m = clean(text).match(/((?:20)?\d{2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})(?:\s*\([^)]*\))?\s*[~～–—-]\s*(?:((?:20)?\d{2})\s*[.\/-]\s*)?(\d{1,2})\s*[.\/-]\s*(\d{1,2})/);
  if (!m) return [null, null];
  const date = (y: string, mo: string, d: string) => `${y.length === 2 ? '20' + y : y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return [date(m[1], m[2], m[3]), date(m[4] ?? m[1], m[5], m[6])];
}
function categorize(t:string):NonNullable<Offer['category']> {return eventCategory({title:t,benefitText:''} as Offer) as NonNullable<Offer['category']>;} 

async function get(url: string, init: RequestInit = {}): Promise<string> {
  const r = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...init.headers }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const bytes = await r.arrayBuffer(); if (bytes.byteLength > 2_500_000) throw new Error('source exceeds 2.5 MB limit');
  const ct = r.headers.get('content-type') ?? '';
  let body = new TextDecoder(/euc-kr|ks_c_5601/i.test(ct) ? 'euc-kr' : 'utf-8').decode(bytes);
  if (/charset\s*=\s*["']?(?:euc-kr|ks_c_5601)/i.test(body.slice(0, 2000))) body = new TextDecoder('euc-kr').decode(bytes);
  if (/ResourceNotFound|요청하신 페이지를 찾을 수 없|서비스 이용에.*불편/.test(clean(body))) throw new Error('source returned an error page');
  return body;
}
function constJson(h: string, name: string): any { const m = h.match(new RegExp(`const ${name} = (\\{[^\\n]*\\});`)); if (!m) throw new Error(`${name} JSON missing`); return JSON.parse(m[1]); }
function evidenceBody(raw: string): string {
  if (raw.trim().startsWith('{')) { const j = JSON.parse(raw); return j.wcmsHtml?.htmlText ?? JSON.stringify(j); }
  if (raw.includes('const eventData = ')) { const j = constJson(raw, 'eventData'); delete j.applcReqCode; return JSON.stringify(j); }
  return raw;
}
function exactLinks(cards: Card[], issuer: string, names: string[]) { const norm = (s: string) => s.replace(/\s|[()]/g, '').toLowerCase(); return cards.filter(c => c.issuer === issuer && names.some(n => norm(n) === norm(c.name))).map(c => c.id); }
function offer(id: string, issuer: string, title: string, benefit: string, start: string | null, end: string | null, url: string, req: string[], names: string[], cards: Card[], channel = '카드사 공식', imageUrl: string | null = null): Offer {
  const category = categorize(title + ' ' + req.slice(0, 2).join(' '));
  const kind = /신규|발급|첫 연회비|웰컴/.test(title + ' ' + benefit) && /캐시백|상품권|포인트|쿠폰|연회비.*환급/.test(title + ' ' + benefit) ? 'cashback' : 'card';
  const now = day();
  const conflict=conflictingEventPeriod(req,start,end);
  return { id, kind, issuer, chain: null, title, description: benefit, benefitText: benefit, tags: [category, ...(kind === 'cashback' ? ['발급 캐시백'] : [])], startsAt: start, endsAt: end, bookingEndsAt: null, stayEndsAt: null, requirements: req, sourceUrl: url, imageUrl, status: conflict?'needs_review':/회원님의\s*목표\s*이용금액/.test(benefit)?'needs_review':end && end < now ? 'expired' : start && start > now ? 'upcoming' : 'active', verifiedAt: now, annualFeeOnly: /연회비/.test(title)||(kind==='cashback'&&/가입\s*첫\s*해\s*연회비/.test(benefit)), verificationNote: conflict?'공식 상세의 행사 기간과 목록 기간이 다릅니다. 재확인 전에는 노출하지 않습니다.':'공식 상세의 구조화된 혜택·기간·참여 정보를 수집했습니다. 현금 환산액을 임의로 추가하지 않았습니다.', category, channel, participation: req.slice(0, 5), cardNames: names, cardIds: exactLinks(cards, issuer, names) } as Offer;
}

function parseSamsung(raw: string, c: Candidate, cards: Card[]): Offer {
  const j = JSON.parse(raw); const body = j.wcmsHtml?.htmlText; if (!body) throw new Error('Samsung detailed terms missing');
  const t = clean(body), title = clean(j.evtHeaderTitle ?? c.title); const [headerStart,headerEnd]=period(j.evtHeaderTxt??''); const start=c.startsAt??headerStart,end=c.endsAt??headerEnd;
  if (!start || !end) throw new Error('Samsung actual event period missing');
  const benefitSection = t.match(/(?:^|\s)혜택\s+([\s\S]*?)(?:참여방법|혜택제공|참여 방법|대상카드|주요카드혜택|꼭 확인하세요|카드 혜택)/)?.[1];
  if (!benefitSection || !/원|%|포인트|마일|무료|쿠폰|크레딧|캐시백/.test(benefitSection)) throw new Error('Samsung benefit section incomplete; detailed review required');
  const rawReq = [...body.matchAll(/<(?:li|p)\b[^>]*>([\s\S]*?)<\/(?:li|p)>/gi)].map(m => clean(m[1])).filter(s => s.length > 8 && !/연체이자율|신용평점|상환 능력|변제할 의무|금융소비자|심의필|주요카드혜택/.test(s)).slice(0, 18);
  if (!rawReq.length) throw new Error('Samsung participation conditions missing');
  const target = t.match(/대상카드\s+([\s\S]*?)(?:혜택|행사기간|행사 기간|참여방법|참여 방법)/)?.[1] ?? '';
  const names = cards.filter(x => x.issuer === '삼성카드' && target.includes(x.name) && x.name.length >= 8).map(x => x.name);
  return offer(`samsung-live-${c.fetchUrl?.match(/\/(\d+)_/)?.[1]}`, '삼성카드', title, benefitSection.slice(0, 500), start, end, c.sourceUrl, rawReq, names, cards);
}
function parseBC(raw: string, c: Candidate, cards: Card[]): Offer {
  const j = constJson(raw, 'eventData'); const groups = j.eventDetailsGroupBaseDtoList ?? [];
  const groupText = (g: any) => (g.eventDetailGroupContentDtoList ?? []).flatMap((x: any) => [clean(x.cntnTitlNm ?? ''), clean(x.cntnDtCtnt ?? '')]).filter(Boolean);
  const b = groups.filter((g: any) => /혜택|행사내용|이벤트 내용/.test(g.evntDtGrpNm)).flatMap(groupText);
  if (!b.length) throw new Error('BC detailed benefit absent (image-only or external link)');
  const req = groups.filter((g: any) => /대상|방법|조건|기간|유의|참고|확인/.test(g.evntDtGrpNm)).flatMap(groupText);
  if (!req.length) throw new Error('BC detailed participation absent');
  const start = compactDate(j.evntStrtDtm), end = compactDate(j.evntEndDtm); if (!start || !end) throw new Error('BC actual event period missing');
  return offer(`bc-live-${j.pybcUnifEvntNo}`, 'BC카드', clean([j.pybcUnifEvntNm1, j.pybcUnifEvntNm2, j.pybcUnifEvntNm3].join(' ')), b.join(' · ').slice(0, 500), start, end, c.sourceUrl, req.slice(0, 40), [], cards, '페이북', j.evntBsImgUrlAddr ?? null);
}

export const EVENT_SOURCES = [
 {issuer:'삼성카드',url:'https://www.samsungcard.com/home/benefit/event/PGHPPCCBenefitEventViewIndex001'},
 {issuer:'KB국민카드',url:'https://card.kbcard.com/BON/DVIEW/HBBMCXCRVNEC0001'},
 {issuer:'신한카드',url:'https://www.shinhancard.com/mob/MOBFM829N/MOBFM829R01.shc'},
 {issuer:'우리카드',url:'https://pc.wooricard.com/dcpc/yh1/bnf/bnf02/prgevnt/H1BNF202S00.do'},
 {issuer:'하나카드',url:'https://m.hanacard.co.kr/MPAEVT100M.web'},
 {issuer:'현대카드',url:'https://www.hyundaicard.com/cpb/ev/CPBEV0101_01.hc'},
 {issuer:'롯데카드',url:'https://www.lottecard.co.kr/app/LPBNFDA_V100.lc'},
 {issuer:'NH농협카드',url:'https://card.nonghyup.com/servlet/IpCb2001R.act'},
 {issuer:'BC카드',url:'https://web.paybooc.co.kr/web/evnt/main'},
];
function listOffer(c:Candidate):Offer{
 const category=categorize(c.title);
 const explanation='공식 목록의 행사명·기간을 확인했습니다. 대상 카드·응모·이용 조건과 세부 혜택은 공식 안내에서 확인하세요.';
 return {id:'event-'+digest(c.issuer+'|'+eventSourceKey({sourceUrl:c.fetchUrl??c.sourceUrl})),kind:'card',issuer:c.issuer,chain:null,title:clean(c.title),
 description:c.summary?clean(c.summary):explanation,benefitText:c.summary?clean(c.summary):'공식 진행 이벤트 · 상세 혜택 및 참여 조건 확인',
 tags:[category],category,channel:c.issuer==='BC카드'?'페이북':'카드사 공식',startsAt:c.startsAt,startsAtLabel:c.startsAtLabel,endsAt:c.endsAt,bookingEndsAt:null,stayEndsAt:null,
 requirements:[explanation],participation:['공식 안내에서 대상·참여 조건 확인'],sourceUrl:c.sourceUrl,sourceDetailUrl:c.fetchUrl??c.sourceUrl,
 imageUrl:c.imageUrl??null,status:c.endsAt&&c.endsAt<day()?'expired':c.startsAt&&c.startsAt>day()?'upcoming':(c.startsAt||c.startsAtLabel==='수신일')&&c.endsAt?'active':'needs_review',
 verifiedAt:day(),verificationNote:explanation,verificationLevel:'official_list',cardIds:[],cardNames:[],cashbackAmount:null};
}
function genericDetail(raw:string,c:Candidate):Offer|null{
 const body=raw.match(/<(?:div|section|article)[^>]*class=["'][^"']*(?:event_detail|event-detail|evt_detail|event-view|eventView|event_cont|evt_cont|view_cont|detail_cont)[^"']*["'][^>]*>([\s\S]*)/i)?.[1];
 if(!body)return null;
 const t=clean(body),[start,end]=period(t.match(/(?:행사|이벤트)\s*기간[\s\S]{0,200}/)?.[0]??'');
 const o=listOffer({...c,startsAt:c.startsAt??start,endsAt:c.endsAt??end});
 const lines=[...body.matchAll(/<(?:li|p|dd)\b[^>]*>([\s\S]*?)<\/(?:li|p|dd)>/gi)].map(m=>clean(m[1])).filter(s=>s.length>8&&!/심의필|연체이자율|금융소비자|신용평점|변제할 의무/.test(s)).slice(0,30);
 if(lines.length){o.requirements=lines;o.participation=lines.slice(0,3);o.verificationNote='공식 목록의 행사명·기간 및 상세 원문을 수집했습니다. 금액 환산·대상 상품 연결은 확인 전까지 적용하지 않습니다.';}
 return o;
}
export async function scrapeEvents(cards:Card[],issuer?:string):Promise<{events:Offer[];sources:ScrapeSource[];discovered:DiscoveredEvent[]}>{
 const events:Offer[]=[],reports:ScrapeSource[]=[],discovered:DiscoveredEvent[]=[];
 const cache=new Map<string,Promise<string>>(),sizes=new Map<string,number>();let cacheChars=0;
 const cached=(u:string,init?:RequestInit)=>{const key=u+'|'+(init?.body??'');if(!cache.has(key)){const pending=get(u,init).then(body=>{sizes.set(key,body.length);cacheChars+=body.length;for(const old of cache.keys()){if(cacheChars<=6_000_000)break;const size=sizes.get(old);if(size!==undefined){cache.delete(old);sizes.delete(old);cacheChars-=size;}}return body;});cache.set(key,pending);}return cache.get(key)!;};
 await Promise.all(EVENT_SOURCES.filter(s=>!issuer||s.issuer===issuer).map(async source=>{
  try{
   const discover=['KB국민카드','신한카드','우리카드'].includes(source.issuer)?discoverSKW:['하나카드','현대카드','롯데카드'].includes(source.issuer)?discoverHHL:discoverNSB;
   const monthEnd=day().slice(0,7)+'-31';
   const candidates:Candidate[]=(await discover(source.issuer,cached)).filter(c=>(!c.endsAt||c.endsAt>=day())&&(!c.startsAt||c.startsAt<=monthEnd)).map(c=>({...c,reviewRequired:false,parser:source.issuer==='삼성카드'?'samsung':source.issuer==='BC카드'?'bc':undefined}));
   if(!candidates.length)throw new Error('공식 전체 목록 응답에서 이벤트를 추출하지 못했습니다. 이전 게시물을 유지합니다.');
   let detailed=0,listOnly=0,review=0,expired=0;const output:Offer[]=[];
   for(let i=0;i<candidates.length;i+=6)await Promise.all(candidates.slice(i,i+6).map(async c=>{
    let o=listOffer(c);
    if(c.summary?.includes("확인 전 게시를 보류")){review++;discovered.push({...c,reviewRequired:true});return;}
    const seed=seeds.find(s=>s.issuer===source.issuer&&eventSourceKey({sourceUrl:s.sourceFetchUrl})===eventSourceKey({sourceUrl:c.fetchUrl??c.sourceUrl}));
    try{
     if(!c.parser&&!seed&&c.startsAt&&c.endsAt)throw new Error('Official list metadata is complete; detailed terms remain explicitly unverified.');
     const raw=c.issuer==='우리카드'?await fetchSKWDetail(c,cached):await cached(c.fetchUrl??c.sourceUrl);
     const evidence=seed?.evidenceScope==='kb_body'?raw.match(/<!-- s: eventBodyRE -->([\s\S]*?)<!-- e: eventBodyRE -->/)?.[1]??'':evidenceBody(raw);
     if(seed&&digest(clean(evidence))===seed.evidenceDigest&&(!seed.evidenceScope||(c.startsAt===seed.startsAt&&c.endsAt===seed.endsAt))){
      const {evidenceDigest,sourceFile,sourceFetchUrl,evidenceScope,...pub}=seed;void evidenceDigest;void sourceFile;void evidenceScope;
      o={...pub,startsAt:c.startsAt??pub.startsAt,endsAt:c.endsAt??pub.endsAt,verifiedAt:day(),sourceDetailUrl:sourceFetchUrl,verificationLevel:'official_detail'};
      o.detailVerifiedAt=day();
      o.status=pub.status==='needs_review'?'needs_review':o.endsAt&&o.endsAt<day()?'expired':o.startsAt&&o.startsAt>day()?'upcoming':o.startsAt&&o.endsAt?'active':'needs_review';
     }else if(c.parser){
      const parsed=c.parser==='samsung'?parseSamsung(raw,c,cards):parseBC(raw,c,cards);
      if(parsed.status!=='needs_review')o={...parsed,id:seed?.id??parsed.id,sourceUrl:c.sourceUrl,sourceDetailUrl:c.fetchUrl??c.sourceUrl,verificationLevel:'official_detail'};
     }else if(seed?.evidenceScope==='kb_body')o={...seed,status:'needs_review',verificationNote:'공식 행사 본문 변경 감지. 대상·조건을 다시 확인할 때까지 추천을 보류합니다.',verifiedAt:day()};
     else o=genericDetail(raw,c)??o;
    }catch{/* A failed detail must not suppress an official, dated listing. */}
    if(seed)o.id=seed.id;
    if(o.status==='active'||o.status==='upcoming'){output.push(o);if(o.verificationLevel==='official_detail')detailed++;else listOnly++;}
    else if(o.status==='expired')expired++;else {review++;if(seed)output.push(o);}
    discovered.push({issuer:c.issuer,title:c.title,sourceUrl:c.sourceUrl,startsAt:o.startsAt,endsAt:o.endsAt,reviewRequired:o.status==='needs_review'||o.verificationLevel!=='official_detail'});
   }));
   events.push(...output);
   reports.push({...source,status:review?'partial':'ok',count:output.length,discoveredCount:candidates.length,listOnlyCount:listOnly,reviewCount:review,expiredCount:expired,...(review?{error:review+'개 행사 기간을 확정하지 못해 검토 대기입니다.'}:{})});
  }catch(e){reports.push({...source,status:'fetch_failed',count:0,error:e instanceof Error?e.message:String(e)});}
 }));
 return {events:[...new Map(events.map(e=>[eventSourceKey(e),e])).values()],sources:reports.sort((a,b)=>EVENT_SOURCES.findIndex(s=>s.issuer===a.issuer)-EVENT_SOURCES.findIndex(s=>s.issuer===b.issuer)),discovered:[...new Map(discovered.map(c=>[c.sourceUrl,c])).values()]};
}
