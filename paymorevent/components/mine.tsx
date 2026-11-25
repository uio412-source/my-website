// 내 혜택: 가진 카드를 등록하면(브라우저에만 저장) 그 카드로 지금 받을 수 있는 카드사 이벤트를 한곳에 모아 보여 줌
// 대상 판정은 lib/my-benefits.ts (확인됨 · 확인 필요)
import {useDeferredValue, useEffect, useMemo, useState} from 'react';
import type {Card, Offer} from '@/lib/catalog-types';
import {CardArt, Chips, Empty, IssuerTile, SearchBox} from '@/components/mc-ui';
import {EventGroups} from '@/components/event-row';
import {cardFamilyKey, eventPath, groupCards, issuerGroup} from '@/lib/catalog-model';
import {FIELDS, endBucket, viewOf} from '@/lib/event-view';
import {myEvents, type MineMatch} from '@/lib/my-benefits';
import {MINE_KEY, MINE_MAX, RECENT_KEY, toggleMine, useStoredIds} from '@/lib/my-cards';
import {cardPath} from '@/lib/card-presentation';
import {valetHotelResults, valetMapPath, valetRules} from '@/lib/hotel-valet';
import {koReading, searchScore, today} from '@/lib/mc-text';
import sources from '@/data/personal-benefit-sources.json';

const MAYBE_PAGE = 20;
const nameOf = (c: Card) => c.familyName ?? c.name;
const short = (c: Card) => nameOf(c).replace(/^(?:신한카드|KB국민|하나|삼성|현대카드|우리|롯데|NH농협|BC)\s+/, '');
// 혜택 큰 순: 금액(원) → 비율(%) → 나머지 (카드사 이벤트 화면과 같은 기준)
const val = (o: Offer) => { const v = viewOf(o).value; return !v ? 0 : v.won ? 2e9 + v.won : v.pct ? 1e9 + v.pct : 1; };

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

