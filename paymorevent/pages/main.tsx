import {lazy, Suspense, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SiteHeader, SiteFooter} from '@/components/customer-shell';
import type {Card, Offer} from '@/lib/catalog-types';
import {sitePath} from '@/lib/site-path';
import {readCard, readCardFamily, readEvent, readEventLinks, readEventList, readHomeCards, readSearchableCards, type RelatedCard} from './data';
import '@/app/globals.css';
import '@/app/responsive.css';
import '@/app/customer-update.css';
import '@/app/customer.css';
import '@/app/database.css';
import '@/app/issuer-ui.css';
import '@/app/mr-cards.css';
import '@/app/mr-cards-dark.css';

// 첫 화면을 빨리 띄우려고 화면 코드는 나눠 받고, 데이터는 JS에 넣지 않고 화면별로 필요한 JSON만 받습니다.
// 머리글·바닥글과 공통 CSS만 먼저 오고, 나머지는 필요한 화면에서 동시에 내려받습니다.
//   목록: home-cards.json(첫 24장) → card-list.json·card-search.json, event-list.json
//   카드 상세: card-data/<id>.json, card-family/<id>.json(같은 카드 묶음), event-links.json(카드를 지정한 이벤트)
//   이벤트 상세: event-data/<id>.json(이벤트 하나 + 연결된 카드)
// 이 JSON들은 빌드 때 scripts/card-list.mjs, scripts/page-data.ts가 만듭니다(호텔 자체 혜택 이벤트는 여기서 빠짐).
const loadCatalog = () => import('@/components/catalog');
const loadCardDetail = () => import('./card-detail');
const loadEventDetail = () => import('./event-detail');
const Catalog = lazy(loadCatalog);
const CardDetail = lazy(loadCardDetail);
const EventDetail = lazy(loadEventDetail);
const catalogRoute = /^(cards|events)\/([a-zA-Z0-9][a-zA-Z0-9._-]*)\/?$/;

function Status({message}: {message: string}) {
  return <div className="pm-site pm-detail">
    <SiteHeader />
    <main className="pm-detail-main">
      <h1 role="status">{message}</h1>
      <a className="pm-back" href={sitePath()}>Mr. Cards 홈으로</a>
    </main>
    <SiteFooter />
  </div>;
}

// 불러오는 동안 화면 뼈대를 먼저 보여 줘서 레이아웃이 덜 흔들리게 함 (글자는 화면 낭독기용)
function Loading({message, kind}: {message: string; kind: 'list' | 'detail'}) {
  const tab = /^#(cards|cashback|events)$/.exec(location.hash)?.[1] ?? 'cards';
  return <div className={kind === 'list' ? 'pm-site' : 'pm-site pm-detail'}>
    <SiteHeader current={kind === 'list' ? tab : undefined} />
    <main className={kind === 'list' ? 'pm-main' : 'pm-detail-main'} aria-busy="true">
      <p role="status" className="sr-only">{message}</p>
      {kind === 'list'
        ? <div className="mc-skel-list" aria-hidden="true">
            <i className="mc-skel mc-skel-title" /><i className="mc-skel mc-skel-line" /><i className="mc-skel mc-skel-search" />
            <div className="mc-skel-chips">{Array.from({length: 6}, (_, i) => <i key={i} className="mc-skel" />)}</div>
            <div className="mc-skel-grid">{Array.from({length: 6}, (_, i) => <i key={i} className="mc-skel mc-skel-card" />)}</div>
          </div>
        : <div className="mc-skel-detail" aria-hidden="true">
            <i className="mc-skel mc-skel-line" /><i className="mc-skel mc-skel-hero" /><i className="mc-skel mc-skel-title" />
            <i className="mc-skel mc-skel-line" /><i className="mc-skel mc-skel-line" /><i className="mc-skel mc-skel-block" />
          </div>}
    </main>
    <SiteFooter />
  </div>;
}

type DetailData =
  | {kind: 'cards'; card: Card | null; cards: Card[]; events: Offer[]}
  | {kind: 'events'; event: {offer: Offer; related: RelatedCard[]} | null};

function Detail({kind, id}: {kind: 'cards' | 'events'; id: string}) {
  const [data, setData] = useState<DetailData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    (kind === 'cards' ? loadCardDetail() : loadEventDetail()).catch(() => {}); // 화면 코드도 데이터와 동시에 받기
    const request: Promise<DetailData> = kind === 'cards'
      ? Promise.all([readCard(id), readCardFamily(id), readEventLinks()]).then(([card, cards, events]) => ({kind, card, cards, events}))
      : readEvent(id).then(event => ({kind, event}));
    request
      .then(result => {
        if (!mounted) return;
        setData(result);
        const name = result.kind === 'cards' ? result.card?.name : result.event?.offer.title;
        if (name) document.title = `${name} | Mr. Cards`;
      })
      .catch(() => { if (mounted) setFailed(true); });
    return () => { mounted = false; };
  }, [kind, id]);

  if (failed) return <Status message="상세 정보를 불러오지 못했습니다." />;
  const loading = <Loading kind="detail" message="상세 정보를 불러오고 있습니다." />;
  if (!data) return loading;
  if (data.kind === 'events') {
    if (!data.event) return <Status message="이벤트를 찾을 수 없습니다." />;
    return <Suspense fallback={loading}><EventDetail offer={data.event.offer} related={data.event.related} /></Suspense>;
  }
  if (data.card) return <Suspense fallback={loading}><CardDetail card={data.card} catalog={{cards: data.cards, events: data.events}} /></Suspense>;
  return <Status message="카드를 찾을 수 없습니다." />;
}

// 목록 화면: 화면 코드와 첫 카드 목록을 먼저 받아 바로 그리고, 이벤트는 그다음에 받아 채움
// (이벤트 탭 주소로 들어오면 이벤트도 처음부터 같이 받음)
function Home() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [events, setEvents] = useState<Offer[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let mounted = true;
    const fail = () => { if (mounted) setFailed(true); };
    const first = Promise.all([readHomeCards(), loadCatalog()]);
    first.then(([data]) => { if (mounted) setCards(data); }, fail);
    // 첫 화면이 뜨면 전체 카드 목록도 바로 받기 시작(목록 화면이 같은 요청을 이어받음. 실패하면 목록 화면이 다시 시도)
    first.then(() => readSearchableCards()).catch(() => {});
    (/^#(events|cashback)$/.test(location.hash) ? readEventList() : first.then(readEventList))
      .then(data => { if (mounted) setEvents(data); }, fail);
    return () => { mounted = false; };
  }, []);
  if (failed) return <Status message="화면을 불러오지 못했습니다. 새로고침해 주세요." />;
  const loading = <Loading kind="list" message="카드 목록을 불러오고 있습니다." />;
  if (!cards) return loading;
  return <Suspense fallback={loading}><Catalog initialCards={cards} initialEvents={events ?? NO_EVENTS} eventsLoading={!events} /></Suspense>;
}
const NO_EVENTS: Offer[] = [];

const pathname = window.location.pathname;
const relativePath = pathname.startsWith(sitePath()) ? pathname.slice(sitePath().length) : '';
const detail = catalogRoute.exec(relativePath);
const root = createRoot(document.getElementById('root')!);

if (detail) {
  const kind = detail[1] === 'cards' ? 'cards' : 'events';
  root.render(<Detail kind={kind} id={detail[2]} />);
} else if (relativePath === '' || relativePath === 'index.html') {
  root.render(<Home />);
} else {
  root.render(<Status message="페이지를 찾을 수 없습니다." />);
}
