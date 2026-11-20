// 카드 상세: 핵심 숫자 → 주요 혜택 → 이 카드 이벤트 → 공항·발레 → 결제 인정 여부 → 피킹률 근거 → 조건 원문
import {useState} from 'react';
import {sitePath} from '@/lib/site-path';
import {SiteHeader, SiteFooter} from '@/components/customer-shell';
import {CardArt, IssuerTile} from '@/components/mc-ui';
import {cardFamilyKey, dedupeOffers, eventPath, formatPicking, linkedOffers, offerLinkLabel, pickingExcluded, pickingOptions} from '@/lib/catalog-model';
import {PAYMENT_CHECKS, paymentCheck, type PaymentCheck} from '@/lib/card-themes';
import {annualFeeRows, cardPath} from '@/lib/card-presentation';
import {customerLines} from '@/lib/customer-copy';
import {pendingValet, valetHotelResults, valetMapPath, valetQuota, valetRules} from '@/lib/hotel-valet';
import {cleanBenefits, dday, eventSummary, spendLabel, won, ymd} from '@/lib/mc-text';
import type {Card, Offer} from '@/lib/catalog-types';

const SPEND_WORD = {allowed: '실적 인정', excluded: '실적 제외', unknown: '실적 ?'} as const;
const BENEFIT_WORD = {allowed: '혜택 가능', excluded: '혜택 제외', unknown: '혜택 ?'} as const;
const TONE = {allowed: 'ok', excluded: 'no', unknown: 'na'} as const;

function PayRow({label, hint, check}: {label: string; hint?: string; check: PaymentCheck}) {
  const head = <>
    <span className="mc-pay-name"><span className="mc-pay-label">{label}</span>{hint && <small>{hint}</small>}</span>
    <span className={'mc-pay-v ' + TONE[check.spend]}>{SPEND_WORD[check.spend]}</span>
    {check.benefit === 'na' ? <span className="mc-pay-v blank"/> : <span className={'mc-pay-v ' + TONE[check.benefit]}>{BENEFIT_WORD[check.benefit]}</span>}
  </>;
  const evidence = (check.spendEvidence && check.spendEvidence === check.benefitEvidence ? [['실적·혜택', check.spendEvidence]]
    : [check.spendEvidence && ['실적', check.spendEvidence], check.benefitEvidence && ['혜택', check.benefitEvidence]].filter(Boolean)) as [string, string][];
  if (!evidence.length) return <li className="mc-pay-row"><div className="mc-pay-head">{head}</div></li>;
  return <li className="mc-pay-row"><details><summary className="mc-pay-head">{head}</summary>
    {evidence.map(([k, t]) => <p key={k} className="mc-pay-ev"><b>{k} 원문</b> {t}</p>)}
  </details></li>;
}

export default function CardDetail({card, catalog}: {card: Card; catalog: {cards: Card[]; events: Offer[]}}) {
  const variants = catalog.cards.filter(c => cardFamilyKey(c) === cardFamilyKey(card));
  const family = variants.length ? variants : [card];
  const offers = dedupeOffers(family.flatMap(c => linkedOffers(c, catalog.events)));
  const benefits = cleanBenefits(card);
  const picks = pickingOptions(card).sort((a, b) => b.value - a.value)
    .filter((p, i, all) => all.findIndex(q => q.value.toFixed(2) === p.value.toFixed(2) && q.scenario.minimumEligibleSpend === p.scenario.minimumEligibleSpend) === i).slice(0, 3);
  const nicheDropped = pickingExcluded(card);
  const valet = valetRules(card.id), valetPending = pendingValet(card.id);
  const services = (card.networkServices ?? []).filter(s => s.category !== 'hotel_valet');
  const checks = PAYMENT_CHECKS.map(item => ({...item, check: paymentCheck(card, item.key)}))
    .filter(({check}) => check.spend !== 'unknown' || (check.benefit !== 'unknown' && check.benefit !== 'na'));
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

    {checks.length > 0 && <section className="mc-sec" id="pay-checks">
      <h2>이렇게 써도 될까?</h2>
      <p className="mc-sub">전월실적에 들어가는지, 할인·적립을 받는지 카드사 원문의 제외 목록으로 확인했어요. 눌러서 원문을 볼 수 있어요.</p>
      <ul className="mc-pay">{checks.map(({key, label, check, ...rest}) => <PayRow key={key} label={label} hint={'hint' in rest ? rest.hint : undefined} check={check}/>)}</ul>
      <p className="mc-note">‘혜택 가능’은 할인·적립 제외 대상이 아니라는 뜻이에요. 그 결제가 이 카드의 혜택 영역이 아니면 받을 혜택이 없을 수 있어요. ‘?’는 원문에서 확인하지 못한 항목이에요.</p>
    </section>}

    {picks.length > 0 && <section className="mc-sec">
      <h2>피킹률 계산 근거</h2>
      <ul className="mc-benefits">{picks.map((p, i) => <li key={i}>
        <div className="mc-b-top"><b>{p.scenario.benefitScope ?? p.scenario.label}</b><span className="mc-pill strong">{formatPicking(p.value)}%</span></div>
        <div className="mc-b-meta">
          {p.scenario.minimumEligibleSpend ? <span>전월 {won(p.scenario.minimumEligibleSpend)} 이상</span> : <span>무실적</span>}
          {p.scenario.totalSpend && p.scenario.totalSpend !== p.scenario.minimumEligibleSpend ? <span>총 {won(p.scenario.totalSpend)} 결제 기준</span> : null}
          {p.scenario.monthlyBenefit ? <span>월 {won(Math.round(p.scenario.monthlyBenefit))} 혜택</span> : null}
        </div>
        {p.scenario.assumptions.length > 0 && <ul className="mc-b-lines">{p.scenario.assumptions.filter(Boolean).slice(0, p.scenario.components && p.scenario.components.length > 1 ? 7 : 3).map((a, j) => <li key={j}>{a}</li>)}</ul>}
      </li>)}</ul>
      <p className="mc-note">피킹률 = 한 달 혜택 ÷ 그 혜택을 받으려고 쓴 돈. 혜택받은 결제가 전월실적에서 빠지는 카드는 그만큼 더 쓴다고 보고, 구독료는 월 3만원까지만 쓴다고 계산해요.{nicheDropped.length > 0 && <> 놀이공원·스포츠 경기·골프처럼 자주 쓰지 않는 혜택({nicheDropped.join(', ')})은 뺐어요.</>}</p>
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
