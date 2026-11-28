"use client";
// Mr. Cards 목록 화면: 카드상품 검색 · 발급이벤트 · 카드사 이벤트 · 내 혜택
import {useDeferredValue, useEffect, useMemo, useState} from 'react';
import {readCardSummaries, readSearchableCards} from '@/pages/data';
import type {Card, Offer} from '@/lib/catalog-types';
import {SiteHeader, SiteFooter} from '@/components/customer-shell';
import {CardArt, Chips, Empty, IssuerTile, SearchBox, Tabs, cardImage} from '@/components/mc-ui';
import {
  BENEFIT_KINDS, activeOffer, benefitKinds, bestPicking, cardFamilyKey, currentMonthOffer, dedupeOffers,
  formatPicking, groupCards, issuerGroup, offerApplies, rewardValue, visibleOffer,
} from '@/lib/catalog-model';
import {FIELDS, endBucket, viewOf} from '@/lib/event-view';
import {EventGroups} from '@/components/event-row';
import {IssuanceView} from '@/components/issuance';
import {ELIGIBILITY_THEMES, hotelTier, useFit} from '@/lib/card-themes';
import {browseThemes} from '@/lib/customer-copy';
import {cardPath} from '@/lib/card-presentation';
import {valetRules} from '@/lib/hotel-valet';
import {sitePath} from '@/lib/site-path';
import {CompareDock, CompareToggle} from '@/components/compare';
import {MineView} from '@/components/mine';
import {spendShort} from '@/lib/card-value';
import {ISSUER_FILTERS, feeLabel, typeLabel, headlineAmount, highlights, issuerFilterLabel, koReading, RESTRICTED, searchScore, today, ymd} from '@/lib/mc-text';
import sources from '@/data/personal-benefit-sources.json';

type Tab = 'cards' | 'cashback' | 'events' | 'mine';
const SECTIONS: Record<Tab, {title: string; sub: string}> = {
  cards: {title: '카드상품 검색', sub: ''},
  cashback: {title: '발급이벤트', sub: '네이버페이 · 카카오페이 · 아정당 · 뽐뿌 발급 지원금'},
  events: {title: '카드사 이벤트', sub: '진행 중인 이벤트'},
  mine: {title: '내 카드 이벤트 모아보기', sub: ''},
};
const THEMES = ['무실적', 'K패스', '통신', '해외', '마일리지', '라운지', '마티나골드', '호텔 등급', '호텔 발레', '상품권 가능', '관리비', '국세', '지방세'] as const;
/** 이 필터들은 '왜 해당되는지'를 카드 줄에 한 줄로 보여 줌 (예: "혜택 O · 기본 1% 적립") */
const whyFor = (c: Card, t: string) => t === '호텔 등급' ? hotelTier(c) : (ELIGIBILITY_THEMES as readonly string[]).includes(t) ? useFit(c, t) : null;
const EXPLAINED = new Set<string>(['호텔 등급', ...ELIGIBILITY_THEMES]);
const PAGE = 30;
const groupOf = (issuer: string) => issuerGroup(issuer);
// 카드사 줄 칩: 카드사 타일을 붙여 혜택 칩과 구분
const ISSUER_NAME: Record<string, string> = {삼성: '삼성카드', 국민: 'KB국민카드', 신한: '신한카드', 우리: '우리카드', 하나: '하나카드', 현대: '현대카드', 롯데: '롯데카드', 농협: 'NH농협카드', BC: 'BC카드'};
const issuerItems = (groups: string[], counts?: Record<string, number>) =>
  groups.map(g => ({value: g, label: issuerFilterLabel(g), issuer: ISSUER_NAME[g], count: counts?.[g]}));

