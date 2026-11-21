// 카드 상세 — 표준 양식: 머리(이미지·카드사·이름) → 기본 정보 표 → 혜택 표 → 피킹률 표 → 결제 인정 표 → 이벤트 → 원문
// 모든 정보는 같은 모양의 표(.cd-t)로만 보여 준다. 설명 문단은 두지 않는다.
import {Fragment, useEffect, useState, type ReactNode} from 'react';
import {sitePath} from '@/lib/site-path';
import {SiteHeader, SiteFooter} from '@/components/customer-shell';
import {CardArt} from '@/components/mc-ui';
import {CompareDock, CompareToggle} from '@/components/compare';
import {benefitAt, firstSpend, monthlyMax, similarCards, spendShort} from '@/lib/card-value';
import {rememberCard} from '@/lib/my-cards';
import {activeOffer, cardFamilyKey, dedupeOffers, eventPath, formatPicking, linkedOffers, pickingExcluded, pickingOptions, rewardValue} from '@/lib/catalog-model';
import {PAYMENT_CHECKS, paymentCheck, type PaymentCheck} from '@/lib/card-themes';
import {annualFeeRows, cardPath, networkBrands} from '@/lib/card-presentation';
import {customerLines} from '@/lib/customer-copy';
import {pendingValet, valetHotelResults, valetMapPath, valetQuota, valetRules} from '@/lib/hotel-valet';
import {benefitRow, cardMinimumSpend, cleanBenefits, dday, feeLabel, headlineAmount, pickLabel, won, ymd, type BenefitRow} from '@/lib/mc-text';
import type {Card, Offer} from '@/lib/catalog-types';

const MARK = {allowed: ['✓', 'ok', '인정'], excluded: ['✕', 'no', '제외'], unknown: ['?', 'na', '미확인'], na: ['–', 'na', '해당 없음']} as const;

/** 카드사 상품설명서처럼: 구분 | 적용처 | 혜택 | 한도. 묶음([일상] 등)은 가로 머리줄, 통합 한도는 세로로 합친 칸 */
function BenefitGrid({rows, common, extra, narrow}: {rows: BenefitRow[]; common: string | null; extra: ReactNode; narrow: boolean}) {
  const groups: {name: string | null; rows: BenefitRow[]}[] = [];
  for (const r of rows) { const last = groups[groups.length - 1]; if (last && last.name === r.group) last.rows.push(r); else groups.push({name: r.group, rows: [r]}); }
  const limitCell = (r: BenefitRow) => {
    const lines = [...(r.limit ? [r.limit + (r.tiers.length ? ' (실적별)' : '')] : []), ...(r.spend && r.spend !== common ? [r.spend] : []), ...r.extras];
    return lines.length ? lines.map((l, i) => <span key={i}>{l}</span>) : <span className="mute">–</span>;
  };
  // 휴대폰 폭에서는 적용처를 구분 칸 아래 작은 글씨로 넣어 3칸으로 (4칸이면 글자가 한두 자씩 끊김)
  const n = narrow ? 3 : 4;
  return <table className={'cd-g cd-ben' + (narrow ? ' narrow' : '')}>
    {narrow ? <colgroup><col className="c-label"/><col className="c-val"/><col className="c-lim"/></colgroup>
      : <colgroup><col className="c-label"/><col/><col className="c-val"/><col className="c-lim"/></colgroup>}
    <thead><tr><th scope="col">구분</th>{!narrow && <th scope="col">적용처</th>}<th scope="col">혜택</th><th scope="col">한도·조건</th></tr></thead>
    <tbody>{groups.map((g, gi) => <Fragment key={gi}>
      {g.name && <tr className="cd-g-grp"><th colSpan={n} scope="rowgroup">{g.name}</th></tr>}
      {g.rows.map((r, i) => {
        const key = (x: BenefitRow) => x.shared && x.limit ? x.limit + '|' + (x.spend ?? '') : null;
        const k = key(r);
        if (k && i > 0 && key(g.rows[i - 1]) === k) return <tr key={i}>{cells(r, false)}</tr>;
        let span = 1;
        while (k && i + span < g.rows.length && key(g.rows[i + span]) === k) span++;
        return <tr key={i}>{cells(r, true, span)}</tr>;
      })}
    </Fragment>)}{extra}</tbody>
  </table>;
  function cells(r: BenefitRow, withLimit: boolean, span = 1) {
    return <>
      {narrow ? <th scope="row" className="wide">{r.label}{r.place && <small className="cd-g-place">{r.place}</small>}</th>
        : r.place ? <><th scope="row">{r.label}</th><td>{r.place}</td></> : <th scope="row" colSpan={2} className="wide">{r.label}</th>}
      <td className="cd-g-val">{r.value.main ? <><b>{r.value.main}</b>{r.value.sub && <small>{r.value.sub}</small>}</> : <span className="mute">–</span>}</td>
      {withLimit && <td className="cd-g-lim" rowSpan={span > 1 ? span : undefined}>{limitCell(r)}</td>}
    </>;
  }
}

