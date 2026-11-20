// 카드 상세: 한눈에(연회비·전월실적·피킹률) → 혜택 → 피킹률 → 결제해도 될까 → 이벤트 → 조건
// 숫자는 위에 크게, 긴 원문은 접어 두고 필요할 때만 펼친다.
import {useState} from 'react';
import {sitePath} from '@/lib/site-path';
import {SiteHeader, SiteFooter} from '@/components/customer-shell';
import {CardArt, IssuerTile} from '@/components/mc-ui';
import {cardFamilyKey, dedupeOffers, eventPath, formatPicking, linkedOffers, pickingExcluded, pickingOptions} from '@/lib/catalog-model';
import {PAYMENT_CHECKS, paymentCheck, type PaymentCheck} from '@/lib/card-themes';
import {annualFeeRows, cardPath} from '@/lib/card-presentation';
import {customerLines} from '@/lib/customer-copy';
import {pendingValet, valetHotelResults, valetMapPath, valetQuota, valetRules} from '@/lib/hotel-valet';
import {benefitRow, cardMinimumSpend, cleanBenefits, dday, eventSummary, pickLabel, won, ymd} from '@/lib/mc-text';
import type {Card, Offer} from '@/lib/catalog-types';

const MARK = {allowed: ['✓', 'ok', '됨'], excluded: ['✕', 'no', '안 됨'], unknown: ['?', 'na', '확인 안 됨'], na: ['', 'blank', '']} as const;

/** 혜택 표 한 줄: 혜택 | 할인·적립 | 조건. 원문이 있으면 눌러서 펼침 */
function BenefitRowView({b}: {b: ReturnType<typeof benefitRow>}) {
  const [open, setOpen] = useState(false);
  const more = b.lines.length > 1 || b.tiers.length > 0 || (b.lines.length === 1 && !b.where);
  return <>
    <tr className={more ? 'cd-bt-has' : undefined} onClick={more ? () => setOpen(v => !v) : undefined} aria-expanded={more ? open : undefined}>
      <th scope="row">
        {b.group && <span className="cd-bt-group">{b.group}</span>}
        <b>{b.name}{more && <i aria-hidden="true">{open ? '−' : '+'}</i>}</b>
        {b.where && <small>{b.where}</small>}
      </th>
      <td className="cd-bt-val">{b.value.main ? <><b>{b.value.main}</b>{b.value.sub && <small>{b.value.sub}</small>}</> : <small>원문 참고</small>}</td>
      <td className="cd-bt-cond">{b.conds.length ? b.conds.map(c => <span key={c}>{c}</span>) : <small>—</small>}</td>
    </tr>
    {open && <tr className="cd-bt-more"><td colSpan={3}>
      {b.tiers.length > 0 && <div className="cd-bt-tiers"><b>전월실적별 한도</b>{b.tiers.map(t => <span key={t}>{t.replace('→', '·')}</span>)}</div>}
      {b.lines.length > 0 && <ul>{b.lines.map((l, j) => <li key={j}>{l}</li>)}</ul>}
    </td></tr>}
  </>;
}

function PayRow({label, hint, check}: {label: string; hint?: string; check: PaymentCheck}) {
  const [open, setOpen] = useState(false);
  const ev = check.spendEvidence && check.spendEvidence === check.benefitEvidence ? [['실적·혜택', check.spendEvidence]]
    : [['실적', check.spendEvidence], ['혜택', check.benefitEvidence]].filter(([, t]) => t);
  const cell = (k: keyof typeof MARK, what: string) => <td className={'cd-mark ' + MARK[k][1]}>
    {MARK[k][0] && <span aria-label={`${what} ${MARK[k][2]}`}>{MARK[k][0]}</span>}</td>;
  return <>
    <tr className={ev.length ? 'cd-pay-has' : undefined} onClick={ev.length ? () => setOpen(v => !v) : undefined} aria-expanded={ev.length ? open : undefined}>
      <th scope="row">{label}{ev.length > 0 && <i aria-hidden="true">{open ? '−' : '+'}</i>}{hint && <small>{hint}</small>}</th>
      {cell(check.spend, '전월실적')}{cell(check.benefit, '혜택')}
    </tr>
    {open && <tr className="cd-pay-ev"><td colSpan={3}>{ev.map(([k, t]) => <p key={k}><b>{k} 원문</b>{t}</p>)}</td></tr>}
  </>;
}

