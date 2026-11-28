"use client";
// 발급 이벤트 비교표 — 네이버페이 · 카카오페이 · 아정당 · 뽐뿌에서 모은 발급 지원금/캐시백 이벤트를
// 카드사별 내 상태(마지막 결제일·보유/탈회·이벤트 수령 이력)와 견줘 참여 가능 여부를 표시합니다.
import {useEffect, useMemo, useState} from 'react';
import type {IssuanceData, IssuanceEvent, IssuerProfile} from '@/lib/issuance-events';
import {
  EMPTY_PROFILE, PROFILE_ISSUERS, VERDICT_ORDER, isProfileEmpty, issuerKey, judge, loadProfiles, midDate,
  ruleLine, saveProfiles, shortDate,
} from '@/lib/issuance-events';
import {Chips, Empty, IssuerTile, SearchBox, Tabs} from '@/components/mc-ui';
import {today, won, ymd} from '@/lib/mc-text';

type VerdictTab = 'all' | 'ok' | 'target' | 'wait';

export function IssuanceView({onCount}: {onCount?: (n: number) => void}) {
  const [data, setData] = useState<IssuanceData | null>(null);
  const [failed, setFailed] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, IssuerProfile>>(() => typeof localStorage === 'undefined' ? {} : loadProfiles());
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [source, setSource] = useState('all');
  const [issuer, setIssuer] = useState('all');
  const [only, setOnly] = useState<VerdictTab>('all');

  useEffect(() => {
    let on = true;
    import('@/data/issuance-events.json')
      .then(m => { if (on) setData(m.default as IssuanceData); }, () => on && setFailed(true));
    return () => { on = false; };
  }, []);
  const setProfile = (name: string, patch: Partial<IssuerProfile>) => {
    setProfiles(prev => {
      const next = {...prev, [name]: {...(prev[name] ?? EMPTY_PROFILE), ...patch}};
      saveProfiles(next);
      return next;
    });
  };

  const events = data?.events ?? [];
  const sources = useMemo(() => {
    const seen: string[] = [];
    for (const e of events) if (!seen.includes(e.source)) seen.push(e.source);
    return seen;
  }, [events]);
  const issuers = useMemo(() => {
    const seen: string[] = [];
    for (const e of events) { const k = issuerKey(e.issuer); if (k && !seen.includes(k)) seen.push(k); }
    return seen.sort((a, b) => PROFILE_ISSUERS.indexOf(a as never) - PROFILE_ISSUERS.indexOf(b as never));
  }, [events]);

  const now = today();
  const rows = useMemo(() => events.map(e => ({e, v: judge(e, profiles[issuerKey(e.issuer)], now)})), [events, profiles, now]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(({e, v}) => {
      if (source !== 'all' && e.source !== source) return false;
      if (issuer !== 'all' && issuerKey(e.issuer) !== issuer) return false;
      if (only === 'ok' && v.status !== 'ok') return false;
      if (only === 'target' && v.status !== 'target') return false;
      if (only === 'wait' && v.status !== 'wait') return false;
      if (term && !(`${e.issuer} ${e.cardName ?? ''} ${e.title} ${e.benefitText ?? ''} ${e.spendCondition ?? ''} ${e.eligibilitySummary ?? ''}`.toLowerCase().includes(term))) return false;
      return true;
    }).sort((a, b) => (VERDICT_ORDER[a.v.status] - VERDICT_ORDER[b.v.status]) || ((b.e.benefitAmount ?? 0) - (a.e.benefitAmount ?? 0)));
  }, [rows, q, source, issuer, only]);

  const counts = useMemo(() => rows.reduce((m, {v}) => { m[v.status] = (m[v.status] ?? 0) + 1; return m; }, {} as Record<string, number>), [rows]);
  useEffect(() => { onCount?.(counts.ok ?? 0); }, [counts.ok, onCount]);
  const filled = PROFILE_ISSUERS.filter(n => profiles[n] && !isProfileEmpty(profiles[n])).length;

  if (failed) return <Empty title="발급 이벤트를 불러오지 못했어요. 새로고침해 주세요."/>;
  if (!data) return <Empty title="발급 이벤트를 불러오고 있어요…"/>;

  return <>
    <section className="is-panel" aria-label="카드사별 내 상태 입력">
      <div className="is-panel-head">
        <div>
          <b>내 카드사 상태</b>
          <small>{filled ? `${filled}곳 입력됨` : '입력하면 참여 가능한 이벤트만 골라 드려요'}</small>
        </div>
        <span className="is-panel-note">저장은 이 브라우저에만</span>
      </div>
      <div className="is-p-list">
        {PROFILE_ISSUERS.map(name => {
          const p = profiles[name] ?? EMPTY_PROFILE;
          const isOpen = open === name;
          return <div className={'is-p-item' + (isOpen ? ' open' : '')} key={name}>
            <button type="button" className="is-p-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : name)}>
              <IssuerTile issuer={name} size="sm"/>
              <b>{name}</b>
              <span className="is-p-sum">{summaryOf(p)}</span>
              <i className={'is-p-dot' + (isProfileEmpty(p) ? '' : ' on')} aria-hidden="true"/>
            </button>
            {isOpen && <div className="is-p-form">
              <label className="is-f">
                <span>마지막 결제일</span>
                <input type="date" value={p.lastPayment ?? ''} max={now} disabled={p.noPayment}
                       onChange={e => setProfile(name, {lastPayment: e.target.value || null, noPayment: false})}/>
              </label>
              <button type="button" className="is-chip" aria-pressed={p.noPayment}
                      onClick={() => setProfile(name, {noPayment: !p.noPayment, lastPayment: !p.noPayment ? null : p.lastPayment})}>
                결제 이력 없음(신규·무실적)
              </button>
              <div className="is-f">
                <span>카드 보유 상태</span>
                <div className="is-seg" role="group" aria-label={`${name} 카드 보유 상태`}>
                  {([['none', '미보유'], ['holding', '보유 중'], ['canceled', '탈회']] as const).map(([v, l]) =>
                    <button key={v} type="button" aria-pressed={p.holding === v} onClick={() => setProfile(name, {holding: p.holding === v ? null : v})}>{l}</button>)}
                </div>
              </div>
              {p.holding === 'canceled' && <label className="is-f">
                <span>탈회일</span>
                <input type="date" value={p.canceledAt ?? ''} max={now} onChange={e => setProfile(name, {canceledAt: e.target.value || null})}/>
              </label>}
              <label className="is-f">
                <span>최근 이벤트 혜택 수령일</span>
                <input type="date" value={p.lastReward ?? ''} max={now} disabled={p.noReward}
                       onChange={e => setProfile(name, {lastReward: e.target.value || null, noReward: false})}/>
              </label>
              <button type="button" className="is-chip" aria-pressed={p.noReward}
                      onClick={() => setProfile(name, {noReward: !p.noReward, lastReward: !p.noReward ? null : p.lastReward})}>
                수령 이력 없음
              </button>
              <label className="is-check">
                <input type="checkbox" checked={p.targetCardUnused} onChange={e => setProfile(name, {targetCardUnused: e.target.checked})}/>
                대상 카드로는 결제한 적 없음
              </label>
            </div>}
          </div>;
        })}
      </div>
      <p className="is-p-help">결제일·탈회일·수령일로 <b>N일 뒤 가능</b>을 계산해요. 조건이 끝나기 전에 이벤트가 끝나면 <b>조건 미충족</b>으로 표시합니다.</p>
    </section>

    <div className="is-filters">
      <Chips label="출처" items={[{value: 'all', label: '전체', count: events.length}, ...sources.map(s => ({value: s, label: s}))]} value={source} onChange={setSource}/>
      <Chips label="카드사" issuers items={[{value: 'all', label: '전체'}, ...issuers.map(i => ({value: i, label: i, issuer: i}))]} value={issuer} onChange={setIssuer}/>
    </div>
    <div className="is-bar">
      <Tabs label="참여 가능" items={[
        {value: 'all', label: '전체', count: rows.length},
        {value: 'ok', label: '✅ 참여 가능', count: counts.ok ?? 0},
        {value: 'target', label: '⚠️ 대상카드', count: counts.target ?? 0},
        {value: 'wait', label: '⏳ 대기', count: counts.wait ?? 0},
      ]} value={only} onChange={v => setOnly(v as VerdictTab)}/>
      <SearchBox value={q} onChange={setQ} placeholder="카드·이벤트 검색"/>
    </div>

    {filtered.length ? <div className="is-table" role="table" aria-label="발급 이벤트 비교">
      <div className="is-tr is-th" role="row">
        <span role="columnheader">카드사</span><span role="columnheader">출처</span><span role="columnheader">카드 · 이벤트</span>
        <span role="columnheader">혜택</span><span role="columnheader">이용조건</span><span role="columnheader">무실적 기준</span><span role="columnheader">참여 가능</span>
      </div>
      {filtered.map(({e, v}) => <Row key={e.id} e={e} v={v}/>)}
    </div> : <Empty title={only === 'ok' ? '지금 바로 참여 가능한 이벤트가 없어요.' : '조건에 맞는 이벤트가 없어요.'} action={{label: '필터 초기화', onClick: () => { setQ(''); setSource('all'); setIssuer('all'); setOnly('all'); }}}/>}

    <p className="mc-note">
      {midDate(data.updatedAt)} 수집 · {events.length}건 (네이버페이 {data.counts?.['네이버페이'] ?? 0} · 카카오페이 {data.counts?.['카카오페이'] ?? 0} · 아정당 {data.counts?.['아정당'] ?? 0} · 뽐뿌 {data.counts?.['뽐뿌'] ?? 0}) — 조건은 카드사 심사·원문 공지로 달라질 수 있어요.
    </p>
  </>;
}