function PayTr({label, check}: {label: string; check: PaymentCheck}) {
  const [open, setOpen] = useState(false);
  const ev = check.spendEvidence && check.spendEvidence === check.benefitEvidence ? [['실적·혜택', check.spendEvidence]]
    : [['실적', check.spendEvidence], ['혜택', check.benefitEvidence]].filter(([, t]) => t);
  const cell = (k: keyof typeof MARK) => <td className={'cd-t-mark ' + MARK[k][1]}><span aria-label={MARK[k][2]}>{MARK[k][0]}</span></td>;
  return <>
    <tr className={ev.length ? 'cd-t-has' : undefined} onClick={ev.length ? () => setOpen(v => !v) : undefined} aria-expanded={ev.length ? open : undefined}>
      <th scope="row"><b>{label}</b></th>{cell(check.spend)}{cell(check.benefit)}
    </tr>
    {open && <tr className="cd-t-open"><td colSpan={3}><ul>{ev.map(([k, t]) => <li key={k}><b>{k}</b> {t}</li>)}</ul></td></tr>}
  </>;
}

/** 폭이 좁은 화면인지 (혜택 표를 3칸으로) */
function useNarrow(q = '(max-width: 520px)') {
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q); const f = () => setOn(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, [q]);
  return on;
}

/** 공유: 휴대폰은 공유 창, 아니면 주소 복사 */
function ShareButton({title}: {title: string}) {
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(false), 1800); return () => clearTimeout(t); }, [done]);
  const share = async () => {
    const url = location.href.split('#')[0];
    try {
      if (navigator.share) await navigator.share({title: `${title} | Mr. Cards`, url});
      else { await navigator.clipboard.writeText(url); setDone(true); }
    } catch { /* 공유 창을 닫은 경우 */ }
  };
  return <button type="button" className="mc-btn" onClick={share}>{done ? '주소 복사됨 ✓' : '공유'}</button>;
}

const signedWon = (n: number) => (n < 0 ? '−' : '+') + (Math.abs(n) >= 10000 ? `${Number((Math.abs(n) / 10000).toFixed(1)).toLocaleString('ko-KR')}만원` : `${Math.round(Math.abs(n)).toLocaleString('ko-KR')}원`);
const SPENDS = [300000, 500000, 1000000, 1500000, 2000000];