export default function Catalog({initialCards, initialEvents, eventsLoading = false}: {initialCards: Card[]; initialEvents: Offer[]; eventsLoading?: boolean}) {
  const [cards, setCards] = useState(initialCards);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [fullCards, setFullCards] = useState(false); // 처음엔 첫 화면용 카드 일부만, 전체 목록은 뒤이어 받음
  useEffect(() => {
    let on = true;
    // 내 카드 찾기는 검색 글이 필요 없어서 카드 목록만 먼저 오면 바로 씀(검색 글은 뒤이어 붙음)
    readCardSummaries().then(d => { if (on) { setCards(c => c.length < d.length ? d : c); setFullCards(true); } }, () => {});
    readSearchableCards().then(d => { if (on) { setCards(d); setFullCards(true); } }, () => on && setLoadFailed(true));
    return () => { on = false; };
  }, [attempt]);
  const events = useMemo(() => dedupeOffers(initialEvents), [initialEvents]);

  const initialTab = (): Tab => { const h = location.hash.slice(1); return h === 'cashback' || h === 'events' || h === 'mine' ? h : 'cards'; };
  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => {
    const sync = () => setTab(initialTab());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const go = (t: Tab) => { setTab(t); history.replaceState(null, '', location.pathname + location.search + '#' + t); window.scrollTo({top: 0}); };

  return <div className="pm-site mc">
    <a className="pm-skip" href="#main-content">본문으로 이동</a>
    <SiteHeader current={tab} onNav={id => go(id as Tab)}/>
    <main id="main-content" className="mc-main">
      <div className="mc-head"><h1>{SECTIONS[tab].title}</h1>{SECTIONS[tab].sub && <p>{SECTIONS[tab].sub}</p>}</div>
      {loadFailed && <div className="mc-alert" role="status">전체 카드 목록을 불러오지 못했어요. <button type="button" onClick={() => { setLoadFailed(false); setAttempt(a => a + 1); }}>다시 불러오기</button></div>}
      {tab === 'cards' && <CardsView cards={cards} events={events}/>}
      {tab !== 'cards' && tab !== 'mine' && !eventsLoading && tab === 'events' && <Freshness events={events} kind="card"/>}
      {tab !== 'cards' && (eventsLoading
        ? <Empty title="이벤트를 불러오고 있어요…"/>
        : tab === 'cashback' ? <CashbackView events={events}/> : tab === 'mine' ? <MineView cards={cards} events={events} ready={fullCards}/> : <EventsView events={events} cards={cards}/>)}
    </main>
    <SiteFooter/>
  </div>;
}

/** 이벤트 데이터가 언제 확인한 건지. 카드사마다 확인한 날이 달라서 범위로 보여 주고, 2주 넘은 게 있으면 알림 */
function Freshness({events, kind}: {events: Offer[]; kind: 'card' | 'cashback'}) {
  const days = events.filter(o => o.kind === kind && visibleOffer(o) && activeOffer(o)).map(o => o.verifiedAt).filter(Boolean).sort();
  if (!days.length) return null;
  const from = days[0], to = days[days.length - 1];
  const old = Math.round((Date.parse(today()) - Date.parse(from)) / 864e5);
  const end = from.slice(0, 4) === to.slice(0, 4) ? ymd(to).slice(3) : ymd(to);
  return <p className={'mc-fresh' + (old > 14 ? ' old' : '')}>카드사 공지 {from === to ? `${ymd(to)} 기준` : `${ymd(from)}~${end} 확인`}{old > 14 ? ' · 일부는 2주 넘게 지난 정보' : ''}</p>;
}

// ======================= 카드상품 검색 =======================
function CardsView({cards, events}: {cards: Card[]; events: Offer[]}) {
  const [q, setQ] = useState('');
  const query = useDeferredValue(q);
  // 혜택 태그는 여러 개 고를 수 있음(고른 태그를 모두 만족하는 카드). 다시 누르면 해제, '전체'는 모두 해제
  const [themes, setThemes] = useState<string[]>(() => new URLSearchParams(location.search).get('valet') ? ['호텔 발레'] : []);
  const [issuer, setIssuer] = useState('all');
  const [type, setType] = useState<'all' | 'credit' | 'debit' | 'prepaid'>('all');
  const [fee, setFee] = useState('all'), [spend, setSpend] = useState('all'), [brand, setBrand] = useState('all'), [kind, setKind] = useState('all');
  const [withEvents, setWithEvents] = useState(false);
  const [sort, setSort] = useState('best');
  const [more, setMore] = useState(PAGE);
  const [panel, setPanel] = useState(false);

  // 카드마다 한 번만 계산 (검색할 때마다 다시 하지 않게)
  const live = useMemo(() => {
    const byIssuer = new Map<string, Offer[]>();
    for (const o of events) if (visibleOffer(o) && activeOffer(o)) { const g = groupOf(o.issuer); byIssuer.set(g, [...(byIssuer.get(g) ?? []), o]); }
    return byIssuer;
  }, [events]);
  const meta = useMemo(() => {
    const m = new Map<string, {themes: string[]; best: number | null; events: number; hl: string[]; rec: number; text: [string, number][]}>();
    for (const c of cards) {
      const best = bestPicking(c)?.value ?? null;
      const hl = highlights(c, 3);
      const n = (live.get(groupOf(c.issuer)) ?? []).filter(o => offerApplies(c, o)).length;
      // 추천순: 계산된 피킹률·실물 이미지·정리된 혜택·진행 이벤트가 많을수록 위로 (데이터가 빈약한 카드는 아래로)
      const restricted = RESTRICTED.test(c.name);
      const rec = (best !== null ? 30 : 0) + (cardImage(c) ? 25 : 0) + Math.min(hl.length, 3) * 6 + Math.min(n, 5) * 3 + (c.normalization?.qualityScore ?? 0) / 10 - (restricted ? 60 : 0);
      m.set(c.id, {
        themes: browseThemes(c), best, events: n, hl, rec,
        text: [[(c.familyName ?? c.name) + ' ' + koReading(c.familyName ?? c.name), 100], [(c.searchAliases ?? []).join(' '), 80], [c.issuer + ' ' + groupOf(c.issuer), 40],
          [c.benefits.map(b => b.title).join(' '), 30], [browseThemes(c).join(' ') + ' ' + c.brands.join(' ') + ' ' + typeLabel(c.type), 25],
          [(c.searchText ?? '') + ' ' + c.benefits.map(b => b.detail).join(' '), 8]],
      });
    }
    return m;
  }, [cards, live]);
  const brands = useMemo(() => [...new Set(cards.flatMap(c => c.brands))].filter(b => b && b !== '국내전용').sort(), [cards]);

  const filtered = useMemo(() => {
    const out: {c: Card; score: number}[] = [];
    // 관리비 전용 할인 > 혜택 O(기본 적립·할인) > 실적만 O
    const elig = themes.filter(t => (ELIGIBILITY_THEMES as readonly string[]).includes(t));
    const benefitFirst = (c: Card) => elig.reduce((n, t) => { const w = whyFor(c, t); return n + (!w ? 0 : w.startsWith('혜택 O · 관리비') ? 2 : w.startsWith('혜택') ? 1 : 0); }, 0);
    for (const c of cards) {
      const m = meta.get(c.id)!;
      if (issuer !== 'all' && groupOf(c.issuer) !== issuer) continue;
      if (type !== 'all' && c.type !== type) continue;
      if (fee !== 'all' && !(c.annualFeeMin !== null && c.annualFeeMin <= Number(fee))) continue;
      if (spend !== 'all' && !(c.minimumSpend !== null && c.minimumSpend <= Number(spend))) continue;
      if (brand !== 'all' && !c.brands.includes(brand)) continue;
      if (kind !== 'all' && !benefitKinds(c).includes(kind)) continue;
      if (withEvents && !m.events) continue;
      if (!themes.every(t => t === '호텔 발레' ? valetRules(c.id).length > 0 : EXPLAINED.has(t) ? whyFor(c, t) : m.themes.includes(t))) continue;
      const score = searchScore(query, m.text);
      if (!score) continue;
      out.push({c, score});
    }
    const by: Record<string, (a: {c: Card; score: number}, b: {c: Card; score: number}) => number> = {
      // 상품권·관리비 등은 혜택까지 되는 카드를 실적만 되는 카드보다 위로
      best: (a, b) => (query ? b.score - a.score : 0) || benefitFirst(b.c) - benefitFirst(a.c) || meta.get(b.c.id)!.rec - meta.get(a.c.id)!.rec || a.c.name.localeCompare(b.c.name, 'ko'),
      picking: (a, b) => (meta.get(b.c.id)!.best ?? -1) - (meta.get(a.c.id)!.best ?? -1),
      fee: (a, b) => (a.c.annualFeeMin ?? Infinity) - (b.c.annualFeeMin ?? Infinity),
      events: (a, b) => meta.get(b.c.id)!.events - meta.get(a.c.id)!.events,
      name: (a, b) => a.c.name.localeCompare(b.c.name, 'ko'),
    };
    out.sort(by[sort]);
    // 같은 카드의 브랜드·디자인 변형은 하나로
    const seen = new Set<string>();
    return out.filter(({c}) => { const k = cardFamilyKey(c); if (seen.has(k)) return false; seen.add(k); return true; }).map(x => x.c);
  }, [cards, meta, query, themes, issuer, type, fee, spend, brand, kind, withEvents, sort]);
  useEffect(() => setMore(PAGE), [query, themes, issuer, type, fee, spend, brand, kind, withEvents, sort]);

  const pickTheme = (t: string) => setThemes(p => t === 'all' ? [] : p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  const advanced = [fee, spend, brand, kind].filter(v => v !== 'all').length + Number(withEvents);
  const anything = !!q || themes.length > 0 || issuer !== 'all' || type !== 'all' || advanced > 0;
  const reset = () => { setQ(''); setThemes([]); setIssuer('all'); setType('all'); setFee('all'); setSpend('all'); setBrand('all'); setKind('all'); setWithEvents(false); };
  const families = useMemo(() => new Set(cards.map(cardFamilyKey)).size, [cards]);

  return <>
    <SearchBox value={q} onChange={setQ} placeholder="카드명·혜택 검색 (예: 스타벅스, ㅅㅎ)"/>
    <div className="mc-filters">
      <Chips label="혜택" multi items={[{value: 'all', label: '전체'}, ...THEMES.map(t => ({value: t, label: t}))]} value={themes.length ? themes : ['all']} onChange={pickTheme}/>
      <Chips label="카드사" issuers items={[{value: 'all', label: '전체'}, ...issuerItems(ISSUER_FILTERS)]} value={issuer} onChange={setIssuer}/>
    </div>
    <div className="mc-bar">
      <Tabs label="카드 종류" items={[{value: 'all', label: '전체'}, {value: 'credit', label: '신용'}, {value: 'debit', label: '체크'}, {value: 'prepaid', label: '선불'}]} value={type} onChange={setType}/>
      <button type="button" className="mc-btn" aria-expanded={panel} onClick={() => setPanel(p => !p)}>필터{advanced > 0 && <b>{advanced}</b>}</button>
      {anything && <button type="button" className="mc-link" onClick={reset}>초기화</button>}
    </div>
    {panel && <div className="mc-panel">
      <Field label="연회비" value={fee} set={setFee} options={[['all', '전체'], ['0', '없음'], ['20000', '2만원 이하'], ['50000', '5만원 이하'], ['100000', '10만원 이하']]}/>
      <Field label="전월실적" value={spend} set={setSpend} options={[['all', '전체'], ['0', '무실적'], ['300000', '30만원 이하'], ['500000', '50만원 이하']]}/>
      <Field label="혜택 방식" value={kind} set={setKind} options={[['all', '전체'], ...BENEFIT_KINDS.map(k => [k, k] as [string, string])]}/>
      <Field label="브랜드" value={brand} set={setBrand} options={[['all', '전체'], ...brands.map(b => [b, b] as [string, string])]}/>
      <label className="mc-check"><input type="checkbox" checked={withEvents} onChange={e => setWithEvents(e.target.checked)}/>진행 중 이벤트 있는 카드만</label>
    </div>}
    {themes.includes('호텔 발레') && <p className="mc-note">서울 호텔별로 어떤 카드가 되는지는 <a href={sitePath('../hotels/valet.html')}>Mr. Hotels 발레파킹 지도</a>에서 볼 수 있어요.</p>}

    <div className="mc-listhead">
      <span className="mc-count">{filtered.length.toLocaleString('ko-KR')}<small>/{families.toLocaleString('ko-KR')}종</small></span>
      <select className="mc-select" aria-label="정렬" value={sort} onChange={e => setSort(e.target.value)}>
        <option value="best">{q ? '검색 정확도순' : '추천순'}</option><option value="picking">피킹률 높은순</option>
        <option value="fee">연회비 낮은순</option><option value="events">이벤트 많은순</option><option value="name">이름순</option>
      </select>
    </div>
    {filtered.length ? <div className="mc-rows">{filtered.slice(0, more).map(c => {
      const m = meta.get(c.id)!;
      const facts = [typeLabel(c.type), feeLabel(c.annualFeeMin), spendShort(c), RESTRICTED.test(c.name) ? '가입 대상 제한' : ''].filter(Boolean);
      const why = [...new Set(themes.filter(t => EXPLAINED.has(t)).map(t => whyFor(c, t)).filter((w): w is string => !!w))];
      // 줄 전체가 링크(이름의 ::after가 줄을 덮음)이고, 비교 버튼만 따로 눌림
      return <div key={c.id} className="mc-row mc-cardrow">
        <CardArt card={c}/>
        <span className="mc-body">
          <span className="mc-issuer">{c.issuer}</span>
          <a className="mc-name mc-stretch" href={cardPath(c.id)}>{c.familyName ?? c.name}</a>
          <span className="mc-facts">{facts.join(' · ')}</span>
          {why.map(w => <span key={w} className="mc-why">{w}</span>)}
          {m.hl.length > 0 && <span className="mc-hl">{m.hl.map(h => <i key={h}>{h}</i>)}</span>}
        </span>
        <span className="mc-side">
          {m.best !== null && <span className="mc-pick"><small>피킹률</small>{formatPicking(m.best)}%</span>}
          {m.events > 0 && <span className="mc-pill">이벤트 {m.events}</span>}
          <CompareToggle id={c.id} compact/>
        </span>
      </div>;
    })}</div> : <Empty title="조건에 맞는 카드가 없어요. 조건을 줄여 보세요." action={{label: '전체 카드 보기', onClick: reset}}/>}
    {filtered.length > more && <button type="button" className="mc-more" onClick={() => setMore(n => n + PAGE)}>더 보기 ({(filtered.length - more).toLocaleString('ko-KR')}개 남음)</button>}
    <CompareDock cards={cards} events={events}/>
    <p className="mc-note">피킹률 = 최소 실적 구간의 최대 혜택 ÷ 실적</p>
  </>;
}

function Field({label, value, set, options}: {label: string; value: string; set: (v: string) => void; options: [string, string][]}) {
  return <label className="mc-field"><span>{label}</span><select value={value} onChange={e => set(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
}

// ======================= 발급이벤트 =======================
// ① 발급 지원금 비교: 네이버페이·카카오페이·아정당·뽐뿌에서 모은 발급 이벤트 표(내 카드사 상태로 참여 가능 판정)
// ② 카드사 발급 캐시백: 카드사 공지에서 모은 신규 발급 캐시백 목록
function CashbackView({events}: {events: Offer[]}) {
  const [view, setView] = useState<'issuance' | 'offers'>('issuance');
  const [q, setQ] = useState('');
  const [issuer, setIssuer] = useState('all');
  const [channel, setChannel] = useState('all');
  const [sort, setSort] = useState('amount');
  const base = useMemo(() => events.filter(o => o.kind === 'cashback' && visibleOffer(o) && activeOffer(o)), [events]);
  const channels = useMemo(() => [...new Set(base.map(o => o.channel ?? '카드사 공식'))], [base]);
  const list = useMemo(() => base
    .filter(o => (issuer === 'all' || groupOf(o.issuer) === issuer) && (channel === 'all' || (o.channel ?? '카드사 공식') === channel))
    .map(o => ({o, amount: headlineAmount(o, rewardValue(o)), score: searchScore(q, [[o.title, 100], [o.issuer + ' ' + (o.cardNames ?? []).join(' '), 50], [o.benefitText + ' ' + o.description + ' ' + (o.channel ?? ''), 20], [o.requirements.join(' '), 5]])}))
    .filter(x => x.score)
    .sort((a, b) => sort === 'amount' ? b.amount - a.amount : (a.o.endsAt ?? '9').localeCompare(b.o.endsAt ?? '9')), [base, q, issuer, channel, sort]);
  const counts = useMemo(() => base.reduce((m, o) => { const g = groupOf(o.issuer); m[g] = (m[g] ?? 0) + 1; return m; }, {} as Record<string, number>), [base]);
  return <>
    <div className="mc-bar">
      <Tabs label="발급 이벤트 보기" items={[{value: 'issuance', label: '발급 지원금 비교'}, {value: 'offers', label: '카드사 캐시백', count: base.length}]} value={view} onChange={v => setView(v as 'issuance' | 'offers')}/>
    </div>
    {view === 'issuance' ? <IssuanceView/> : <>
      <SearchBox value={q} onChange={setQ} placeholder="카드·카드사 검색"/>
      <div className="mc-filters">
        <Chips label="카드사" issuers items={[{value: 'all', label: '전체', count: base.length}, ...issuerItems(ISSUER_FILTERS.filter(g => counts[g]), counts)]} value={issuer} onChange={setIssuer}/>
        {channels.length > 1 && <Chips label="채널" items={[{value: 'all', label: '전체'}, ...channels.map(c => ({value: c, label: c}))]} value={channel} onChange={setChannel}/>}
      </div>
      <div className="mc-bar">
        <span className="mc-count">{list.length}<small>건</small></span>
        <select className="mc-select" aria-label="정렬" value={sort} onChange={e => setSort(e.target.value)}><option value="amount">혜택 큰 순</option><option value="end">마감 임박순</option></select>
      </div>
      {list.length ? <EventGroups list={list.map(x => x.o)} grouped={false} amountOf={o => list.find(x => x.o === o)?.amount || null}/>
        : <Empty title="지금 진행 중인 발급 이벤트가 없어요."/>}
      <p className="mc-note">금액은 공지의 최대치예요. 조건은 이벤트를 눌러 확인하세요.</p>
    </>}
  </>;
}

// ======================= 카드사 이벤트 =======================
// 한 줄 = 어디서 · 얼마나 · 카드사·분야·응모 · 남은 날. 분야는 제목에서 뽑음(lib/event-view.ts)
function EventsView({events, cards}: {events: Offer[]; cards: Card[]}) {
  const [q, setQ] = useState('');
  const query = useDeferredValue(q);
  const [field, setField] = useState('all');
  const [issuer, setIssuer] = useState('all');
  const [soon, setSoon] = useState(false);
  const [sort, setSort] = useState('end');
  const [more, setMore] = useState(PAGE);
  // 내 카드로 찾기: 이름을 치면 후보가 뜨고, 고르면 그 카드에 해당하는 이벤트만
  const [mine, setMine] = useState<Card | null>(null);
  const [mq, setMq] = useState('');
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('card');
    if (id && cards.length && !mine) setMine(cards.find(c => c.id === id) ?? null);
  }, [cards]);
  const suggestions = useMemo(() => mq.trim()
    ? groupCards(cards).map(g => ({c: g.card, s: searchScore(mq, [[g.card.familyName ?? g.card.name, 100], [g.card.issuer + ' ' + (g.card.searchAliases ?? []).join(' '), 40]])}))
      .filter(x => x.s).sort((a, b) => b.s - a.s).slice(0, 8).map(x => x.c) : [], [cards, mq]);
  const mineFamily = useMemo(() => mine ? cards.filter(c => cardFamilyKey(c) === cardFamilyKey(mine)) : [], [cards, mine]);

  const base = useMemo(() => events.filter(o => o.kind === 'card' && visibleOffer(o) && currentMonthOffer(o)), [events]);
  const now = today();
  // 혜택 큰 순: 금액(원) 있는 것 → 비율(%) → 나머지. 금액과 %는 서로 비교하지 않음
  const val = (o: Offer) => { const v = viewOf(o).value; return !v ? 0 : v.won ? 2e9 + v.won : v.pct ? 1e9 + v.pct : 1; };
  const list = useMemo(() => base
    .filter(o => { const v = viewOf(o); return (field === 'all' || v.field === field) && (issuer === 'all' || groupOf(o.issuer) === issuer) &&
      (!soon || (!!o.endsAt && (Date.parse(o.endsAt) - Date.parse(now)) / 864e5 <= 7)) && (!mine || mineFamily.some(c => offerApplies(c, o))); })
    .map(o => { const v = viewOf(o); return {o, score: searchScore(query, [[v.title, 100], [(v.merchant ?? '') + ' ' + o.issuer + ' ' + groupOf(o.issuer) + ' ' + (o.cardNames ?? []).join(' '), 60], [v.field + ' ' + (v.value?.text ?? '') + ' ' + (o.channel ?? '') + (v.entry ? ' 응모' : ''), 30], [o.benefitText + ' ' + o.description, 10]])}; })
    .filter(x => x.score)
    // 카드사가 같은 행사를 두 번 올린 경우(같은 제목·마감일) 하나만
    .filter((x, i, all) => { const k = x.o.issuer + '|' + viewOf(x.o).title + '|' + x.o.endsAt; return all.findIndex(y => y.o.issuer + '|' + viewOf(y.o).title + '|' + y.o.endsAt === k) === i; })
    .sort((a, b) => (query ? b.score - a.score : 0) ||
      (sort === 'new' ? (b.o.startsAt ?? '').localeCompare(a.o.startsAt ?? '') : sort === 'amount' ? val(b.o) - val(a.o) : (a.o.endsAt ?? '9').localeCompare(b.o.endsAt ?? '9') || val(b.o) - val(a.o)))
    .map(x => x.o), [base, query, field, issuer, soon, mine, mineFamily, sort, now]);
  useEffect(() => setMore(PAGE), [query, field, issuer, soon, mine, sort]);
  const fieldCount = useMemo(() => base.reduce((m, o) => { const f = viewOf(o).field; m[f] = (m[f] ?? 0) + 1; return m; }, {} as Record<string, number>), [base]);
  const issCount = useMemo(() => base.reduce((m, o) => { const g = groupOf(o.issuer); m[g] = (m[g] ?? 0) + 1; return m; }, {} as Record<string, number>), [base]);
  const grouped = sort === 'end' && !query;
  const bucketCount = useMemo(() => grouped ? list.reduce((m, o) => { const b = endBucket(o.endsAt, now, o.status === 'active'); m[b] = (m[b] ?? 0) + 1; return m; }, {} as Record<string, number>) : undefined, [list, grouped, now]);
  const pickMine = (c: Card | null) => {
    setMine(c); setMq('');
    const u = new URL(location.href); c ? u.searchParams.set('card', c.id) : u.searchParams.delete('card');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  };
  const pickField = (f: string) => setField(p => p === f && f !== 'all' ? 'all' : f);
  const reset = () => { setQ(''); setField('all'); setIssuer('all'); setSoon(false); pickMine(null); };

  return <>
    <SearchBox value={q} onChange={setQ} placeholder="가맹점·혜택 검색 (예: 아고다, 스타벅스, 캐시백)"/>
    <div className="mc-mine">
      {mine
        ? <div className="mc-mine-on"><span>내 카드</span><b>{mine.familyName ?? mine.name}</b><small>{mine.issuer}</small><button type="button" className="mc-link" onClick={() => pickMine(null)}>해제</button></div>
        : <div className="mc-mine-q">
          <input value={mq} onChange={e => setMq(e.target.value)} placeholder="내 카드로 찾기 — 카드 이름 입력" aria-label="내 카드 이름"/>
          {suggestions.length > 0 && <ul className="mc-suggest">{suggestions.map(c => <li key={c.id}><button type="button" onClick={() => pickMine(c)}><IssuerTile issuer={c.issuer} size="sm"/>{c.familyName ?? c.name}<small>{typeLabel(c.type)}</small></button></li>)}</ul>}
        </div>}
    </div>
    <div className="mc-filters">
      <Chips label="분야" items={[{value: 'all', label: '전체', count: base.length}, ...FIELDS.filter(f => fieldCount[f]).map(f => ({value: f, label: f, count: fieldCount[f]}))]} value={field} onChange={pickField}/>
      <Chips label="카드사" issuers items={[{value: 'all', label: '전체'}, ...issuerItems(ISSUER_FILTERS.filter(g => issCount[g]), issCount)]} value={issuer} onChange={setIssuer}/>
    </div>
    <div className="mc-bar">
      <label className="mc-check"><input type="checkbox" checked={soon} onChange={e => setSoon(e.target.checked)}/>7일 안 마감</label>
      {(q || field !== 'all' || issuer !== 'all' || soon || mine) && <button type="button" className="mc-link" onClick={reset}>초기화</button>}
      <span className="mc-count">{list.length}<small>건</small></span>
      <select className="mc-select" aria-label="정렬" value={sort} onChange={e => setSort(e.target.value)}><option value="end">마감 임박순</option><option value="amount">혜택 큰 순</option><option value="new">새로 시작한 순</option></select>
    </div>
    {list.length ? <EventGroups list={list.slice(0, more)} grouped={grouped} hideField={field !== 'all'} counts={bucketCount}/>
      : <Empty title={mine ? '이 카드로 참여할 수 있는 이벤트가 없어요.' : '조건에 맞는 이벤트가 없어요.'} action={{label: '조건 초기화', onClick: reset}}/>}
    {list.length > more && <button type="button" className="mc-more" onClick={() => setMore(n => n + PAGE)}>더 보기 ({list.length - more}건 남음)</button>}
    <p className="mc-note">혜택은 공지 제목의 최대치예요. 조건은 이벤트를 눌러 확인하세요.</p>
    <details className="mc-links">
      <summary>카드사 앱의 내 맞춤 혜택 바로가기</summary>
      <div>{sources.filter(s => issuer === 'all' || groupOf(s.issuer) === issuer).map(s => <a key={s.issuer} href={s.url} target="_blank" rel="noopener noreferrer"><IssuerTile issuer={s.issuer} size="sm"/>{s.label} ↗</a>)}</div>
    </details>
  </>;
}
