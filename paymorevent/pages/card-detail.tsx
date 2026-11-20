// 카드 상세: 핵심 숫자 → 주요 혜택 → 이 카드 이벤트 → 공항·발레 → 결제 인정 여부 → 피킹률 근거 → 조건 원문
import {useState} from 'react';
import {sitePath} from '@/lib/site-path';
import {SiteHeader, SiteFooter} from '@/components/customer-shell';
import {CardArt, IssuerTile} from '@/components/mc-ui';
import {cardFamilyKey, dedupeOffers, eventPath, formatPicking, linkedOffers, offerLinkLabel, pickingOptions} from '@/lib/catalog-model';
import {ELIGIBILITY_THEMES, paymentEligibility} from '@/lib/card-themes';
import {annualFeeRows, cardPath} from '@/lib/card-presentation';
import {customerLines} from '@/lib/customer-copy';
import {pendingValet, valetHotelResults, valetMapPath, valetQuota, valetRules} from '@/lib/hotel-valet';
import {cleanBenefits, dday, eventSummary, spendLabel, won, ymd} from '@/lib/mc-text';
import type {Card, Offer} from '@/lib/catalog-types';

const VERDICT = {allowed: ['○', 'ok'], excluded: ['✕', 'no'], unknown: ['—', 'na']} as const;

