import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import Catalog from '@/components/catalog';
import {SiteHeader, SiteFooter} from '@/components/customer-shell';
import initialCards from '@/data/home-cards.json';
import eventSnapshot from '@/data/events.json';
import type {Card, Offer} from '@/lib/catalog-types';
import {sitePath} from '@/lib/site-path';
import CardDetail from './card-detail';
import EventDetail from './event-detail';
import {readCard, readCardSummaries} from './data';
import '@/app/globals.css';
import '@/app/responsive.css';
import '@/app/customer-update.css';
import '@/app/customer.css';
import '@/app/database.css';
import '@/app/issuer-ui.css';
import '@/app/mr-cards.css';
import '@/app/mr-cards-dark.css';

const events = eventSnapshot as Offer[];
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

function Detail({kind, id}: {kind: 'cards' | 'events'; id: string}) {
  const [data, setData] = useState<{cards: Card[]; card: Card | null} | null>(null);
  const [failed, setFailed] = useState(false);
  const offer = kind === 'events' ? events.find(event => event.id === id) : undefined;

  useEffect(() => {
    if (kind === 'events' && !offer) return;
    let mounted = true;
    Promise.all([readCardSummaries(), kind === 'cards' ? readCard(id) : Promise.resolve(null)])
      .then(([cards, card]) => {
        if (!mounted) return;
        setData({cards, card});
        const name = card?.name ?? offer?.title;
        if (name) document.title = `${name} | Mr. Cards`;
      })
      .catch(() => { if (mounted) setFailed(true); });
    return () => { mounted = false; };
  }, [kind, id, offer]);

  if (failed) return <Status message="상세 정보를 불러오지 못했습니다." />;
  if (kind === 'events' && !offer) return <Status message="이벤트를 찾을 수 없습니다." />;
  if (!data) return <Status message="상세 정보를 불러오고 있습니다." />;
  if (offer) return <EventDetail offer={offer} cards={data.cards} />;
  if (data.card) return <CardDetail card={data.card} catalog={{cards: data.cards, events}} />;
  return <Status message="카드를 찾을 수 없습니다." />;
}

const pathname = window.location.pathname;
const relativePath = pathname.startsWith(sitePath()) ? pathname.slice(sitePath().length) : '';
const detail = catalogRoute.exec(relativePath);
const root = createRoot(document.getElementById('root')!);

if (detail) {
  const kind = detail[1] === 'cards' ? 'cards' : 'events';
  root.render(<Detail kind={kind} id={detail[2]} />);
} else if (relativePath === '' || relativePath === 'index.html') {
  root.render(<Catalog initialCards={initialCards as Card[]} initialEvents={events} />);
} else {
  root.render(<Status message="페이지를 찾을 수 없습니다." />);
}