/** 한 달 지출을 고르면 월·1년 혜택과 연회비를 뺀 1년 남는 돈 */
function Calculator({picks, card}: {picks: ReturnType<typeof pickingOptions>; card: Card}) {
  const fee = card.annualFeeMin;
  const start = firstSpend(picks);
  const [spend, setSpend] = useState(() => SPENDS.find(v => !start || v >= start) ?? SPENDS[SPENDS.length - 1]);
  const [custom, setCustom] = useState('');
  const got = benefitAt(picks, spend, card);
  const monthly = got ? Math.round(got.benefit) : 0, yearly = monthly * 12, net = yearly - (fee ?? 0);
  return <section className="cd-sec">
    <h2>내 지출로 계산</h2>
    <div className="cd-calc-pick" role="group" aria-label="한 달 카드 지출">
      {SPENDS.map(v => <button key={v} type="button" aria-pressed={!custom && spend === v} onClick={() => { setCustom(''); setSpend(v); }}>{won(v)}</button>)}
      <label className={'cd-calc-in' + (custom ? ' on' : '')}><input inputMode="numeric" placeholder="직접" value={custom} aria-label="한 달 지출 직접 입력(만원)"
        onChange={e => { const v = e.target.value.replace(/[^\d]/g, '').slice(0, 4); setCustom(v); if (v) setSpend(Number(v) * 10000); }}/>만원</label>
    </div>
    <table className="cd-t cd-calc">
      <tbody>
        <tr><th scope="row">한 달 혜택</th><td className="cd-t-num">{got ? <><b>{won(monthly)}</b><small>{pickLabel(got.basis)}</small></> : <span className="mute">{start ? `${won(start)}부터 혜택` : '–'}</span>}</td></tr>
        <tr><th scope="row">1년 혜택</th><td className="cd-t-num">{got ? won(yearly) : '–'}</td></tr>
        <tr><th scope="row">연회비</th><td className="cd-t-num">{fee ? '−' + won(fee) : '없음'}</td></tr>
        <tr className="cd-calc-net"><th scope="row">1년 남는 돈</th><td className="cd-t-num"><b className={net >= 0 ? 'plus' : 'minus'}>{signedWon(net)}</b></td></tr>
      </tbody>
    </table>
    <p className="cd-foot">한 달 {won(spend)}을 혜택 한도에 맞춰 나눠 쓸 때 받을 수 있는 최대치예요. 바우처·라운지 같은 서비스는 뺐어요.</p>
  </section>;
}

/** 연회비: 모두 같으면 한 값, 다르면 "브랜드 금액 · …" */
function feeText(card: Card) {
  const rows = annualFeeRows(card).filter(r => r.amount !== '미확인');
  if (card.annualFeeMin === 0 && rows.every(r => /없음|면제|^0원/.test(r.amount))) return {main: '없음', sub: ''};
  const main = card.annualFeeMin === null ? '–' : won(card.annualFeeMin);
  const named = rows.filter(r => r.label !== '연회비' && r.label !== '연회비 안내' && r.amount.length <= 14);
  const sub = named.length > 1 && new Set(named.map(r => r.amount)).size > 1 ? named.map(r => `${r.label.replace(/\s*\(.*?\)\s*/g, '')} ${r.amount}`).join(' · ') : '';
  return {main: main + (sub ? '~' : ''), sub};
}

