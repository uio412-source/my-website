import {lazy, Suspense, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SiteHeader, SiteFooter} from '@/components/customer-shell';
import type {Card, Offer} from '@/lib/catalog-types';
import {sitePath} from '@/lib/site-path';
import {readCard, readCardSummaries} from './data';
import '@/app/mr-cards.css';
import '@/app/mr-cards-dark.css';
import '@/app/mc.css';

// 첫 화면을 빨리 띄우려고 화면 코드와 큰 데이터(이벤트 2MB, 첫 카드 목록)는 따로 받습니다.
// 머리글·바닥글과 공통 CSS만 먼저 오고, 나머지는 필요한 화면에서 동시에 내려받습니다.
const loadCatalog = () => import('@/components/catalog');
const loadCardDetail = () => import('./card-detail');
const loadEventDetail = () => import('./event-detail');
const Catalog = lazy(loadCatalog);
const CardDetail = lazy(loadCardDetail);
const EventDetail = lazy(loadEventDetail);
let eventsRequest: Promise<Offer[]> | undefined;
const readEvents = () => eventsRequest ??= import('@/data/events.json').then(module => module.default as Offer[]);
const readHomeCards = () => import('@/data/home-cards.json').then(module => module.default as Card[]);
const catalogRoute = /^(cards|events)\/([a-zA-Z0-9][a-zA-Z0-9._-]*)\/?$/;

function Status({message}: {message: string}) {
  return <div className="pm-site mc">
    <SiteHeader />
    <main className="mc-main mc-detail">
      <p className="mc-empty" role="status">{message}</p>
      <a className="mc-back" href={sitePath()}>← Mr. Cards 홈으로</a>
    </main>
    <SiteFooter />
  </div>;
}

function Detail({kind, id}: {kind: 'cards' | 'events'; id: string}) {
  const [data, setData] = useState<{cards: Card[]; card: Card | null; events: Offer[]} | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    (kind === 'cards' ? loadCardDetail() : loadEventDetail()).catch(() => {}); // 화면 코드도 데이터와 동시에 받기
    Promise.all([readCardSummaries(), kind === 'cards' ? readCard(id) : Promise.resolve(null), readEvents()])
      .then(([cards, card, events]) => {
        if (!mounted) return;
        setData({cards, card, events});
        const name = card?.name ?? events.find(event => event.id === id)?.title;
        if (name) document.title = `${name} | Mr. Cards`;
      })
      .catch(() => { if (mounted) setFailed(true); });
    return () => { mounted = false; };
  }, [kind, id]);

  if (failed) return <Status message="상세 정보를 불러오지 못했습니다." />;
  if (!data) return <Status message="상세 정보를 불러오고 있습니다." />;
  const loading = <Status message="상세 정보를 불러오고 있습니다." />;
  if (kind === 'events') {
    const offer = data.events.find(event => event.id === id);
    if (!offer) return <Status message="이벤트를 찾을 수 없습니다." />;
    return <Suspense fallback={loading}><EventDetail offer={offer} cards={data.cards} events={data.events} /></Suspense>;
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
    (/^#(events|cashback)$/.test(location.hash) ? readEvents() : first.then(readEvents))
      .then(data => { if (mounted) setEvents(data); }, fail);
    return () => { mounted = false; };
  }, []);
  if (failed) return <Status message="화면을 불러오지 못했습니다. 새로고침해 주세요." />;
  const loading = <Status message="카드 목록을 불러오고 있습니다." />;
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