export default function CardDetail({card, catalog}: {card: Card; catalog: {cards: Card[]; events: Offer[]}}) {
  const variants = catalog.cards.filter(c => cardFamilyKey(c) === cardFamilyKey(card));
  const family = variants.length ? variants : [card];
  const offers = dedupeOffers(family.flatMap(c => linkedOffers(c, catalog.events)));
  const benefits = cleanBenefits(card).filter(b => !b.voucher || b.rate || b.lines.length);
  const picks = pickingOptions(card).sort((a, b) => b.value - a.value)
    .filter((p, i, all) => all.findIndex(q => q.value.toFixed(2) === p.value.toFixed(2) && q.scenario.minimumEligibleSpend === p.scenario.minimumEligibleSpend) === i);
  const best = picks[0];
  const dropped = pickingExcluded(card);
  const valet = valetRules(card.id), valetPending = pendingValet(card.id);
  const services = (card.networkServices ?? []).filter(s => s.category !== 'hotel_valet');
  const checks = PAYMENT_CHECKS.map(item => ({...item, check: paymentCheck(card, item.key)}))
    .filter(({check}) => check.spend !== 'unknown' || (check.benefit !== 'unknown' && check.benefit !== 'na'));
  const fees = annualFeeRows(card).filter(r => r.amount !== '미확인');
  const spend = cardMinimumSpend(card);
  const desc = customerLines(card.description ?? '').join(' ').trim();
  const [allBenefits, setAllBenefits] = useState(false);
  const [allPicks, setAllPicks] = useState(false);
  const SHOW = 10;
  const shown = (allBenefits ? benefits : benefits.slice(0, SHOW)).map(benefitRow);
  const extras = services.length + valet.length + (valetPending ? 1 : 0);

  const sections = [
    ['benefits', '혜택', benefits.length + extras > 0],
    ['picking', '피킹률', !!best],
    ['pay', '결제', checks.length > 0],
    ['events', '이벤트', offers.length > 0],
    ['terms', '조건', true],
  ].filter(([, , on]) => on) as [string, string, boolean][];

  return <div className="pm-site mc"><SiteHeader current="cards"/><main className="mc-main mc-detail cd">
    <a href={sitePath('#cards')} className="mc-back">← 카드 목록</a>

    <section className="cd-hero">
      <CardArt card={card} large/>
      <div className="cd-hero-body">
        <div className="cd-kicker"><IssuerTile issuer={card.issuer} size="sm"/>{card.issuer}<span>·</span>{card.type === 'credit' ? '신용' : '체크'}
          {card.brands.filter(b => b !== '국내전용').length > 0 && <><span>·</span>{card.brands.filter(b => b !== '국내전용').join(' · ')}</>}</div>
        <h1>{card.name}</h1>
        {desc && desc !== card.name && <p className="cd-desc">{desc.length > 90 ? desc.slice(0, 89) + '…' : desc}</p>}
        <dl className="cd-stats">
          <div><dt>연회비</dt><dd>{card.annualFeeMin === null ? '—' : card.annualFeeMin === 0 ? '없음' : won(card.annualFeeMin)}{fees.length > 1 && card.annualFeeMin ? <small>부터</small> : null}</dd></div>
          <div><dt>전월실적</dt><dd>{spend.value === null ? '—' : spend.value === 0 ? '없음' : won(spend.value)}{spend.value ? <small>{spend.varies ? '부터' : '이상'}</small> : spend.varies ? <small>기본 혜택</small> : null}</dd></div>
          <div className={best ? 'hl' : undefined}><dt>최고 피킹률</dt><dd>{best ? formatPicking(best.value) + '%' : '—'}</dd></div>
        </dl>
        <div className="cd-actions">
          <a className="mc-btn primary" href={card.sourceUrl} target="_blank" rel="noopener noreferrer">카드사에서 보기 ↗</a>
          {card.termsUrl && <a className="mc-btn" href={card.termsUrl} target="_blank" rel="noopener noreferrer">상품설명서</a>}
        </div>
      </div>
    </section>

    {sections.length > 2 && <nav className="cd-tabs" aria-label="이 카드 정보">{sections.map(([id, label]) => <a key={id} href={'#' + id}>{label}</a>)}</nav>}

    <section className="cd-sec" id="benefits">
      <h2>혜택 {benefits.length > 0 && <small>{benefits.length}개</small>}</h2>
      {benefits.length ? <table className="cd-btable">
        <thead><tr><th scope="col">혜택</th><th scope="col">할인·적립</th><th scope="col">조건</th></tr></thead>
        <tbody>{shown.map((b, i) => <BenefitRowView key={i} b={b}/>)}</tbody>
      </table> : <p className="cd-empty">카드사 원문에서 정리된 혜택이 아직 없어요. 카드사 페이지에서 확인해 주세요.</p>}
      {benefits.length > SHOW && <button type="button" className="mc-more" onClick={() => setAllBenefits(v => !v)}>{allBenefits ? '접기' : `혜택 ${benefits.length - SHOW}개 더 보기`}</button>}
      {shown.some(b => b.lines.length > 1 || b.tiers.length > 0) && <p className="cd-note"><b>+</b>를 누르면 카드사 원문과 실적별 한도가 보여요.</p>}

      {extras > 0 && <div className="cd-extras">
        {services.map(s => <div key={s.id} className="cd-extra">
          <span className="cd-extra-ic" aria-hidden="true">✈</span>
          <span className="cd-extra-t"><b>{s.title}</b><small>{[s.annualLimit ? `연 ${s.annualLimit}회` : s.monthlyLimit ? `월 ${s.monthlyLimit}회` : '', s.minimumSpend ? `전월 ${won(s.minimumSpend)}` : '', s.guestCount ? `동반 ${s.guestCount}인` : '', s.coverageText ?? ''].filter(Boolean).join(' · ')}</small></span>
          <span className="cd-extra-v">{s.benefitMode === 'discount' ? '할인' : s.benefitMode === 'paid' ? '유료' : '무료'}</span>
        </div>)}
        {valet.map(p => {
          const v = p.cards.find(x => x.catalogId === card.id);
          return <a key={p.id} className="cd-extra" href={valetMapPath(v ? `${p.id}:${v.key}` : card.id)}>
            <span className="cd-extra-ic" aria-hidden="true">P</span>
            <span className="cd-extra-t"><b>서울 호텔 발레파킹 <small className="cd-brand">{p.brand}</small></b><small>{valetHotelResults(p).length}곳 · 전월 {won(p.minimumSpend)} · {valetQuota(p)} · {p.parking.replace(/ · 초과 유료$/, '')}</small></span>
            <span className="cd-extra-go">호텔 보기 →</span>
          </a>;
        })}
        {valetPending && <div className="cd-extra"><span className="cd-extra-ic" aria-hidden="true">P</span><span className="cd-extra-t"><b>호텔 발레파킹</b><small>{valetPending.note}</small></span><span className="cd-extra-v na">확인 중</span></div>}
      </div>}
    </section>

    {best && <section className="cd-sec" id="picking">
      <h2>피킹률</h2>
      <div className="cd-pick">
        <div className="cd-pick-top"><b>{formatPicking(best.value)}%</b><span>{best.scenario.benefitScope ?? pickLabel(best.scenario.label)}</span></div>
        <p className="cd-pick-line">{best.scenario.monthlyBenefit
          ? <>{best.scenario.totalSpend && best.scenario.totalSpend !== best.scenario.minimumEligibleSpend ? `한 달 ${won(best.scenario.totalSpend)} 쓰면` : best.scenario.minimumEligibleSpend ? `전월 ${won(best.scenario.minimumEligibleSpend)} 쓰면` : `한 달 ${won(best.scenario.monthlySpend ?? 0)} 쓰면`} <b>월 {won(Math.round(best.scenario.monthlyBenefit))}</b> 돌려받아요.</>
          : <>쓴 금액의 <b>{formatPicking(best.value)}%</b>를 돌려받아요{best.scenario.minimumEligibleSpend ? ` (전월 ${won(best.scenario.minimumEligibleSpend)} 이상)` : ' (실적 조건 없음)'}.</>}</p>
        <details className="cd-why"><summary>어떻게 계산했나요?</summary>
          <ul>{best.scenario.assumptions.filter(Boolean).slice(0, 8).map((a, j) => <li key={j}>{a}</li>)}</ul>
        </details>
        {picks.length > 1 && <div className="cd-picks">
          <p>다른 경우</p>
          <ul>{(allPicks ? picks.slice(1) : picks.slice(1, 4)).map((p, i) => <li key={i}><span>{p.scenario.benefitScope ?? pickLabel(p.scenario.label)}</span><b>{formatPicking(p.value)}%</b></li>)}</ul>
          {picks.length > 4 && <button type="button" className="cd-link" onClick={() => setAllPicks(v => !v)}>{allPicks ? '접기' : `${picks.length - 4}개 더`}</button>}
        </div>}
      </div>
      <p className="cd-note">피킹률 = 한 달 혜택 ÷ 그 혜택을 받으려고 쓴 돈. 혜택받은 결제가 실적에서 빠지면 그만큼 더 쓴 걸로, 구독료는 월 3만원까지만 쓴 걸로 계산해요.{dropped.length > 0 && ` 자주 쓰지 않는 혜택(${dropped.join(', ')})은 뺐어요.`}</p>
    </section>}

    {checks.length > 0 && <section className="cd-sec" id="pay">
      <h2>이렇게 써도 될까?</h2>
      <p className="cd-sub">이 카드로 결제하면 전월실적에 들어가는지, 할인·적립을 받는지. <b>+</b>를 누르면 카드사 원문이 보여요.</p>
      <table className="cd-pay">
        <thead><tr><th scope="col">결제</th><th scope="col">실적</th><th scope="col">혜택</th></tr></thead>
        <tbody>{checks.map(({key, label, check, ...rest}) => <PayRow key={key} label={label} hint={'hint' in rest ? rest.hint : undefined} check={check}/>)}</tbody>
      </table>
      <p className="cd-note">✓ 됨 · ✕ 안 됨 · ? 원문에서 확인 못 함. 혜택 ✓는 할인·적립 제외 대상이 아니라는 뜻이라, 이 카드의 혜택 영역이 아니면 받을 게 없을 수 있어요.</p>
    </section>}

    {offers.length > 0 && <section className="cd-sec" id="events">
      <h2>이 카드 이벤트 <small>{offers.length}건</small></h2>
      <div className="mc-rows">{offers.slice(0, 5).map(o => <a key={o.id} className="mc-row mc-evrow" href={eventPath(o.id)}>
        <IssuerTile issuer={o.issuer}/>
        <span className="mc-body"><b className="mc-name">{o.title}</b>{eventSummary(o) && <span className="mc-sum">{eventSummary(o)}</span>}</span>
        <span className="mc-side">{dday(o.endsAt) && <span className="mc-dd">{dday(o.endsAt)}</span>}<small className="mc-end">{o.endsAt ? '~' + ymd(o.endsAt) : ''}</small></span>
      </a>)}</div>
      {offers.length > 5 && <a className="mc-more" href={sitePath('?card=' + encodeURIComponent(card.id) + '#events')}>이벤트 {offers.length - 5}건 더 보기</a>}
    </section>}

    <section className="cd-sec" id="terms">
      <h2>조건</h2>
      {fees.length > 0 && <details className="mc-acc" open={fees.length <= 3}><summary>연회비 <small>{fees.length}가지</small></summary><table className="mc-table"><tbody>{fees.map((f, i) => <tr key={i}><th>{f.label}</th><td>{f.amount}</td></tr>)}</tbody></table></details>}
      {variants.length > 1 && <details className="mc-acc"><summary>같은 카드 다른 브랜드·디자인 <small>{variants.length}종</small></summary><div className="mc-variants">{variants.map(v => <a key={v.id} href={cardPath(v.id)} aria-current={v.id === card.id ? 'page' : undefined}>{v.name}<small>{v.brands.join('·')}</small></a>)}</div></details>}
      {!!card.eligibility?.length && <details className="mc-acc"><summary>발급 대상</summary><ul className="mc-b-lines">{card.eligibility.flatMap(customerLines).map((t, i) => <li key={i}>{t}</li>)}</ul></details>}
      {card.spendExclusions.length > 0 && <details className="mc-acc"><summary>전월실적에서 빠지는 결제 (원문)</summary><ul className="mc-b-lines">{[...new Set(card.spendExclusions.flatMap(customerLines))].slice(0, 30).map((t, i) => <li key={i}>{t}</li>)}</ul></details>}
      {card.benefitExclusions.length > 0 && <details className="mc-acc"><summary>혜택에서 빠지는 결제 (원문)</summary><ul className="mc-b-lines">{[...new Set(card.benefitExclusions.flatMap(customerLines))].slice(0, 30).map((t, i) => <li key={i}>{t}</li>)}</ul></details>}
      <p className="cd-note">카드사 공식 페이지·상품설명서 기준({ymd(card.verifiedAt) || '확인일 미상'} 확인). 최종 조건은 카드사에서 확인하세요.</p>
    </section>
  </main><SiteFooter/></div>;
}
