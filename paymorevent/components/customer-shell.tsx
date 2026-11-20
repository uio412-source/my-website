import type {MouseEvent} from 'react';
import {BadgePercent, CreditCard, Ticket} from 'lucide-react';
import {sitePath} from '@/lib/site-path';

// Mr. Stocks와 같은 틀: 위는 한 줄 헤더(로고 · 메뉴), 휴대폰은 하단 탭바
export const SECTIONS = [
  {id: 'cards', label: '카드상품 검색', Icon: CreditCard},
  {id: 'cashback', label: '발급이벤트', Icon: BadgePercent},
  {id: 'events', label: '카드사 이벤트', Icon: Ticket},
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

export function SiteHeader(props: NavProps = {}) {
  const items = useNav(props);
  return <>
    <header className="mc-header">
      <div className="mc-container">
        <a className="mc-logo" href={sitePath()} aria-label="Mr. Cards 홈">Mr. <span>Cards</span></a>
        <nav className="mc-nav" aria-label="주요 메뉴">
          <ul>
            {items.map(item => <li key={item.id}>
              <a href={item.href} aria-current={item.active ? 'page' : undefined} onClick={item.onClick}>{item.label}</a>
            </li>)}
          </ul>
        </nav>
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

export function SiteFooter() {
  return <footer className="pm-footer">
    <a href={sitePath()} className="pm-footer-brand">Mr. <span>Cards</span></a>
    <p>카드 상품과 이벤트를 한곳에서.</p>
    <div>
      <span>최종 이용 조건은 카드사 안내를 확인하세요.</span>
      <a href={sitePath('downloads/paymorevent-card-database.xlsx')} download="Mr.Cards-카드DB.xlsx" className="pm-db-link">카드 DB 엑셀</a>
      <a href={sitePath('../ungjup.html')} className="mc-family">Mr. Stocks 바로가기</a>
    </div>
  </footer>;
}
