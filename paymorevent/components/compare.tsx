// 카드 비교: 비교 담기 버튼 · 아래 비교함 막대 · 비교 표(최대 3장)
import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {CardArt} from '@/components/mc-ui';
import {activeOffer, bestPicking, formatPicking, offerApplies, visibleOffer} from '@/lib/catalog-model';
import {hotelTier, useFit} from '@/lib/card-themes';
import {cardPath} from '@/lib/card-presentation';
import {valetRules} from '@/lib/hotel-valet';
import {COMPARE_KEY, COMPARE_MAX, clearCompare, toggleCompare, useStoredIds} from '@/lib/my-cards';
import {feeLabel, highlights} from '@/lib/mc-text';
import {spendShort} from '@/lib/card-value';
import type {Card, Offer} from '@/lib/catalog-types';

/** 비교 담기/빼기. 가득 차면 잠깐 알려 줌 */
export function CompareToggle({id, compact}: {id: string; compact?: boolean}) {
  const ids = useStoredIds(COMPARE_KEY);
  const on = ids.includes(id);
  const [full, setFull] = useState(false);
  useEffect(() => { if (!full) return; const t = setTimeout(() => setFull(false), 1800); return () => clearTimeout(t); }, [full]);
  return <button type="button" className={'mc-cmp' + (compact ? ' compact' : ' mc-btn')} aria-pressed={on}
    onClick={e => { e.preventDefault(); e.stopPropagation(); if (!toggleCompare(id)) setFull(true); }}>
    {full ? `최대 ${COMPARE_MAX}장` : on ? (compact ? '비교 ✓' : '비교함에 담김 ✓') : (compact ? '+ 비교' : '+ 비교 담기')}
  </button>;
}

/** 화면 아래 비교함 막대 + 비교 표 */
export function CompareDock({cards, events}: {cards: Card[]; events: Offer[]}) {
  const ids = useStoredIds(COMPARE_KEY);
  const [open, setOpen] = useState(false);
  const byId = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards]);
  const picked = ids.map(id => byId.get(id)).filter((c): c is Card => !!c);
  useEffect(() => { if (!picked.length) setOpen(false); }, [picked.length]);
  if (!picked.length) return null;
  return <>
    <div className="mc-dock" role="region" aria-label="비교함">
      <div className="mc-dock-cards">{picked.map(c => <CardArt key={c.id} card={c}/>)}{Array.from({length: COMPARE_MAX - picked.length}, (_, i) => <span key={i} className="mc-dock-empty" aria-hidden="true"/>)}</div>
      <span className="mc-dock-n"><b>{picked.length}</b>/{COMPARE_MAX}</span>
      <button type="button" className="mc-link" onClick={clearCompare}>비우기</button>
      <button type="button" className="mc-btn primary" disabled={picked.length < 2} onClick={() => setOpen(true)}>{picked.length < 2 ? '1장 더 담기' : '비교하기'}</button>
    </div>
    {open && <CompareSheet cards={picked} events={events} onClose={() => setOpen(false)}/>}
  </>;
}

const O = <span className="ok">O</span>, X = <span className="mute">–</span>;
function CompareSheet({cards, events, onClose}: {cards: Card[]; events: Offer[]; onClose: () => void}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);
  const live = useMemo(() => events.filter(o => visibleOffer(o) && activeOffer(o)), [events]);
  const info = cards.map(c => {
    const offers = live.filter(o => offerApplies(c, o));
    return {c, pick: bestPicking(c)?.value ?? null, offers: offers.length, cashback: offers.some(o => o.kind === 'cashback'), hl: highlights(c, 4), valet: valetRules(c.id).length > 0};
  });
  const fees = info.map(x => x.c.annualFeeMin).filter((v): v is number => v !== null);
  const picks = info.map(x => x.pick).filter((v): v is number => v !== null);
  const minFee = fees.length > 1 ? Math.min(...fees) : null, maxPick = picks.length > 1 ? Math.max(...picks) : null;
  const fit = (c: Card, t: string) => useFit(c, t) ? O : X;
  const rows: [string, (x: typeof info[number]) => ReactNode][] = [
    ['종류', x => x.c.type === 'credit' ? '신용' : '체크'],
    ['연회비', x => <b className={x.c.annualFeeMin !== null && x.c.annualFeeMin === minFee ? 'best' : undefined}>{(feeLabel(x.c.annualFeeMin) ?? '–').replace(/^연회비\s*/, '')}</b>],
    ['전월실적', x => (spendShort(x.c) ?? '–').replace(/^전월\s*/, '')],
    ['최고 피킹률', x => x.pick === null ? X : <b className={x.pick === maxPick ? 'best up' : 'up'}>{formatPicking(x.pick)}%</b>],
    ['주요 혜택', x => x.hl.length ? <ul>{x.hl.map(h => <li key={h}>{h}</li>)}</ul> : X],
    ['상품권(상테크)', x => fit(x.c, '상품권 가능')],
    ['관리비', x => fit(x.c, '관리비')],
    ['국세·지방세', x => useFit(x.c, '국세') || useFit(x.c, '지방세') ? O : X],
    ['호텔 등급', x => hotelTier(x.c)?.split(' · ')[0] ?? X],
    ['호텔 발레', x => x.valet ? O : X],
    ['진행 이벤트', x => x.offers ? <>{x.offers}건{x.cashback && <small>발급 캐시백</small>}</> : X],
  ];
  return <dialog ref={ref} className="mc-sheet" aria-label="카드 비교" onClose={onClose} onClick={e => { if (e.target === ref.current) ref.current?.close(); }}>
    <div className="mc-sheet-in">
      <header className="mc-sheet-head"><h2>카드 비교</h2><button type="button" className="mc-x" aria-label="닫기" onClick={() => ref.current?.close()}>×</button></header>
      <div className="mc-sheet-body">
        <table className="cd-t mc-cmpt" data-n={info.length}>
          <thead><tr><th scope="col"><span className="sr">항목</span></th>{info.map(({c}) => <th key={c.id} scope="col">
            <a href={cardPath(c.id)}><CardArt card={c}/><small>{c.issuer}</small><b>{c.familyName ?? c.name}</b></a>
            <button type="button" className="mc-link" onClick={() => toggleCompare(c.id)}>빼기</button>
          </th>)}</tr></thead>
          <tbody>{rows.map(([label, cell]) => <tr key={label}><th scope="row">{label}</th>{info.map(x => <td key={x.c.id}>{cell(x)}</td>)}</tr>)}</tbody>
        </table>
        <p className="cd-foot">피킹률은 한도를 다 채울 때 기준 · 상품권·관리비·세금 O는 실제로 써서 남는 게 있는 카드</p>
      </div>
    </div>
  </dialog>;
}
