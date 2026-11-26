import {useEffect, useRef, useState, type MouseEvent} from 'react';
import {BadgePercent, CreditCard, Ticket, Wallet} from 'lucide-react';
import {sitePath} from '@/lib/site-path';

// Mr. Stocks와 같은 틀: 위는 한 줄 헤더(로고 · 메뉴), 휴대폰은 하단 탭바
export const SECTIONS = [
  {id: 'cards', label: '카드상품 검색', Icon: CreditCard},
  {id: 'cashback', label: '발급이벤트', Icon: BadgePercent},
  {id: 'events', label: '카드사 이벤트', Icon: Ticket},
  {id: 'mine', label: '내 혜택', Icon: Wallet},
] as const;

type NavProps = {current?: string; onNav?: (id: string) => void};

function useNav({current, onNav}: NavProps) {
  return SECTIONS.map(section => ({
    ...section,
    href: sitePath() + '#' + section.id,
    active: current === section.id,
    // 목록 화면에서는 페이지를 새로 열지 않고 탭만 바꾸고 맨 위로
    onClick: onNav
      ? (event: MouseEvent<HTMLAnchorElement>) => {
          event.preventDefault();
          onNav(section.id);
          window.scrollTo({top: 0});
        }
      : undefined,
  }));
}

// Mr. 사이트 전환 (Stocks·Hotels·Travel·Pay는 assets/js/main.js에서 같은 메뉴를 만듦)
const SITES = [
  {id: 'stocks', name: 'Stocks', desc: '줍줍 차트 · 관심종목 · 배당', href: () => sitePath('../ungjup.html')},
  {id: 'cards', name: 'Cards', desc: '카드상품 · 이벤트 · 내 혜택', href: () => sitePath()},
  {id: 'hotels', name: 'Hotels', desc: '호텔 지도 · 등급표 · 이벤트 · 발레파킹', href: () => sitePath('../hotels/')},
  {id: 'travel', name: 'Travel', desc: '해외여행 혜택 · 여행지 · 여행준비', href: () => sitePath('../travel/')},
  {id: 'pay', name: 'Pay', desc: '온누리 · 토스페이 · 네이버페이 가맹점', href: () => sitePath('../pay/')},
] as const;

function SiteSwitch() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return <div className="site-switch" ref={box}>
    <a className="mc-logo" href={sitePath()} aria-label="Mr. Cards 홈">Mr. <span>Cards</span></a>
    <button type="button" className="site-switch-btn" aria-label="다른 사이트로 이동" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    {open && <div className="site-switch-menu">
      {SITES.map(site => <a key={site.id} href={site.href()} aria-current={site.id === 'cards' ? 'true' : undefined}>
        <b>Mr. <span>{site.name}</span></b><small>{site.desc}</small>
      </a>)}
    </div>}
  </div>;
}

// 다크/라이트 전환: Mr. Stocks와 같은 저장값(localStorage "theme")을 같이 씀
function ThemeButton() {
  const isDark = () => {
    const theme = document.documentElement.dataset.theme;
    return theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  };
  const [dark, setDark] = useState(isDark);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setDark(isDark());
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  const toggle = () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* 저장 못 해도 이번 화면에는 적용 */ }
    setDark(next === 'dark');
  };
  return <button type="button" className="theme-btn" onClick={toggle} aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'} title="다크/라이트 모드">
    <svg className="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
    <svg className="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
  </button>;
}

export function SiteHeader(props: NavProps = {}) {
  const items = useNav(props);
  return <>
    <header className="mc-header">
      <div className="mc-container">
        <SiteSwitch />
        <div className="mc-head-right">
          <nav className="mc-nav" aria-label="주요 메뉴">
            <ul>
              {items.map(item => <li key={item.id}>
                <a href={item.href} aria-current={item.active ? 'page' : undefined} onClick={item.onClick}>{item.label}</a>
              </li>)}
            </ul>
          </nav>
          <ThemeButton />
        </div>
      </div>
    </header>
    <nav className="mc-tabbar" aria-label="주요 메뉴">
      {items.map(({id, label, Icon, href, active, onClick}) =>
        <a key={id} href={href} aria-current={active ? 'page' : undefined} onClick={onClick}>
          <Icon aria-hidden="true" /><span>{label}</span>
        </a>)}
    </nav>
  </>;
}

// 'DB 작업' 진행률 — 빌드 때 data/collect-queue.json에서 줄여 넣은 값(vite.config.ts · scripts/db-progress.mjs)
type DbRow = {label: string; done: number; total: number; unit: string};
declare const __DB_PROGRESS__: {asOf: string; rows: DbRow[]} | null;

const share = (done: number, total: number) => total ? done / total * 100 : 0;
const shareText = (p: number) => `${p < 10 ? p.toFixed(1) : Math.round(p)}%`;

function Meter({value, label}: {value: number; label: string}) {
  return <span className="mc-dbp-bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 10) / 10}>
    {value > 0 && <i style={{width: `${Math.min(value, 100)}%`}} />}
  </span>;
}

function DbProgress() {
  const data = __DB_PROGRESS__;
  if (!data?.rows.length) return null;
  const all = share(data.rows.reduce((n, r) => n + r.done, 0), data.rows.reduce((n, r) => n + r.total, 0));
  const [, month, day] = data.asOf.split('-').map(Number);
  return <section className="mc-dbp" aria-label="DB 작업 진행률">
    <span className="mc-dbp-head"><span>DB 작업</span><b>{shareText(all)}</b><small>{month}/{day} 기준</small></span>
    <Meter value={all} label="DB 작업 전체" />
    <ul>
      {data.rows.map(row => {
        const p = share(row.done, row.total);
        return <li key={row.label}>
          <span>{row.label}</span>
          <Meter value={p} label={row.label} />
          <span className="mc-dbp-n">{row.done.toLocaleString('ko-KR')}/{row.total.toLocaleString('ko-KR')}{row.unit}</span>
          <b>{shareText(p)}</b>
        </li>;
      })}
    </ul>
    <small>이벤트 출처는 최근 7일 안에 모은 곳</small>
  </section>;
}

export function SiteFooter() {
  return <footer className="pm-footer">
    <a href={sitePath()} className="pm-footer-brand">Mr. <span>Cards</span></a>
    <p>카드 상품과 이벤트를 한곳에서.</p>
    <div>
      <span>최종 이용 조건은 카드사 안내를 확인하세요.</span>
      <a href={sitePath('downloads/paymorevent-card-database.xlsx')} download="Mr.Cards-카드DB.xlsx" className="pm-db-link">카드 DB 엑셀</a>
      <a href={sitePath('../ungjup.html')} className="mc-family">Mr. Stocks 바로가기</a>
    </div>
    <DbProgress />
  </footer>;
}
