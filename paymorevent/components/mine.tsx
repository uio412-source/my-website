// 내 카드 이벤트 모아보기(#mine): 가진 카드를 등록하면(브라우저에만 저장) 카드별로 지금 받을 수 있는 카드사 이벤트를 묶어 보여 줌
// 카드마다 +/− 로 접고 펼침. 대상 판정은 lib/my-benefits.ts (대상 카드로 적힌 것 먼저, 나머지는 같은 카드사 이벤트 중 내 카드가 빠지지 않는 것)
import {useDeferredValue, useEffect, useMemo, useState, type ComponentType} from 'react';
import {Bus, CircleCheck, Coffee, Coins, Gift, Minus, Percent, Plane, Plus, Receipt, ShoppingBag, Ticket, Trash2} from 'lucide-react';
import type {Card, Offer} from '@/lib/catalog-types';
import {CardArt, Empty, SearchBox, cardImage} from '@/components/mc-ui';
import {cardFamilyKey, eventPath, groupCards, issuerGroup} from '@/lib/catalog-model';
import {viewOf, type Field} from '@/lib/event-view';
import {myEvents} from '@/lib/my-benefits';
import {MINE_KEY, MINE_MAX, toggleMine, useStoredIds} from '@/lib/my-cards';
import {cardPath} from '@/lib/card-presentation';
import {valetHotelResults, valetMapPath, valetRules} from '@/lib/hotel-valet';
import {dday, koReading, searchScore, today} from '@/lib/mc-text';

const PAGE = 6;          // 카드마다 처음 보여 줄 이벤트 수
const RESULTS = 12;      // 카드 찾기 결과 수
const OPEN_KEY = 'mrcards.mine.open';
const nameOf = (c: Card) => c.familyName ?? c.name;
const FIELD_ICON: Record<Field, ComponentType<{'aria-hidden'?: boolean}>> = {
  '쇼핑': ShoppingBag, '해외·여행': Plane, '외식·카페': Coffee, '생활·납부': Receipt, '교통·차': Bus,
  '문화·레저': Ticket, '페이·포인트': Coins, '무이자 할부': Percent, '기타': Gift, '기타 광고': Gift, // 기타 광고는 모아보기에 안 나옴
};

/** 카드 상세 머리의 '+ 내 카드' 버튼. 같은 상품의 다른 변형이 이미 등록돼 있으면 등록된 것으로 봄 */
export function MineToggle({id, family}: {id: string; family: string[]}) {
  const ids = useStoredIds(MINE_KEY);
  const on = ids.some(x => x === id || family.includes(x));
  const [full, setFull] = useState(false);
  useEffect(() => { if (!full) return; const t = setTimeout(() => setFull(false), 1800); return () => clearTimeout(t); }, [full]);
  const toggle = () => {
    if (on) { for (const x of ids.filter(x => x === id || family.includes(x))) toggleMine(x); return; }
    if (!toggleMine(id)) setFull(true);
  };
  return <button type="button" className="mc-btn my-toggle" aria-pressed={on} onClick={toggle}>
    {full ? `최대 ${MINE_MAX}장` : on ? '내 카드 ✓' : '+ 내 카드'}
  </button>;
}

// 펼친 카드는 이 브라우저에 기억(다시 와도 그대로)
const readOpen = (): string[] | null => { try { const v = JSON.parse(localStorage.getItem(OPEN_KEY) ?? 'null'); return Array.isArray(v) ? v : null; } catch { return null; } };
const writeOpen = (ids: string[]) => { try { localStorage.setItem(OPEN_KEY, JSON.stringify(ids)); } catch { /* 이번 화면에서만 */ } };

