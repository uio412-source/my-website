"use client";
import {IssuerLogo,IssuerLogoFilter} from '@/components/issuer-logos';
import {PersonalBenefits} from '@/components/personal-benefits';
import {readCardSummaries} from '@/pages/data';
import {cardThemes,matchesPaymentEligibility,ELIGIBILITY_THEMES} from '@/lib/card-themes';
import {EventBoard} from '@/components/event-board';
import {CashbackGroups} from '@/components/cashback-groups';
import {useEffect,useMemo,useState} from 'react';
import {flushSync} from 'react-dom';
import {Search,SlidersHorizontal,CreditCard,Plane,ShoppingBag,Smartphone,Sparkles,X,FileText,Coffee,Bus,ArrowRight,ChevronDown} from 'lucide-react';
import type {Card,Offer} from '@/lib/catalog-types';
import {CardArtwork} from '@/components/card-visuals';
import {SiteHeader,SiteFooter} from '@/components/customer-shell';
import {ISSUERS,BENEFIT_KINDS,issuerGroup,benefitKinds,bestPicking,formatPicking,pickingRange,linkedOffers,eventCategory,EVENT_CATEGORIES,activeOffer,currentMonthOffer,visibleOffer,offerTags,requiresEntry,cardFamilyKey,groupCards,dedupeOffers,offerApplies,offerStatus} from '@/lib/catalog-model';
import {browseThemes,featureTags} from '@/lib/customer-copy';
import {cardPath,shortText,networkBrand,networkBrands} from '@/lib/card-presentation';
const categories=[{tag:'전체',icon:Sparkles},{tag:'무실적',icon:CreditCard},{tag:'쇼핑',icon:ShoppingBag},{tag:'커피',icon:Coffee},{tag:'교통',icon:Bus},{tag:'K패스',icon:Bus},{tag:'통신',icon:Smartphone},{tag:'마일리지',icon:Plane},{tag:'라운지',icon:Plane},{tag:'마티나골드',icon:Plane},{tag:'해외',icon:Plane},{tag:'상품권 가능',icon:ShoppingBag},{tag:'관리비',icon:CreditCard},{tag:'국세',icon:FileText},{tag:'지방세',icon:FileText},{tag:'혜자카드',icon:Sparkles}];
const normalize=(s:string)=>s.toLowerCase().replace(/[\s#·_-]/g,'');
const matches=(str:string,query:string)=>!query.trim()||query.trim().split(/\s+/).every(q=>normalize(str).includes(normalize(q)));
const won=(n:number)=>n===0?'없음':n>=10000?`${Number((n/10000).toFixed(2))}만원`:`${n.toLocaleString('ko-KR')}원`;
const sections=[{id:'cards',label:'카드상품 검색'},{id:'cashback',label:'발급이벤트'},{id:'events',label:'카드사 이벤트'}];
const PAGE=24;
// 결제 브랜드는 같은 브랜드의 여러 표기(UnionPay·유피아이·UPI 등)를 하나로 묶고 많이 쓰는 순서로 보여 줌
const BRAND_ORDER=['visa','mastercard','amex','jcb','unionpay','domestic'];
// 목록 카드에서 내용 없는 안내 문구(공식 진행 이벤트 · 상세 혜택 및 참여 조건 확인 등)는 숨김
const PLACEHOLDER_TEXT=/^(?:공식 진행 이벤트 · 상세 혜택 및 참여 조건 확인|공식 혜택·이벤트 확인)$/;
const listOffer=(o:Offer)=>PLACEHOLDER_TEXT.test(o.benefitText.trim())?{...o,benefitText:o.title}:o;
const daysBefore=(day:string,days:number)=>new Date(Date.parse(day)-days*864e5).toISOString().slice(0,10);
function MoreButton({label,rest,onClick}:{label:string;rest:number;onClick:()=>void}){return <button className="pm-more" onClick={onClick}>{label}<span className="pm-more-rest">{rest.toLocaleString('ko-KR')}개 남음</span><ChevronDown size={16} aria-hidden="true"/></button>;}
function SelectFilter({label,value,set,options}:{label:string;value:string;set:(v:string)=>void;options:{value:string;label:string}[]}){return <label className="pm-select"><span>{label}</span><select value={value} onChange={e=>set(e.target.value)}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;}
export default function Catalog({initialCards,initialEvents,eventsLoading=false}:{initialCards:Card[];initialEvents:Offer[];eventsLoading?:boolean}){
  const [cards,setCards]=useState(initialCards);
  const events=useMemo(()=>dedupeOffers(initialEvents),[initialEvents]);
  const [eligibilityMode,setEligibilityMode]=useState("benefit");const [onlyEvents,setOnlyEvents]=useState(false);const [entryOnly,setEntryOnly]=useState(false);
  const [tab,setTab]=useState("cards"),[query,setQuery]=useState(""),[selectedTags,setTags]=useState<string[]>([]);
  const [issuer,setIssuer]=useState("all"),[type,setType]=useState("all"),[brand,setBrand]=useState("all"),[fee,setFee]=useState("all"),[spend,setSpend]=useState("all"),[verified,setVerified]=useState(false),[docs,setDocs]=useState(false),[sort,setSort]=useState("complete");
  const [eventCard,setEventCard]=useState('all');
  const [benefitKind,setBenefitKind]=useState("all"),[eventType,setEventType]=useState("all"),[channel,setChannel]=useState("all");
  const [pageWindow,setPageWindow]=useState({key:"",count:PAGE});
  const [loadFailed,setLoadFailed]=useState(false),[loadAttempt,setLoadAttempt]=useState(0);
  useEffect(() => {
    let mounted = true;
    setLoadFailed(false);
    readCardSummaries().then(data => {
      if (mounted) setCards(data);
    }).catch(() => {
      if (mounted) setLoadFailed(true);
    });
    return () => { mounted = false; };
  }, [loadAttempt]);
  useEffect(()=>{const change=()=>{const hash=location.hash.slice(1);const cardId=new URLSearchParams(location.search).get('card');if(cardId)setEventCard(cardId);if(sections.some(section=>section.id===hash))setTab(hash);};change();window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
  const [currentDay,setCurrentDay]=useState("");useEffect(()=>{const update=()=>setCurrentDay(new Date(Date.now()+9*3600000).toISOString().slice(0,10));update();const timer=setInterval(update,60000);return()=>clearInterval(timer);},[]);
  const filterKey=JSON.stringify([query,selectedTags,issuer,type,brand,fee,spend,verified,docs,sort,tab,benefitKind,eventType,channel,onlyEvents,entryOnly,eligibilityMode,eventCard]);
  const limit=pageWindow.key===filterKey?pageWindow.count:PAGE;
  const brands=useMemo(()=>networkBrands(cards.flatMap(c=>c.brands)).sort((a,b)=>(BRAND_ORDER.indexOf(a.key)+1||99)-(BRAND_ORDER.indexOf(b.key)+1||99)||a.label.localeCompare(b.label,'ko')),[cards]);

  const toggleTag=(tag:string)=>{if(tag==="전체"){setTags([]);return;}setTags(prev=>prev.includes(tag)?prev.filter(t=>t!==tag):[...prev,tag]);};
  const reset=()=>{setQuery("");setTags([]);setIssuer("all");setType("all");setBrand("all");setFee("all");setSpend("all");setVerified(false);setDocs(false);setBenefitKind("all");setEventType("all");setChannel("all");setOnlyEvents(false);setEntryOnly(false);setEligibilityMode("benefit");setEventCard("all");const u=new URL(location.href);u.searchParams.delete("card");history.replaceState(null,"",u.pathname+u.search+u.hash);};
  const filteredCards=useMemo(()=>cards.filter(c=>{
    const tags=browseThemes(c);
    return (!onlyEvents||linkedOffers(c,events).length>0)&&matches([c.name,c.issuer,c.searchText??c.description,...tags,...c.brands,...c.benefits.map(b=>`${b.title} ${b.detail}`)].join(" "),query)&&selectedTags.every(t=>t==="혜자카드"?!!bestPicking(c):ELIGIBILITY_THEMES.includes(t as typeof ELIGIBILITY_THEMES[number])?matchesPaymentEligibility(c,t,eligibilityMode as 'spend'|'benefit'|'both'|'any'):tags.includes(t))&&(issuer==="all"||(c.issuerGroup??issuerGroup(c.issuer))===issuer)&&(benefitKind==="all"||benefitKinds(c).includes(benefitKind))&&(type==="all"||c.type===type)&&(brand==="all"||c.brands.some(b=>networkBrand(b).key===brand))&&(fee==="all"||(c.annualFeeMin!==null&&c.annualFeeMin<=Number(fee)))&&(spend==="all"||(c.minimumSpend!==null&&c.minimumSpend<=Number(spend)))&&(!verified||c.issuanceStatus==="confirmed")&&(!docs||!!c.termsUrl);
  }).sort((a,b)=>(sort==="picking"||selectedTags.includes("혜자카드"))?(bestPicking(b)?.value??-Infinity)-(bestPicking(a)?.value??-Infinity):sort==="fee"?(a.annualFeeMin??Infinity)-(b.annualFeeMin??Infinity):sort==="name"?a.name.localeCompare(b.name,"ko"):(b.normalization?.qualityScore??0)-(a.normalization?.qualityScore??0)||a.name.localeCompare(b.name,"ko")),[cards,events,query,selectedTags,issuer,type,brand,fee,spend,verified,docs,sort,benefitKind,onlyEvents,currentDay,eligibilityMode]);
  const cardGroups=useMemo(()=>{const all=new Map(groupCards(cards).map(g=>[cardFamilyKey(g.card),g.variants]));return groupCards(filteredCards).map(g=>({...g,variants:all.get(cardFamilyKey(g.card))??g.variants}));},[cards,filteredCards]);
  const selectedEventCard=cards.find(c=>c.id===eventCard);
  const eventCardVariants=selectedEventCard?cards.filter(c=>cardFamilyKey(c)===cardFamilyKey(selectedEventCard)):[];
  const queryCards=useMemo(()=>query.trim()?cards.filter(c=>matches([c.issuer,c.name,c.familyName??'',...(c.searchAliases??[])].join(' '),query)):[],[cards,query]);
  const eventCardOptions=useMemo(()=>groupCards(cards.filter(c=>issuer==='all'||issuerGroup(c.issuer)===issuer)),[cards,issuer]);
  const eventMatches=(o:Offer)=>(issuer==="all"||issuerGroup(o.issuer)===issuer)&&(eventType==="all"||eventCategory(o)===eventType)&&(channel==="all"||o.channel===channel)&&(!entryOnly||requiresEntry(o))&&(eventCard==='all'||eventCardVariants.some(c=>offerApplies(c,o)))&&(matches([o.title,o.issuer,o.description,o.benefitText,o.channel??"",...o.tags,...offerTags(o)].join(" "),query)||queryCards.some(c=>offerApplies(c,o)));
  const filteredEvents=dedupeOffers(events).filter(o=>(tab==="events"||visibleOffer(o))&&(tab==="cashback"?o.kind==="cashback":o.kind==="card")&&(tab==="events"?currentMonthOffer(o):activeOffer(o))&&eventMatches(o)).sort((a,b)=>(a.endsAt??'').localeCompare(b.endsAt??''));
  // 진행 중인 발급이벤트가 적을 때 참고하도록 최근 두 달 안에 끝난 발급이벤트를 따로 접어서 보여 줌
  const endedCashback=tab==='cashback'&&currentDay?dedupeOffers(events).filter(o=>o.kind==='cashback'&&visibleOffer(o)&&offerStatus(o,currentDay)==='종료'&&!!o.endsAt&&o.endsAt>=daysBefore(currentDay,62)&&eventMatches(o)):[];
  useEffect(()=>{
    const context=(document as Document & {modelContext?:{registerTool:(tool:unknown,options:unknown)=>void|Promise<void>}}).modelContext;if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const register=context.registerTool({name:"search_mr_cards",title:"Mr. Cards 혜택 검색",description:"카드와 이벤트를 검색하고 화면의 검색어와 탭을 변경합니다.",inputSchema:{type:"object",properties:{query:{type:"string"},section:{type:"string",enum:["cards","cashback","events"]}},required:["query","section"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:(input:unknown)=>{if(!input||typeof input!=="object")throw new Error("검색 조건이 필요합니다.");const x=input as {query?:unknown;section?:unknown};if(typeof x.query!=="string"||x.query.length>200||typeof x.section!=="string"||!["cards","cashback","events"].includes(x.section))throw new Error("올바른 검색어와 섹션을 입력하세요.");flushSync(()=>{setQuery(x.query as string);setTab(x.section as string);setTags([]);setIssuer("all");setType("all");setBrand("all");setFee("all");setSpend("all");setVerified(false);setDocs(false);setEventCard("all");});return {query:x.query,section:x.section};}},{signal:lifecycle.signal});Promise.resolve(register).catch(()=>{});return()=>lifecycle.abort();
  },[]);

  const advancedCount=Number(type!=='all')+Number(brand!=='all')+Number(fee!=='all')+Number(spend!=='all')+Number(benefitKind!=='all')+Number(verified)+Number(docs)+Number(onlyEvents);
  const hasFilters=!!query||selectedTags.length>0||issuer!=='all'||advancedCount>0||eventType!=='all'||channel!=='all'||entryOnly||eventCard!=='all';
  const changeTab=(id:string)=>{setTab(id);reset();history.replaceState(null,'','#'+id);};
  return <div className="pm-site">
    <a className="pm-skip" href="#main-content">본문으로 이동</a>
    <SiteHeader current={tab} onNav={changeTab}/>
    <main id="main-content" className="pm-main">
      <div className="pm-intro"><h1>{tab==='cashback'?'발급이벤트':tab==='events'?'카드사 이벤트':'카드상품 검색'}</h1><p>{tab==='cashback'?'새 카드를 발급할 때 받는 캐시백을 카드사·발급 채널별로 비교해 보세요.':tab==='events'?'할인부터 포인트까지, 이번 달 카드사 이벤트를 모았어요.':'원하는 혜택으로 내 생활에 맞는 카드를 찾아보세요.'}</p></div>
      <div className="pm-search"><Search size={22} aria-hidden="true"/><input aria-label="카드·혜택·이벤트 검색" value={query} onChange={e=>setQuery(e.target.value)} placeholder={tab==='cards'?'카드 이름, 가맹점 또는 혜택 검색':'카드사 또는 이벤트 검색'}/>{query&&<button aria-label="검색어 지우기" onClick={()=>setQuery('')}><X size={18}/></button>}</div>
      {tab==='cards'&&<div className="pm-chips" aria-label="혜택 선택">{categories.map(({tag,icon:Icon})=><button key={tag} aria-pressed={tag==='전체'?selectedTags.length===0:selectedTags.includes(tag)} onClick={()=>toggleTag(tag)}><Icon size={15} aria-hidden="true"/>{tag}</button>)}</div>}
      {tab==='events'&&<div className="pm-chips" aria-label="이벤트 종류">{['all',...EVENT_CATEGORIES].map(t=><button key={t} aria-pressed={eventType===t} onClick={()=>setEventType(t)}>{t==='all'?'전체':t}</button>)}</div>}
      {loadFailed&&<div className="pm-load-error" role="status">전체 목록을 불러오지 못했어요.<button onClick={()=>setLoadAttempt(v=>v+1)}>다시 불러오기</button></div>}
      {['cards','cashback','events'].includes(tab)&&<IssuerLogoFilter value={issuer} onChange={setIssuer}/>}
      {tab==='cards'&&<>
        <div className="pm-toolbar">

          <details className="pm-advanced"><summary><SlidersHorizontal size={16}/>상세 필터{advancedCount>0&&<b>{advancedCount}</b>}<ChevronDown size={14}/></summary><div className="pm-advanced-panel">
            <SelectFilter label="카드 종류" value={type} set={setType} options={[{value:'all',label:'전체'},{value:'credit',label:'신용카드'},{value:'debit',label:'체크카드'}]}/>
            <SelectFilter label="연회비" value={fee} set={setFee} options={[{value:'all',label:'전체'},{value:'0',label:'연회비 없음'},{value:'20000',label:'2만원 이하'},{value:'50000',label:'5만원 이하'},{value:'100000',label:'10만원 이하'}]}/>
            <SelectFilter label="전월실적" value={spend} set={setSpend} options={[{value:'all',label:'전체'},{value:'0',label:'무실적'},{value:'300000',label:'30만원 이하'},{value:'500000',label:'50만원 이하'},{value:'1000000',label:'100만원 이하'}]}/>
            <SelectFilter label="혜택 방식" value={benefitKind} set={setBenefitKind} options={[{value:'all',label:'전체'},...BENEFIT_KINDS.map(i=>({value:i,label:i}))]}/>
            <SelectFilter label="브랜드" value={brand} set={setBrand} options={[{value:'all',label:'전체'},...brands.map(b=>({value:b.key,label:b.label}))]}/>
            <div className="pm-checks"><label><input type="checkbox" checked={onlyEvents} onChange={e=>setOnlyEvents(e.target.checked)}/>이벤트 있는 카드</label><label><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>발급 안내 있는 카드</label><label><input type="checkbox" checked={docs} onChange={e=>setDocs(e.target.checked)}/>상품설명서 있는 카드</label></div>
          </div></details>
          {hasFilters&&<button className="pm-reset" onClick={reset}>초기화</button>}
          <div className="pm-toolbar-end"><span aria-live="polite"><strong>{cardGroups.length.toLocaleString('ko-KR')}</strong>개 카드</span><select aria-label="카드 정렬" value={selectedTags.includes('혜자카드')?'picking':sort} disabled={selectedTags.includes('혜자카드')} onChange={e=>setSort(e.target.value)}><option value="complete">기본순</option><option value="picking">피킹률 높은순</option><option value="fee">연회비 낮은순</option><option value="name">이름순</option></select></div>
        </div>
        {selectedTags.length>0&&<div className="pm-applied"><span>선택한 혜택</span>{selectedTags.map(t=><button key={t} onClick={()=>toggleTag(t)} aria-label={t+' 필터 해제'}>{t}<X size={12}/></button>)}</div>}
        {selectedTags.some(t=>ELIGIBILITY_THEMES.includes(t as typeof ELIGIBILITY_THEMES[number]))&&<div className="pm-eligibility"><SelectFilter label="적용 기준" value={eligibilityMode} set={setEligibilityMode} options={[{value:'benefit',label:'적립·할인 제공'},{value:'spend',label:'실적 인정(전월·연간)'},{value:'both',label:'같은 범위에서 실적·혜택 모두'},{value:'any',label:'실적 또는 혜택 가능'}]}/></div>}
        <div className="pm-card-grid">{cardGroups.slice(0,limit).map(({card})=>{
          const linkedCount=dedupeOffers(cards.filter(c=>cardFamilyKey(c)===cardFamilyKey(card)).flatMap(c=>linkedOffers(c,events))).length;const best=bestPicking(card);const uniqueBenefits=Array.from(new Map(card.benefits.map(b=>[b.title,b])).values()).slice(0,2);
          return <a className="pm-card" key={card.id} href={cardPath(card.id)} data-navigation="document"><div className="pm-card-header"><span className="pm-card-issuer"><IssuerLogo issuer={card.issuer}/><i>{card.type==='credit'?'신용':'체크'}</i></span><div className="pm-card-score">{best?<><span>최고피킹률</span><strong>{formatPicking(best.value)}%</strong>{pickingRange(card)?.min!==best.value&&<small>피킹률 {pickingRange(card)?.label}</small>}</>:<span>최고피킹률 확인 중</span>}</div></div><div className="pm-card-top"><CardArtwork card={card}/><div className="pm-card-copy"><h2>{card.familyName??card.name}</h2>{linkedCount>0&&<span className="pm-card-event-count">진행 중 이벤트 {linkedCount}개</span>}<div className="pm-card-benefits">{uniqueBenefits.map((b,i)=><p key={i}>{shortText(b.title,65)}</p>)}</div><div className="pm-card-hashtags">{featureTags(card).slice(0,4).map(tag=><span key={tag}>#{tag}</span>)}</div></div></div><div className="pm-card-bottom"><div><span>연회비</span><strong>{card.annualFeeMin===null?'—':won(card.annualFeeMin)+(card.annualFeeMin>0?'부터':'')}</strong></div><div><span>전월실적</span><strong>{card.minimumSpend===null?'—':card.minimumSpend===0?'무실적':won(card.minimumSpend)+'부터'}</strong></div><ArrowRight size={19} aria-hidden="true"/></div></a>;
        })}</div>
        {!filteredCards.length&&<div className="pm-empty"><Search size={28}/><h2>조건에 맞는 카드가 없어요</h2><p>선택한 조건을 조금 줄여보세요.</p><button onClick={reset}>전체 카드 보기</button></div>}
        {cardGroups.length>limit&&<MoreButton label="카드 더 보기" rest={cardGroups.length-limit} onClick={()=>setPageWindow({key:filterKey,count:limit+PAGE})}/>}
      </>}
      {(['events','cashback'] as const).includes(tab as 'events'|'cashback')&&<>
        <>
          <div className="pm-event-card-filter"><SelectFilter label="내 카드로 찾기" value={selectedEventCard?(eventCardOptions.find(g=>g.variants.some(v=>v.id===selectedEventCard.id))?.card.id??eventCard):'all'} set={setEventCard} options={[{value:'all',label:'모든 카드'},...eventCardOptions.map(g=>({value:g.card.id,label:g.card.issuer+' · '+(g.card.familyName??g.card.name)}))]}/>{eventCard!=='all'&&<p>카드별 응모·발급 경로·브랜드 조건을 확인하세요.</p>}</div>
          <div className="pm-toolbar">{tab==='cashback'?<SelectFilter label="발급 채널" value={channel} set={setChannel} options={[{value:'all',label:'모든 채널'},...Array.from(new Set(events.filter(o=>o.kind==='cashback'&&visibleOffer(o)).map(o=>o.channel??'공식'))).map(i=>({value:i,label:i}))]}/>:<label className="pm-check"><input type="checkbox" checked={entryOnly} onChange={e=>setEntryOnly(e.target.checked)}/>응모 이벤트</label>}{hasFilters&&<button className="pm-reset" onClick={reset}>초기화</button>}<span className="pm-toolbar-end" aria-live="polite">{eventsLoading?'불러오는 중':`${filteredEvents.length}개 이벤트`}</span></div>
          {eventsLoading?<div className="pm-empty" role="status"><h2>이벤트를 불러오고 있어요</h2></div>:tab==='cashback'?<CashbackGroups offers={filteredEvents}/>:<EventBoard offers={filteredEvents.slice(0,limit).map(listOffer)}/>}
          {!eventsLoading&&tab==='events'&&filteredEvents.length>limit&&<MoreButton label="이벤트 더 보기" rest={filteredEvents.length-limit} onClick={()=>setPageWindow({key:filterKey,count:limit+PAGE})}/>}
          {!eventsLoading&&!filteredEvents.length&&(hasFilters?<div className="pm-empty"><h2>조건에 맞는 이벤트가 없어요</h2><p>선택한 조건을 조금 줄여보세요.</p><button onClick={reset}>전체 이벤트 보기</button></div>:<div className="pm-empty"><h2>지금 진행 중인 {tab==='cashback'?'발급이벤트가':'이벤트가'} 없어요</h2><p>카드사가 새 이벤트를 올리면 여기에 나타나요.</p></div>)}
          {!eventsLoading&&endedCashback.length>0&&<details className="pm-ended"><summary><span>최근 끝난 발급이벤트 {endedCashback.length}개</span><small>참고용이에요. 다시 열렸는지는 카드사에서 확인하세요.</small></summary><CashbackGroups offers={endedCashback}/></details>}
          {tab==='events'&&<PersonalBenefits issuer={issuer}/>}
        </>
      </>}
    </main><SiteFooter/>
  </div>;
}