function Row({e, v}: {e: IssuanceEvent; v: ReturnType<typeof judge>}) {
  const [openRule, setOpenRule] = useState(false);
  const rule = ruleLine(e);
  return <div className={'is-tr is-state-' + v.status + (openRule ? ' is-open' : '')} role="row">
    <span className="is-c-issuer" role="cell">{e.issuer ? <IssuerTile issuer={e.issuer} size="xs"/> : null}<b>{e.issuer || '카드사 미확인'}</b></span>
    <span className="is-c-source" role="cell" data-label="출처"><i className="is-src" data-src={e.sourceId}>{e.source}</i></span>
    <span className="is-c-name" role="cell" data-label="카드·이벤트">
      <a href={e.url} target="_blank" rel="noopener noreferrer">{e.cardName || e.title}</a>
      {e.cardName && e.title && e.cardName !== e.title && <small>{e.title}</small>}
      {e.period && <small className="is-period">{ymd(e.startsAt)}~{ymd(e.endsAt)}</small>}
    </span>
    <span className="is-c-benefit" role="cell" data-label="혜택"><b>{e.benefitAmount ? won(e.benefitAmount) : e.benefitText ?? '업체 문의'}</b></span>
    <span className="is-c-spend" role="cell" data-label="이용조건">{e.spendCondition ?? '—'}</span>
    <span className="is-c-rule" role="cell" data-label="무실적 기준">
      <button type="button" className="is-rule" aria-expanded={openRule} onClick={() => setOpenRule(o => !o)} disabled={!rule}>
        {rule ?? '조건 확인 필요'}
      </button>
      {openRule && <span className="is-rule-more">
        {e.eligibilityRuleText || e.note || '원문에서 확인해 주세요.'}
        {e.spendCondition && <i>이용조건 · {e.spendCondition}</i>}
      </span>}
    </span>
    <span className="is-c-verdict" role="cell" data-label="참여 가능">
      <span className={'is-badge s-' + v.status}>{ICON[v.status]}{v.label}</span>
      {v.status === 'wait' && v.from && <small>{shortDate(v.from)}부터{v.days !== undefined ? ` (D-${v.days})` : ''}</small>}
      {v.status === 'blocked' && v.reasons.length > 0 && <small>{v.reasons[0]}</small>}
      {v.status === 'unknown' && v.missing?.length ? <small>{v.missing.join('·')} 입력</small> : null}
      {v.status === 'target' && <small>내 카드 미사용이면 가능</small>}
      {v.status === 'ok' && v.reasons.length > 0 && <small>{v.reasons[0]}</small>}
    </span>
  </div>;
}

const ICON: Record<string, string> = {ok: '✅ ', target: '⚠️ ', wait: '⏳ ', blocked: '❌ ', unknown: '⚪ '};

function summaryOf(p: IssuerProfile): string {
  const parts: string[] = [];
  if (p.noPayment) parts.push('결제 이력 없음');
  else if (p.lastPayment) parts.push(`결제 ${shortDate(p.lastPayment)}`);
  if (p.holding === 'holding') parts.push('보유 중');
  else if (p.holding === 'none') parts.push('미보유');
  else if (p.holding === 'canceled') parts.push(p.canceledAt ? `탈회 ${shortDate(p.canceledAt)}` : '탈회');
  if (p.noReward) parts.push('수령 이력 없음');
  else if (p.lastReward) parts.push(`수령 ${shortDate(p.lastReward)}`);
  return parts.length ? parts.join(' · ') : '눌러서 입력';
}