export default function CardDetail({card, catalog}: {card: Card; catalog: {cards: Card[]; events: Offer[]}}) {
  const variants = catalog.cards.filter(c => cardFamilyKey(c) === cardFamilyKey(card));
  const family = variants.length ? variants : [card];
  const offers = dedupeOffers(family.flatMap(c => linkedOffers(c, catalog.events)));
  const benefits = cleanBenefits(card);
  const picks = pickingOptions(card).sort((a, b) => b.value - a.value).slice(0, 3);
  const valet = valetRules(card.id), valetPending = pendingValet(card.id);
  const services = (card.networkServices ?? []).filter(s => s.category !== 'hotel_valet');
  const elig = ELIGIBILITY_THEMES.map(t => [t, paymentEligibility(card, t)] as const).filter(([, e]) => e.spend !== 'unknown' || e.benefit !== 'unknown');
  const fees = annualFeeRows(card).filter(r => r.amount !== '미확인');
  const desc = customerLines(card.description ?? '').join(' ').trim();
  const [allBenefits, setAllBenefits] = useState(false);
  const shown = allBenefits ? benefits : benefits.slice(0, 8);

  const facts: [string, string][] = [
    ['연회비', card.annualFeeMin === null ? '' : card.annualFeeMin === 0 ? '없음' : won(card.annualFeeMin) + (fees.length > 1 ? '~' : '')],
    ['전월실적', card.minimumSpend === null ? '' : card.minimumSpend === 0 ? '무실적' : won(card.minimumSpend) + ' 이상'],
    ['최고 피킹률', picks.length ? formatPicking(picks[0].value) + '%' : ''],
    ['진행 이벤트', offers.length ? offers.length + '건' : ''],
  ];

  return <div className="pm-site mc"><SiteHeader current="cards"/><main className="mc-main mc-detail">
    <a href={sitePath('#cards')} className="mc-back">← 카드 목록</a>
    <section className="mc-hero">
      <CardArt card={card} large/>
      <div className="mc-hero-body">
        <div className="mc-hero-kicker"><IssuerTile issuer={card.issuer} size="sm"/>{card.issuer} · {card.type === 'credit' ? '신용카드' : '체크카드'}{card.brands.length > 0 && ' · ' + card.brands.filter(b => b !== '국내전용').join('·')}</div>
        <h1>{card.name}</h1>
        {desc && desc !== card.name && <p className="mc-hero-desc">{desc.length > 120 ? desc.slice(0, 119) + '…' : desc}</p>}
        <dl className="mc-facts-grid">{facts.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        <div className="mc-actions">
          <a className="mc-btn primary" href={card.sourceUrl} target="_blank" rel="noopener noreferrer">카드사에서 보기 ↗</a>
          {card.termsUrl && <a className="mc-btn" href={card.termsUrl} target="_blank" rel="noopener noreferrer">상품설명서</a>}
          {offers.length > 0 && <a className="mc-btn" href={sitePath('?card=' + encodeURIComponent(card.id) + '#events')}>이벤트 모아보기</a>}
        </div>
      </div>
    </section>

    <section className="mc-sec">
      <h2>주요 혜택 <small>{benefits.length}개</small></h2>
      {benefits.length ? <ul className="mc-benefits">{shown.map((b, i) => <li key={i}>
        <div className="mc-b-top"><b>{b.title}</b>{b.rate && <span className="mc-pill strong">{b.rate}</span>}</div>
        {(b.cap || b.spend) && <div className="mc-b-meta">{b.cap && <span>한도 {b.cap}</span>}{b.spend && <span>{b.spend}</span>}</div>}
        {b.lines.length > 0 && <ul className="mc-b-lines">{b.lines.slice(0, 3).map((l, j) => <li key={j}>{l}</li>)}</ul>}
      </li>)}</ul> : <p className="mc-note">카드사 원문에서 정리된 혜택이 아직 없어요. 카드사 페이지에서 확인하세요.</p>}
      {benefits.length > 8 && <button type="button" className="mc-more" onClick={() => setAllBenefits(v => !v)}>{allBenefits ? '접기' : `혜택 ${benefits.length - 8}개 더 보기`}</button>}
    </section>

    {offers.length > 0 && <section className="mc-sec" id="related-events">
      <h2>이 카드로 참여할 수 있는 이벤트 <small>{offers.length}건</small></h2>
      <div className="mc-rows">{offers.slice(0, 12).map(o => <a key={o.id} className="mc-row mc-evrow" href={eventPath(o.id)}>
        <IssuerTile issuer={o.issuer}/>
        <span className="mc-body"><b className="mc-name">{o.title}</b>{eventSummary(o) && <span className="mc-sum">{eventSummary(o)}</span>}<span className="mc-tags"><i>{offerLinkLabel(o)}</i></span></span>
        <span className="mc-side">{dday(o.endsAt) && <span className="mc-dd">{dday(o.endsAt)}</span>}<small className="mc-end">{o.endsAt ? '~' + ymd(o.endsAt) : ''}</small></span>
      </a>)}</div>
      {offers.length > 12 && <a className="mc-more" href={sitePath('?card=' + encodeURIComponent(card.id) + '#events')}>이벤트 {offers.length - 12}건 더 보기</a>}
    </section>}

    {services.length > 0 && <section className="mc-sec">
      <h2>공항·라운지 서비스</h2>
      <ul className="mc-benefits">{services.map(s => <li key={s.id}>
        <div className="mc-b-top"><b>{s.title}</b><span className="mc-pill">{s.benefitMode === 'discount' ? '할인' : s.benefitMode === 'paid' ? '유료' : '무료'}</span></div>
        <div className="mc-b-meta">{s.coverageText && <span>{s.coverageText}</span>}{s.minimumSpend ? <span>{spendLabel(s.minimumSpend)}</span> : null}
          {(s.annualLimit || s.monthlyLimit) && <span>{s.annualLimit ? `연 ${s.annualLimit}회` : `월 ${s.monthlyLimit}회`}</span>}
          {s.guestCount ? <span>동반 {s.guestCount}인</span> : null}</div>
        {s.conditions.length > 0 && <ul className="mc-b-lines">{s.conditions.slice(0, 2).map((c, i) => <li key={i}>{c}</li>)}</ul>}
      </li>)}</ul>
    </section>}

    {(valet.length > 0 || valetPending) && <section className="mc-sec">
      <h2>서울 호텔 발레파킹</h2>
      <ul className="mc-benefits">{valet.map(p => {
        const hotels = valetHotelResults(p);
        const v = p.cards.find(x => x.catalogId === card.id);
        return <li key={p.id}>
          <div className="mc-b-top"><b>{p.brand} {p.tier}</b><span className="mc-pill">서울 {hotels.length}곳</span></div>
          <div className="mc-b-meta"><span>전월 {won(p.minimumSpend)} 이상</span><span>{valetQuota(p)}</span><span>{p.parking}</span></div>
          <p className="mc-b-hotels">{hotels.map(h => h.name).join(' · ')}</p>
          <a className="mc-link" href={valetMapPath(v ? `${p.id}:${v.key}` : card.id)}>호텔별 조건·지도 보기 →</a>
        </li>;
      })}{valetPending && <li><div className="mc-b-top"><b>{valetPending.brand}</b><span className="mc-pill">확인 중</span></div><p className="mc-b-hotels">{valetPending.note}</p></li>}</ul>
    </section>}

    {elig.length > 0 && <section className="mc-sec">
      <h2>이렇게 써도 될까?</h2>
      <table className="mc-table"><thead><tr><th>결제 항목</th><th>전월실적 인정</th><th>혜택 적용</th></tr></thead>
        <tbody>{elig.map(([t, e]) => <tr key={t}><th>{t === '상품권 가능' ? '상품권·선불 충전' : t}</th>
          {(['spend', 'benefit'] as const).map(k => <td key={k} className={VERDICT[e[k]][1]}>{VERDICT[e[k]][0]}</td>)}</tr>)}</tbody></table>
      <p className="mc-note">○ 인정 · ✕ 제외 · — 원문 미확인</p>
    </section>}

    {picks.length > 0 && <section className="mc-sec">
      <h2>피킹률 계산 근거</h2>
      <ul className="mc-benefits">{picks.map((p, i) => <li key={i}>
        <div className="mc-b-top"><b>{p.scenario.benefitScope ?? p.scenario.label}</b><span className="mc-pill strong">{formatPicking(p.value)}%</span></div>
        <div className="mc-b-meta">{p.scenario.minimumEligibleSpend ? <span>전월 {won(p.scenario.minimumEligibleSpend)} 이용 시</span> : null}{p.scenario.monthlyBenefit ? <span>월 {won(p.scenario.monthlyBenefit)} 혜택</span> : null}</div>
        {p.scenario.assumptions.length > 0 && <ul className="mc-b-lines">{p.scenario.assumptions.filter(Boolean).slice(0, 2).map((a, j) => <li key={j}>{a}</li>)}</ul>}
      </li>)}</ul>
    </section>}

    <section className="mc-sec">
      <h2>조건 자세히</h2>
      {fees.length > 0 && <details className="mc-acc"><summary>연회비 <small>{fees.length}가지</small></summary><table className="mc-table"><tbody>{fees.map((f, i) => <tr key={i}><th>{f.label}</th><td>{f.amount}</td></tr>)}</tbody></table></details>}
      {variants.length > 1 && <details className="mc-acc"><summary>다른 브랜드·디자인 <small>{variants.length}종</small></summary><div className="mc-variants">{variants.map(v => <a key={v.id} href={cardPath(v.id)} aria-current={v.id === card.id ? 'page' : undefined}>{v.name}<small>{v.brands.join('·')}</small></a>)}</div></details>}
      {!!card.eligibility?.length && <details className="mc-acc"><summary>발급 대상</summary><ul className="mc-b-lines">{card.eligibility.flatMap(customerLines).map((t, i) => <li key={i}>{t}</li>)}</ul></details>}
      {card.spendExclusions.length > 0 && <details className="mc-acc"><summary>전월실적에서 빠지는 이용 <small>{card.spendExclusions.length}</small></summary><ul className="mc-b-lines">{[...new Set(card.spendExclusions.flatMap(customerLines))].slice(0, 30).map((t, i) => <li key={i}>{t}</li>)}</ul></details>}
      {card.benefitExclusions.length > 0 && <details className="mc-acc"><summary>혜택에서 빠지는 이용 <small>{card.benefitExclusions.length}</small></summary><ul className="mc-b-lines">{[...new Set(card.benefitExclusions.flatMap(customerLines))].slice(0, 30).map((t, i) => <li key={i}>{t}</li>)}</ul></details>}
    </section>
    <p className="mc-note">카드사 공식 페이지·상품설명서 기준({ymd(card.verifiedAt) || '확인일 미상'} 확인). 최종 조건은 카드사에서 확인하세요.</p>
  </main><SiteFooter/></div>;
}
