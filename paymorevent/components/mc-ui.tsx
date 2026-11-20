// Mr. Cards 공통 화면 조각 (Mr. Stocks·Hotels와 같은 타일·칩·행 모양)
import {useState} from 'react';
import images from '@/data/card-images.json';
import {assetPath} from '@/lib/site-path';
import {issuerTile} from '@/lib/mc-text';
import type {Card} from '@/lib/catalog-types';

export function IssuerTile({issuer, size}: {issuer: string; size?: 'xs' | 'sm' | 'lg'}) {
  const [label, tone] = issuerTile(issuer);
  return <span className={'mc-tile' + (size ? ' ' + size : '')} data-tone={tone} data-len={Math.min(label.length, 4)} aria-hidden="true">{label}</span>;
}

const cached = images as Record<string, string | null>;
export function cardImage(card: Pick<Card, 'id' | 'imageUrl'>) {
  return Object.hasOwn(cached, card.id) ? cached[card.id] : card.imageUrl;
}

/** 카드 실물 이미지. 없거나 깨지면 카드사 타일 */
export function CardArt({card, large}: {card: Pick<Card, 'id' | 'name' | 'imageUrl' | 'issuer'>; large?: boolean}) {
  const [failed, setFailed] = useState(false);
  const src = cardImage(card);
  return <span className={'mc-art' + (large ? ' lg' : '')}>
    {src && !failed
      ? <img src={assetPath(src)} alt={`${card.name} 카드 이미지`} loading={large ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)}/>
      : <span className="mc-art-ph"><IssuerTile issuer={card.issuer} size={large ? 'lg' : undefined}/></span>}
  </span>;
}

export function Chips<T extends string>({items, value, onChange, label, multi, issuers}: {
  items: {value: T; label: string; count?: number; issuer?: string}[]; value: T | T[]; onChange: (v: T) => void; label: string; multi?: boolean;
  /** 카드사 줄: 칩마다 카드사 타일을 붙여 혜택 칩과 한눈에 구분 */
  issuers?: boolean;
}) {
  const on = (v: T) => Array.isArray(value) ? value.includes(v) : value === v;
  return <div className={'mc-chiprow' + (issuers ? ' issuers' : '')}>
    <span className="mc-chiprow-label" aria-hidden="true">{label}</span>
    <div className="mc-chips" role="group" aria-label={label} data-multi={multi ? '' : undefined}>
      {items.map(it => <button key={it.value} type="button" aria-pressed={on(it.value)} onClick={() => onChange(it.value)}>
        {issuers && it.issuer && <IssuerTile issuer={it.issuer} size="xs"/>}
        {it.label}{it.count !== undefined && <span>{it.count.toLocaleString('ko-KR')}</span>}
      </button>)}
    </div>
  </div>;
}

export function Tabs<T extends string>({items, value, onChange, label}: {items: {value: T; label: string; count?: number}[]; value: T; onChange: (v: T) => void; label: string}) {
  return <div className="mc-tabs" role="tablist" aria-label={label}>
    {items.map(it => <button key={it.value} type="button" role="tab" aria-selected={value === it.value} onClick={() => onChange(it.value)}>
      {it.label}{it.count !== undefined && <span>{it.count.toLocaleString('ko-KR')}</span>}
    </button>)}
  </div>;
}

export function SearchBox({value, onChange, placeholder}: {value: string; onChange: (v: string) => void; placeholder: string}) {
  return <label className="mc-search">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} autoComplete="off"/>
    {value && <button type="button" aria-label="검색어 지우기" onClick={() => onChange('')}>×</button>}
  </label>;
}

export function Empty({title, action}: {title: string; action?: {label: string; onClick: () => void}}) {
  return <div className="mc-empty"><p>{title}</p>{action && <button type="button" className="mc-btn" onClick={action.onClick}>{action.label}</button>}</div>;
}