export function MineView({cards, events, ready}: {cards: Card[]; events: Offer[]; ready: boolean}) {
  const ids = useStoredIds(MINE_KEY);
  const byId = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards]);
  const key = ids.join('|');
  const mine = useMemo(() => ids.map(id => byId.get(id)).filter((c): c is Card => !!c), [key, byId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState('all');
  const [field, setField] = useState('all');
  const [soon, setSoon] = useState(false);
  const [sort, setSort] = useState<'end' | 'amount'>('end');
  const [more, setMore] = useState(MAYBE_PAGE);
  useEffect(() => { if (pick !== 'all' && !mine.some(c => c.id === pick)) setPick('all'); }, [mine, pick]);
  useEffect(() => setMore(MAYBE_PAGE), [pick, field, soon, sort]);

  const matches = useMemo(() => myEvents(mine, cards, events), [mine, cards, events]);
  const now = today();
  const forPick = (m: MineMatch) => pick === 'all' ? {sure: m.sure.length > 0, any: true} : {sure: m.sure.some(c => c.id === pick), any: [...m.sure, ...m.maybe].some(c => c.id === pick)};
  const inPick = useMemo(() => matches.filter(m => forPick(m).any), [matches, pick]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => inPick
    .filter(m => (field === 'all' || viewOf(m.o).field === field) && (!soon || (!!m.o.endsAt && (Date.parse(m.o.endsAt) - Date.parse(now)) / 864e5 <= 7)))
    .sort((a, b) => sort === 'amount' ? val(b.o) - val(a.o) : (a.o.endsAt ?? '9').localeCompare(b.o.endsAt ?? '9') || val(b.o) - val(a.o)),
  [inPick, field, soon, sort, now]);
  const sure = shown.filter(m => forPick(m).sure), maybe = shown.filter(m => !forPick(m).sure);
  const note = useMemo(() => new Map(matches.map(m => [m.o, m])), [matches]);
  const fieldCount = useMemo(() => inPick.reduce((acc, m) => { const f = viewOf(m.o).field; acc[f] = (acc[f] ?? 0) + 1; return acc; }, {} as Record<string, number>), [inPick]);
  const perCard = (c: Card) => matches.reduce((n, m) => ({sure: n.sure + Number(m.sure.includes(c)), maybe: n.maybe + Number(!m.sure.includes(c) && m.maybe.includes(c))}), {sure: 0, maybe: 0});

  if (!ready && ids.length && !mine.length) return <Empty title="내 카드를 불러오고 있어요…"/>;
  if (!mine.length) return <>
    <Intro/>
    <AddCard cards={cards} mine={mine} onDone={() => setAdding(false)} open/>
    <p className="mc-note">등록한 카드는 이 브라우저에만 저장돼요. 카드 번호 같은 개인정보는 받지 않아요.</p>
  </>;

  const soonN = inPick.filter(m => m.o.endsAt && (Date.parse(m.o.endsAt) - Date.parse(now)) / 864e5 <= 7).length;
  const top = [...inPick].sort((a, b) => Number(b.sure.length > 0) - Number(a.sure.length > 0) || (viewOf(b.o).value?.won ?? 0) - (viewOf(a.o).value?.won ?? 0))
    .find(m => (viewOf(m.o).value?.won ?? 0) > 0);
  const label = (m: MineMatch | undefined) => {
    if (!m || mine.length < 2) return null;
    const list = forPick(m).sure ? (pick === 'all' ? m.sure : m.sure.filter(c => c.id === pick)) : (pick === 'all' ? m.maybe : m.maybe.filter(c => c.id === pick));
    if (!list.length) return null;
    if (viewOf(m.o).target?.includes(short(list[0])) && list.length === 1) return null; // 대상 카드 줄과 같은 말이면 한 번만
    return <span className="ev-mine">{short(list[0])}{list.length > 1 ? ` 외 ${list.length - 1}장` : ''}</span>;
  };
  const grouped = sort === 'end';
  const counts = (list: MineMatch[]) => grouped ? list.reduce((acc, m) => { const b = endBucket(m.o.endsAt, now, m.o.status === 'active'); acc[b] = (acc[b] ?? 0) + 1; return acc; }, {} as Record<string, number>) : undefined;
  const issuers = [...new Set(mine.map(c => issuerGroup(c.issuer)))];
  const links = sources.filter(s => issuers.includes(issuerGroup(s.issuer)));

  return <>
    <section className="my-hero" aria-label="내 혜택 요약">
      <div className="my-hero-n">
        <div><b>{inPick.filter(m => forPick(m).sure).length}</b><span>대상 확인</span></div>
        <div><b>{inPick.filter(m => !forPick(m).sure).length}</b><span>확인 필요</span></div>
        <div className={soonN ? 'soon' : undefined}><b>{soonN}</b><span>7일 안 마감</span></div>
      </div>
      {top && <a className="my-hero-top" href={eventPath(top.o.id)}>
        <small>{top.sure.length ? '가장 큰 혜택' : '가장 큰 혜택 · 대상 확인 필요'}</small>
        <b>{viewOf(top.o).value?.text}</b><span>{viewOf(top.o).name} · {top.o.issuer}</span>
      </a>}
    </section>

    <div className="my-cards" role="group" aria-label="내 카드">
      {mine.map(c => {
        const n = perCard(c);
        const valet = valetRules(c.id);
        const hotels = valet.length ? Math.max(...valet.map(p => valetHotelResults(p).length)) : 0;
        return <div key={c.id} className="my-card" data-on={pick === c.id ? '' : undefined}>
          <button type="button" className="my-card-pick" aria-pressed={pick === c.id} onClick={() => setPick(p => p === c.id ? 'all' : c.id)}
            title={pick === c.id ? '모든 카드 이벤트 보기' : '이 카드 이벤트만 보기'}>
            <CardArt card={c}/>
            <span className="my-card-t"><small>{c.issuer}</small><b>{nameOf(c)}</b></span>
            <span className="my-card-n"><b>{n.sure}</b>대상 확인<i>·</i>{n.maybe} 확인 필요</span>
          </button>
          <div className="my-card-acts">
            <a href={cardPath(c.id)}>카드 상세</a>
            {hotels > 0 && <a href={valetMapPath(c.id)}>발레 {hotels}곳</a>}
            <button type="button" onClick={() => toggleMine(c.id)} aria-label={`${nameOf(c)} 내 카드에서 빼기`}>빼기</button>
          </div>
        </div>;
      })}
      {mine.length < MINE_MAX && !adding && <button type="button" className="my-card my-card-add" onClick={() => setAdding(true)}>
        <span aria-hidden="true">+</span>카드 추가
      </button>}
    </div>
    {adding && <AddCard cards={cards} mine={mine} onDone={() => setAdding(false)}/>}

    <div className="mc-filters my-filters">
      {mine.length > 1 && <Chips label="카드" items={[{value: 'all', label: '전체', count: matches.length}, ...mine.map(c => ({value: c.id, label: short(c), count: perCard(c).sure + perCard(c).maybe}))]}
        value={pick} onChange={v => setPick(p => p === v && v !== 'all' ? 'all' : v)}/>}
      <Chips label="분야" items={[{value: 'all', label: '전체', count: inPick.length}, ...FIELDS.filter(f => fieldCount[f]).map(f => ({value: f, label: f, count: fieldCount[f]}))]}
        value={field} onChange={v => setField(p => p === v && v !== 'all' ? 'all' : v)}/>
    </div>
    <div className="mc-bar">
      <label className="mc-check"><input type="checkbox" checked={soon} onChange={e => setSoon(e.target.checked)}/>7일 안 마감</label>
      <span className="mc-count">{shown.length}<small>건</small></span>
      <select className="mc-select" aria-label="정렬" value={sort} onChange={e => setSort(e.target.value as 'end' | 'amount')}><option value="end">마감 임박순</option><option value="amount">혜택 큰 순</option></select>
    </div>

    <section className="my-sec" aria-labelledby="my-sure">
      <h2 id="my-sure"><span className="my-dot ok" aria-hidden="true"/>내 카드 대상 이벤트<small>{sure.length}</small></h2>
      <p className="my-sec-sub">카드사 공지에 대상 카드로 내 카드(같은 상품의 다른 브랜드·디자인 포함)가 적혀 있거나, 카드사 전체 대상인 이벤트예요.</p>
      {sure.length ? <EventGroups list={sure.map(m => m.o)} grouped={grouped} counts={counts(sure)} hideField={field !== 'all'} noteOf={o => label(note.get(o))}/>
        : <p className="my-none">{field !== 'all' || soon ? '조건에 맞는 이벤트가 없어요.' : '대상 카드가 적힌 이벤트는 지금 없어요. 아래 카드사 이벤트에서 조건을 확인해 보세요.'}</p>}
    </section>

    <section className="my-sec" aria-labelledby="my-maybe">
      <h2 id="my-maybe"><span className="my-dot warn" aria-hidden="true"/>카드사 이벤트 · 대상 확인 필요<small>{maybe.length}</small></h2>
      <p className="my-sec-sub">내 카드의 카드사 이벤트인데 공지에 대상 카드가 안 적혀 있어요. 체크카드 제외·신용카드 전용·다른 브랜드 전용처럼 내 카드가 빠지는 건 뺐어요. 눌러서 조건을 확인하세요.</p>
      {maybe.length ? <>
        <EventGroups list={maybe.slice(0, more).map(m => m.o)} grouped={grouped} counts={counts(maybe)} hideField={field !== 'all'} noteOf={o => label(note.get(o))}/>
        {maybe.length > more && <button type="button" className="mc-more" onClick={() => setMore(n => n + MAYBE_PAGE)}>더 보기 ({maybe.length - more}건 남음)</button>}
      </> : <p className="my-none">조건에 맞는 이벤트가 없어요.</p>}
    </section>

    {links.length > 0 && <div className="my-links">
      <b>카드사 앱에서 내 맞춤 혜택 더 보기</b>
      <div>{links.map(s => <a key={s.issuer} href={s.url} target="_blank" rel="noopener noreferrer"><IssuerTile issuer={s.issuer} size="sm"/>{s.label} ↗</a>)}</div>
    </div>}
    <p className="mc-note">혜택은 카드사 공지 제목에서 읽은 최대치예요. 전월실적·최소 결제액·응모는 이벤트를 눌러 확인하세요. 발급 이벤트(신규 발급 캐시백)는 이미 가진 카드라 빼고 보여 줘요. 등록한 카드는 이 브라우저에만 저장돼요.</p>
  </>;
}

/** 카드를 하나도 등록하지 않았을 때: 무엇을 해 주는 화면인지 */
function Intro() {
  return <section className="my-intro">
    <div className="my-intro-art" aria-hidden="true"><span/><span/><span/></div>
    <div>
      <h2>가진 카드만 등록하면<br/>받을 수 있는 이벤트를 모아 드려요</h2>
      <ol>
        <li><b>카드 등록</b>이름으로 찾아 내 카드를 고르세요</li>
        <li><b>이벤트 모으기</b>카드사 이벤트 중 내 카드가 대상인 것만</li>
        <li><b>마감 순으로</b>곧 끝나는 이벤트부터 챙기세요</li>
      </ol>
    </div>
  </section>;
}

/** 카드 찾아 등록: 이름(초성 가능)으로 찾고, 안 쳤으면 최근 본 카드에서 바로 고르기 */
function AddCard({cards, mine, onDone, open}: {cards: Card[]; mine: Card[]; onDone: () => void; open?: boolean}) {
  const [q, setQ] = useState('');
  const query = useDeferredValue(q);
  const [full, setFull] = useState(false);
  const recentIds = useStoredIds(RECENT_KEY);
  const groups = useMemo(() => groupCards(cards), [cards]);
  const has = useMemo(() => new Set(mine.map(cardFamilyKey)), [mine]);
  const found = useMemo(() => query.trim()
    ? groups.map(g => ({c: g.card, s: searchScore(query, [[nameOf(g.card) + ' ' + koReading(nameOf(g.card)), 100], [g.card.issuer + ' ' + issuerGroup(g.card.issuer) + ' ' + (g.card.searchAliases ?? []).join(' '), 40]])}))
      .filter(x => x.s).sort((a, b) => b.s - a.s || nameOf(a.c).length - nameOf(b.c).length).slice(0, 8).map(x => x.c)
    : recentIds.map(id => cards.find(c => c.id === id)).filter((c): c is Card => !!c && !has.has(cardFamilyKey(c))).slice(0, 6), [groups, query, recentIds, cards, has]);
  const add = (c: Card) => {
    if (has.has(cardFamilyKey(c))) { for (const m of mine.filter(m => cardFamilyKey(m) === cardFamilyKey(c))) toggleMine(m.id); return; }
    if (!toggleMine(c.id)) { setFull(true); return; }
    setQ('');
  };
  return <section className="my-add" aria-label="카드 등록">
    <div className="my-add-h"><b>{open ? '내 카드 등록' : '카드 추가'}</b>{!open && <button type="button" className="mc-link" onClick={onDone}>닫기</button>}</div>
    <SearchBox value={q} onChange={setQ} placeholder="카드 이름 (예: 딥드림, 제로 에디션, ㄷㄷ)"/>
    {full && <p className="my-full">내 카드는 최대 {MINE_MAX}장까지 등록할 수 있어요.</p>}
    {!query.trim() && found.length > 0 && <p className="my-add-sub">최근 본 카드</p>}
    {found.length > 0 ? <ul className="my-add-list">{found.map(c => {
      const on = has.has(cardFamilyKey(c));
      return <li key={c.id}><button type="button" aria-pressed={on} onClick={() => add(c)}>
        <CardArt card={c}/>
        <span className="my-add-t"><small>{c.issuer} · {c.type === 'credit' ? '신용' : '체크'}</small><b>{nameOf(c)}</b></span>
        <span className="my-add-btn">{on ? '등록됨 ✓' : '+ 등록'}</span>
      </button></li>;
    })}</ul> : query.trim() ? <p className="my-add-sub">찾는 카드가 없어요. 다른 이름이나 초성으로 찾아보세요.</p> : null}
  </section>;
}