export function MineView({cards, events, ready}: {cards: Card[]; events: Offer[]; ready: boolean}) {
  const ids = useStoredIds(MINE_KEY);
  const byId = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards]);
  const key = ids.join('|');
  const mine = useMemo(() => ids.map(id => byId.get(id)).filter((c): c is Card => !!c), [key, byId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState<string[]>(() => readOpen() ?? (ids[0] ? [ids[0]] : []));
  const toggle = (id: string) => setOpen(o => { const n = o.includes(id) ? o.filter(x => x !== id) : [...o, id]; writeOpen(n); return n; });

  // 카드별 이벤트: 대상 카드로 적힌 것 먼저, 그다음 마감 임박순
  const groups = useMemo(() => {
    const matches = myEvents(mine, cards, events);
    return mine.map(c => {
      const list = matches.filter(m => m.sure.includes(c) || m.maybe.includes(c))
        .map(m => ({o: m.o, sure: m.sure.includes(c)}))
        .sort((a, b) => Number(b.sure) - Number(a.sure) || (a.o.endsAt ?? '9').localeCompare(b.o.endsAt ?? '9'));
      return {c, list};
    });
  }, [mine, cards, events]);

  const added = (id: string) => setOpen(o => { const n = [...new Set([...o, id])]; writeOpen(n); return n; });

  if (!ready && ids.length && !mine.length) return <Empty title="내 카드를 불러오고 있어요…"/>;
  return <>
    {!mine.length && <div className="my-intro">
      <div className="my-intro-art" aria-hidden="true"><span/><span/><span/></div>
      <p>가진 카드를 등록하면<br/><b>받을 수 있는 이벤트를 카드별로</b> 모아 드려요</p>
    </div>}
    <AddCard cards={cards} mine={mine} ready={ready} onAdd={added}/>
    {groups.map(({c, list}) => <CardGroup key={c.id} card={c} list={list} open={open.includes(c.id)} onToggle={() => toggle(c.id)}/>)}
    {mine.length > 0 && <p className="mc-note my-foot">등록한 카드는 이 브라우저에만 저장돼요. 이벤트를 눌러 조건을 확인하세요.</p>}
  </>;
}

/** 카드 한 장: 머리(카드 이미지·이름·이벤트 수·+/−) → 펼치면 이벤트 줄 → 카드 상세·발레·빼기 */
function CardGroup({card, list, open, onToggle}: {card: Card; list: {o: Offer; sure: boolean}[]; open: boolean; onToggle: () => void}) {
  const [more, setMore] = useState(PAGE);
  const valet = valetRules(card.id);
  const hotels = valet.length ? Math.max(...valet.map(p => valetHotelResults(p).length)) : 0;
  const body = `my-g-${card.id}`;
  const soon = list.filter(x => x.o.endsAt && (Date.parse(x.o.endsAt) - Date.parse(today())) / 864e5 <= 7).length;
  return <section className="my-group" data-open={open ? '' : undefined}>
    <button type="button" className="my-group-h" aria-expanded={open} aria-controls={body} onClick={onToggle}>
      <CardArt card={card}/>
      <span className="my-group-t"><small>{card.issuer}</small><b>{nameOf(card)}</b></span>
      <span className="my-group-n"><span><b>{list.length}</b>건</span>{soon > 0 && <i>곧 마감 {soon}</i>}</span>
      <span className="my-pm" aria-hidden="true">{open ? <Minus/> : <Plus/>}</span>
      <span className="sr">{open ? '접기' : '펼치기'}</span>
    </button>
    {open && <div className="my-group-b" id={body}>
      {list.length ? <ul className="my-evs">{list.slice(0, more).map(({o, sure}) => {
        const v = viewOf(o);
        const Icon = FIELD_ICON[v.field];
        const d = dday(o.endsAt);
        const near = !!o.endsAt && (Date.parse(o.endsAt) - Date.parse(today())) / 864e5 <= 7;
        return <li key={o.id}><a className="my-ev" href={eventPath(o.id)}>
          <span className="my-ev-i" data-f={v.field}><Icon aria-hidden/></span>
          <span className="my-ev-t"><b>{v.name}</b>{v.value && v.name !== v.title ? <em>{v.value.text}</em> : null}</span>
          <span className="my-ev-s">
            {sure && <i className="my-sure" title="카드사 공지에 대상 카드로 적힌 이벤트"><CircleCheck aria-hidden/>내 카드</i>}
            {d && <span className={'mc-dd' + (near ? ' soon' : '')}>{d}</span>}
          </span>
        </a></li>;
      })}</ul> : <p className="my-none">지금 받을 수 있는 이벤트가 없어요.</p>}
      {list.length > more && <button type="button" className="my-more" onClick={() => setMore(n => n + 10)}>{list.length - more}건 더 보기</button>}
      <div className="my-acts">
        <a href={cardPath(card.id)}>카드 상세</a>
        {hotels > 0 && <a href={valetMapPath(card.id)}>발레파킹 {hotels}곳</a>}
        <button type="button" onClick={() => toggleMine(card.id)}><Trash2 aria-hidden/>빼기</button>
      </div>
    </div>}
  </section>;
}

/** 카드 찾아 등록: 이름(영어 카드명은 한글 읽기·초성도)으로 찾기. 전체 카드 목록을 다 받은 뒤에 찾음 */
function AddCard({cards, mine, ready, onAdd}: {cards: Card[]; mine: Card[]; ready: boolean; onAdd: (id: string) => void}) {
  const [q, setQ] = useState('');
  const query = useDeferredValue(q);
  const [full, setFull] = useState(false);
  const groups = useMemo(() => groupCards(cards).map(g => {
    const n = nameOf(g.card);
    // 같은 상품의 다른 이름(디자인·제휴 변형)도 찾을 수 있게
    const names = [...new Set(g.variants.map(nameOf))].join(' ');
    return {c: g.card, text: [[n + ' ' + koReading(n), 100], [names + ' ' + koReading(names), 70], [g.card.issuer + ' ' + issuerGroup(g.card.issuer) + ' ' + (g.card.searchAliases ?? []).join(' '), 40]] as [string, number][]};
  }), [cards]);
  const has = useMemo(() => new Set(mine.map(cardFamilyKey)), [mine]);
  // '딥드림카드'처럼 끝에 '카드'를 붙여 쳐도 찾게
  const qq = query.trim().split(/\s+/).map(t => t.replace(/카드$/, '') || t).join(' ');
  const found = useMemo(() => qq ? groups.map(g => ({c: g.c, s: searchScore(qq, g.text)})).filter(x => x.s)
    .sort((a, b) => b.s - a.s || Number(!!cardImage(b.c)) - Number(!!cardImage(a.c)) || nameOf(a.c).length - nameOf(b.c).length)
    .slice(0, RESULTS).map(x => x.c) : [], [groups, qq]);
  const add = (c: Card) => {
    if (has.has(cardFamilyKey(c))) return;
    if (!toggleMine(c.id)) { setFull(true); return; }
    setQ(''); setFull(false); onAdd(c.id);
  };
  return <div className="my-add">
    <SearchBox value={q} onChange={setQ} placeholder={mine.length ? '카드 추가 — 카드 이름 검색' : '내 카드 이름 검색 (예: 딥드림, 제로, ㄷㄷ)'}/>
    {full && <p className="my-full">내 카드는 최대 {MINE_MAX}장까지 등록할 수 있어요.</p>}
    {qq && (!ready ? <p className="my-add-sub">카드 목록을 불러오고 있어요…</p>
      : found.length ? <ul className="my-add-list">{found.map(c => {
        const on = has.has(cardFamilyKey(c));
        return <li key={c.id}><button type="button" aria-pressed={on} disabled={on} onClick={() => add(c)}>
          <CardArt card={c}/>
          <span className="my-add-t"><small>{c.issuer} · {c.type === 'credit' ? '신용' : '체크'}</small><b>{nameOf(c)}</b></span>
          <span className="my-add-btn">{on ? <><CircleCheck aria-hidden/>등록됨</> : <><Plus aria-hidden/>등록</>}</span>
        </button></li>;
      })}</ul>
      : <p className="my-add-sub">‘{q.trim()}’ 카드를 못 찾았어요. 카드 이름 일부나 카드사 이름으로 찾아보세요.</p>)}
  </div>;
}