export default function CardDetail({card, catalog}: {card: Card; catalog: {cards: Card[]; events: Offer[]}}) {
  const variants = catalog.cards.filter(c => cardFamilyKey(c) === cardFamilyKey(card));
  const offers = dedupeOffers((variants.length ? variants : [card]).flatMap(c => linkedOffers(c, catalog.events)));
  const benefits = cleanBenefits(card).filter(b => !b.voucher || b.rate || b.lines.length);
  const picks = pickingOptions(card).sort((a, b) => b.value - a.value)
    .filter((p, i, all) => all.findIndex(q => q.value.toFixed(2) === p.value.toFixed(2) && q.scenario.minimumEligibleSpend === p.scenario.minimumEligibleSpend) === i);
  const best = picks[0];
  const top = monthlyMax(picks);
  const narrow = useNarrow();
  useEffect(() => { rememberCard(card.id); }, [card.id]);
  // 지금 받을 수 있는 발급 캐시백 중 가장 큰 것
  const cashback = offers.filter(o => o.kind === 'cashback' && activeOffer(o)).map(o => ({o, amount: headlineAmount(o, rewardValue(o))})).sort((a, b) => b.amount - a.amount)[0];
  const similar = similarCards(card, catalog.cards);
  const dropped = pickingExcluded(card);
  const valet = valetRules(card.id), valetPending = pendingValet(card.id);
  const services = (card.networkServices ?? []).filter(s => s.category !== 'hotel_valet');
  const checks = PAYMENT_CHECKS.map(item => ({...item, check: paymentCheck(card, item.key)}))
    .filter(({check}) => check.spend !== 'unknown' || (check.benefit !== 'unknown' && check.benefit !== 'na'));
  const spend = cardMinimumSpend(card);
  // 위에 카드사를 따로 쓰니 이름 앞의 카드사명은 뺌 ("삼성카드 taptap O" → "taptap O")
  const title = card.name.replace(new RegExp('^' + card.issuer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+'), '') || card.name;
  const fee = feeText(card);
  // 카드 값보다 혜택별 조건이 실제에 가까움: 혜택에 전월실적이 걸려 있으면 그 최소값을 보여 줌
  const benefitSpends = card.benefits.map(b => b.minimumSpend).filter((v): v is number => typeof v === 'number');
  const positive = [...new Set(benefitSpends.filter(v => v > 0))].sort((a, b) => a - b);
  const spendInfo = positive.length
    ? {main: won(positive[0]) + ' 이상', sub: benefitSpends.includes(0) ? '일부 혜택은 실적 무관' : positive.length > 1 ? '혜택별로 다름' : ''}
    : {main: spend.value === null ? '–' : spend.value === 0 ? '없음' : won(spend.value) + (spend.varies ? '~' : ' 이상'), sub: ''};
  const brands = networkBrands(card.brands).map(b => b.label).filter(b => b !== '국내전용');
  const [allBenefits, setAllBenefits] = useState(false);
  const [allPicks, setAllPicks] = useState(false);
  const SHOW = 10;
  const rows = (allBenefits ? benefits : benefits.slice(0, SHOW)).map(benefitRow);
  // 기본 정보의 전월실적과 같은 조건은 혜택 칸마다 되풀이하지 않음
  const common = positive.length ? '전월 ' + won(positive[0]) : spend.value === 0 ? '실적 무관' : null;
  const eligibility = (card.eligibility ?? []).flatMap(customerLines);
  const spendOut = [...new Set(card.spendExclusions.flatMap(customerLines))];
  const benefitOut = [...new Set(card.benefitExclusions.flatMap(customerLines))];

  return <div className="pm-site mc"><SiteHeader current="cards"/><main className="mc-main mc-detail cd">
    <a href={sitePath('#cards')} className="mc-back">← 카드 목록</a>

    <header className="cd-head">
      <div className="cd-head-art"><CardArt card={card} large/></div>
      <div className="cd-head-t">
        <p>{card.issuer}</p>
        <h1>{title}</h1>
        {(cashback || top) && <div className="cd-badges">
          {cashback && <a className="cd-badge gift" href={eventPath(cashback.o.id)}>발급 캐시백{cashback.amount ? ` 최대 ${won(cashback.amount)}` : ''}{dday(cashback.o.endsAt) && <small>{dday(cashback.o.endsAt)}</small>}</a>}
          {top && <span className="cd-badge">월 최대 {won(Math.round(top.benefit))} 혜택</span>}
        </div>}
        <div className="cd-actions">
          <a className="mc-btn primary" href={card.sourceUrl} target="_blank" rel="noopener noreferrer">카드사에서 신청 ↗</a>
          {card.termsUrl && <a className="mc-btn" href={card.termsUrl} target="_blank" rel="noopener noreferrer">상품설명서</a>}
          <CompareToggle id={card.id}/>
          <ShareButton title={title}/>
        </div>
      </div>
    </header>

    <table className="cd-t cd-info">
      <tbody>
        <tr><th scope="row">종류</th><td>{card.type === 'credit' ? '신용' : '체크'}{brands.length > 0 && <small>{brands.join(' · ')}</small>}</td></tr>
        <tr><th scope="row">연회비</th><td><b>{fee.main}</b>{fee.sub && <small>{fee.sub}</small>}</td></tr>
        <tr><th scope="row">전월실적</th><td><b>{spendInfo.main}</b>{spendInfo.sub && <small>{spendInfo.sub}</small>}</td></tr>
        {best && <tr><th scope="row">최고 피킹률</th><td><b className="up">{formatPicking(best.value)}%</b></td></tr>}
        {top && <tr><th scope="row">월 최대 혜택</th><td><b>{won(Math.round(top.benefit))}</b><small>월 {won(top.spend)} 쓰고 한도를 다 채울 때</small></td></tr>}
      </tbody>
    </table>

    <section className="cd-sec">
      <h2>혜택<small>{benefits.length}</small></h2>
      {benefits.length ? <BenefitGrid rows={rows} common={common} narrow={narrow} extra={<>
          {services.map(s => <tr key={s.id}>
            <th scope="row" colSpan={narrow ? 1 : 2} className="wide">{s.title}</th>
            <td className="cd-g-val"><b>{s.benefitMode === 'discount' ? '할인' : s.benefitMode === 'paid' ? '유료' : '무료'}</b></td>
            <td className="cd-g-lim">{[s.minimumSpend ? `전월 ${won(s.minimumSpend)}` : '', s.annualLimit ? `연 ${s.annualLimit}회` : s.monthlyLimit ? `월 ${s.monthlyLimit}회` : '', s.guestCount ? `동반 ${s.guestCount}인` : ''].filter(Boolean).map(c => <span key={c}>{c}</span>)}</td>
          </tr>)}
          {valet.map(p => {
            const v = p.cards.find(x => x.catalogId === card.id);
            return <tr key={p.id}>
              <th scope="row" colSpan={narrow ? 1 : 2} className="wide">호텔 발레파킹 <a href={valetMapPath(v ? `${p.id}:${v.key}` : card.id)}>서울 {valetHotelResults(p).length}곳 →</a></th>
              <td className="cd-g-val"><b>무료</b></td>
              <td className="cd-g-lim"><span>전월 {won(p.minimumSpend)}</span><span>{valetQuota(p)}</span></td>
            </tr>;
          })}
          {valetPending && <tr><th scope="row" colSpan={narrow ? 1 : 2} className="wide">호텔 발레파킹</th><td className="cd-g-val"><span className="mute">확인 중</span></td><td className="cd-g-lim"><span className="mute">–</span></td></tr>}
        </>}/> : <p className="cd-empty">정리된 혜택 없음 · 카드사 페이지 참고</p>}
      {benefits.length > SHOW && <button type="button" className="mc-more" onClick={() => setAllBenefits(v => !v)}>{allBenefits ? '접기' : `${benefits.length - SHOW}개 더 보기`}</button>}
    </section>

    {best && <section className="cd-sec">
      <h2>피킹률</h2>
      <table className="cd-t cd-pk">
        <thead><tr><th scope="col">사용처</th><th scope="col">월 혜택</th><th scope="col">피킹률</th></tr></thead>
        <tbody>{(allPicks ? picks : picks.slice(0, 4)).map((p, i) => {
          const spent = p.scenario.totalSpend ?? p.scenario.minimumEligibleSpend ?? p.scenario.monthlySpend;
          return <tr key={i}>
            <th scope="row"><b>{p.scenario.benefitScope ?? pickLabel(p.scenario.label)}</b>{spent ? <small>월 {won(spent)} 사용</small> : null}</th>
            <td className="cd-t-num"><span>{p.scenario.monthlyBenefit ? won(Math.round(p.scenario.monthlyBenefit)) : '–'}</span></td>
            <td className="cd-t-num"><b>{formatPicking(p.value)}%</b></td>
          </tr>;
        })}</tbody>
      </table>
      {picks.length > 4 && <button type="button" className="mc-more" onClick={() => setAllPicks(v => !v)}>{allPicks ? '접기' : `${picks.length - 4}개 더 보기`}</button>}
      <p className="cd-foot">한 달 혜택 ÷ 쓴 금액{dropped.length > 0 && ` · 제외: ${dropped.join(', ')}`}</p>
    </section>}

    {best && <Calculator picks={picks} card={card}/>}

    {checks.length > 0 && <section className="cd-sec">
      <h2>결제별 인정</h2>
      <table className="cd-t cd-pay">
        <thead><tr><th scope="col">결제</th><th scope="col">전월실적</th><th scope="col">혜택</th></tr></thead>
        <tbody>{checks.map(({key, label, check}) => <PayTr key={key} label={label} check={check}/>)}</tbody>
      </table>
      <p className="cd-foot">✓ 인정 · ✕ 제외 · ? 원문 미확인</p>
    </section>}

    {offers.length > 0 && <section className="cd-sec">
      <h2>이벤트<small>{offers.length}</small></h2>
      <table className="cd-t cd-ev">
        <tbody>{offers.slice(0, 5).map(o => <tr key={o.id} className="cd-t-has" onClick={() => { location.href = eventPath(o.id); }}>
          <th scope="row"><a href={eventPath(o.id)}><b>{o.title}</b></a></th>
          <td className="cd-t-num">{dday(o.endsAt) && <b>{dday(o.endsAt)}</b>}<small>{o.endsAt ? '~' + ymd(o.endsAt) : ''}</small></td>
        </tr>)}</tbody>
      </table>
      {offers.length > 5 && <a className="mc-more" href={sitePath('?card=' + encodeURIComponent(card.id) + '#events')}>{offers.length - 5}건 더 보기</a>}
    </section>}

    {similar.length > 0 && <section className="cd-sec">
      <h2>비슷한 카드</h2>
      <div className="mc-rows cd-sim">{similar.map(({c, shared, pick}) => <div key={c.id} className="mc-row mc-cardrow">
        <CardArt card={c}/>
        <span className="mc-body">
          <span className="mc-issuer">{c.issuer}</span>
          <a className="mc-name mc-stretch" href={cardPath(c.id)}>{c.familyName ?? c.name}</a>
          <span className="mc-facts">{[c.type === 'credit' ? '신용' : '체크', feeLabel(c.annualFeeMin), spendShort(c)].filter(Boolean).join(' · ')}</span>
          <span className="mc-hl">{shared.slice(0, 3).map(a => <i key={a}>{a}</i>)}</span>
        </span>
        <span className="mc-side">
          {pick !== null && <span className="mc-pick"><small>피킹률</small>{formatPicking(pick)}%</span>}
          <CompareToggle id={c.id} compact/>
        </span>
      </div>)}</div>
      <p className="cd-foot">같은 {card.type === 'credit' ? '신용' : '체크'}카드·비슷한 연회비 중 혜택 영역이 겹치는 카드</p>
    </section>}

    {(benefits.length > 0 || variants.length > 1 || eligibility.length > 0 || spendOut.length > 0 || benefitOut.length > 0) && <section className="cd-sec">
      <h2>원문</h2>
      {variants.length > 1 && <details className="mc-acc"><summary>다른 브랜드·디자인<small>{variants.length}</small></summary><div className="mc-variants">{variants.map(v => <a key={v.id} href={cardPath(v.id)} aria-current={v.id === card.id ? 'page' : undefined}>{v.name}<small>{v.brands.join('·')}</small></a>)}</div></details>}
      {benefits.some(b => b.lines.length || b.cap) && <details className="mc-acc"><summary>혜택 원문</summary><dl className="cd-orig">{benefits.map((b, i) => <div key={i}><dt>{b.title}</dt>{[b.cap && b.cap !== '한도 없음' ? '한도: ' + b.cap : '', ...b.lines].filter(Boolean).map((l, j) => <dd key={j}>{l}</dd>)}</div>)}</dl></details>}
      {eligibility.length > 0 && <details className="mc-acc"><summary>발급 대상</summary><ul className="mc-b-lines">{eligibility.map((t, i) => <li key={i}>{t}</li>)}</ul></details>}
      {spendOut.length > 0 && <details className="mc-acc"><summary>전월실적 제외<small>{Math.min(spendOut.length, 30)}</small></summary><ul className="mc-b-lines">{spendOut.slice(0, 30).map((t, i) => <li key={i}>{t}</li>)}</ul></details>}
      {benefitOut.length > 0 && <details className="mc-acc"><summary>혜택 제외<small>{Math.min(benefitOut.length, 30)}</small></summary><ul className="mc-b-lines">{benefitOut.slice(0, 30).map((t, i) => <li key={i}>{t}</li>)}</ul></details>}
    </section>}

    <p className="cd-foot">출처 카드사 공식 · {ymd(card.verifiedAt) || '확인일 미상'}</p>
    <CompareDock cards={catalog.cards} events={catalog.events}/>
  </main><SiteFooter/></div>;
}
