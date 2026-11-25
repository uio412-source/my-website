// Mr. Hotels — 호텔 지도(index.html, 오른쪽 위 '등급표' 팝업) · 이벤트(events.html)
// 프로그램(Accor·IHG…)과 등급 선택은 이 브라우저에 저장해 화면들이 같이 씁니다. list.html은 index.html로 넘어갑니다.
(() => {
  const page = document.body.dataset.page;
  const STORE_P = 'mrhotels.program';
  const STORE_T = 'mrhotels.tier.';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (id) => document.getElementById('hx-' + id);

  // ---------- 프로그램·등급 (등급 순서는 호텔 화면의 혜택 계산과 같음) ----------
  // perks: 조식 · 라운지 · 업그레이드 · 체크아웃 · 기타. 값이 없으면 해당 등급에 그 혜택이 없음.
  const P = {
    accor: {
      name: 'Accor', abbr: 'ALL', tone: 4,
      terms: 'https://all.accor.com/a/en/loyalty-program/legal/terms-and-conditions-limitless.html',
      tierNote: '연간(1–12월) 스테이터스 박수 또는 스테이터스 포인트(SP) 중 먼저 채운 기준으로 달성합니다. 다이아몬드는 SP로만 달성합니다. 조식·라운지는 참여 호텔 기준이며 업그레이드와 얼리·레이트는 가능 시 적용됩니다.',
      defaultTier: 3,
      cards: [
        { name: 'ALL 우리카드 Infinite', issuer: '우리카드', fee: '연회비 50만원', grant: '골드 자동 부여',
          perks: ['14,000 ALL 포인트 기프트(연 1회)', '아코르 플러스 트래블러 멤버십 자동 가입(숙박·식음 할인)', '전년 2천만원 이상 이용 시 5,000P 보너스', '3천원당 국내 1.3P · 아코르 호텔 5P · 해외 3P'] },
        { name: 'ALL 우리카드 Premium', issuer: '우리카드', fee: '연회비 15만원', grant: '실버 부여',
          perks: ['4,000 ALL 포인트 기프트(연 1회)', '이용 조건 충족 시 2,000P 보너스', '3천원당 국내 1P · 아코르 호텔 3P · 해외 등 2P'] },
      ],
      tiers: [
        { n: '클래식', a: 'C', req: '가입 시' },
        { n: '실버', a: 'S', req: '10박 또는 2,000 SP', card: 'ALL 우리카드 Premium 발급', bonus: 24, perks: { out: '레이트(가능 시)' } },
        { n: '골드', a: 'G', req: '30박 또는 7,000 SP', card: 'ALL 우리카드 Infinite 발급', bonus: 48, perks: { up: '가능 시', out: '얼리 또는 레이트' } },
        { n: '플래티넘', a: 'P', req: '60박 또는 14,000 SP', bonus: 76, perks: { bf: '참여 호텔', lounge: '참여 호텔', up: '가능 시', out: '얼리·레이트' } },
        { n: '다이아몬드', a: 'D', req: '26,000 SP (SP로만 달성)', bonus: 76, perks: { bf: '참여 호텔 · 주말 조식', lounge: '페어몬트 골드 포함', up: '가능 시', out: '얼리·레이트', etc: '골드 등급 선물' } },
      ],
    },
    ihg: {
      name: 'IHG', abbr: 'IHG', tone: 3,
      terms: 'https://www.ihg.com/content/kr/ko/customer-care/member-tc/2nd-page',
      tierNote: '연간 적격 숙박일수 또는 적격 포인트로 달성합니다. 라운지는 등급 혜택이 아니라 40박 마일스톤 리워드에서 고르는 연간 라운지 멤버십입니다.',
      defaultTier: 4,
      cards: [],
      cardNote: '국내에서 발급되는 IHG 제휴카드는 없습니다(미국 Chase 카드만 있음).',
      tiers: [
        { n: '클럽', a: 'C', req: '가입 시' },
        { n: '실버', a: 'S', req: '10박', bonus: 20, perks: { out: '레이트(가능 시)' } },
        { n: '골드', a: 'G', req: '20박 또는 40,000 QP', bonus: 40, perks: { out: '레이트(가능 시)' } },
        { n: '플래티넘', a: 'P', req: '40박 또는 60,000 QP', bonus: 60, perks: { up: '가능 시', out: '얼리·레이트' } },
        { n: '다이아몬드', a: 'D', req: '70박 또는 120,000 QP', bonus: 100, perks: { bf: '웰컴 혜택으로 2인 선택', up: '가능 시', out: '얼리·레이트' } },
      ],
    },
    hotelux: {
      name: 'HOTELLUX', abbr: 'HLX', tone: 5, noTier: true,
      terms: 'https://hotelux.com/sub/CITI.html',
    },
    marriott: {
      name: 'Marriott', abbr: 'MB', tone: 2,
      terms: 'https://www.marriott.com/loyalty/terms/default.mi',
      tierNote: '연간 엘리트 숙박일수로 달성하며 앰배서더는 연 US$23,000 적격 지출이 추가로 필요합니다. 조식은 플래티넘 이상 웰컴 혜택에서 고르며 브랜드마다 다릅니다.',
      defaultTier: 3,
      cards: [
        { name: '메리어트 본보이 더 베스트', issuer: '신한카드', fee: '연회비 26.4만원(해외겸용 26.7만원)', grant: '골드 자동 · 연 6천만원 이용 시 플래티넘',
          perks: ['연 10 엘리트 숙박 크레딧', '무료 숙박권 연 1회(1박 35,000P 이하 호텔)', '1천원당 기본 1P · 메리어트 호텔 5P · 해외·항공·카페·택시 3P'] },
      ],
      cardNote: '실버를 주던 메리어트 본보이 더 클래식 신한카드는 2026년 4월 23일 단종됐습니다. 6천만원 기준은 연회비 청구 주기 안의 본인·가족카드 합산 이용액입니다.',
      tiers: [
        { n: '멤버', a: 'M', req: '가입 시' },
        { n: '실버', a: 'S', req: '10박', bonus: 10, perks: { out: '우선 레이트(가능 시)' } },
        { n: '골드', a: 'G', req: '25박', card: '신한 더 베스트 발급 시 자동', bonus: 25, perks: { up: '가능 시', out: '오후 2시(가능 시)' } },
        { n: '플래티넘', a: 'P', req: '50박', card: '신한 더 베스트 연 6천만원 이용', bonus: 50, perks: { bf: '웰컴 혜택 선택', lounge: '참여 호텔', up: '일부 스위트까지', out: '오후 4시' } },
        { n: '티타늄', a: 'T', req: '75박', bonus: 75, perks: { bf: '웰컴 혜택 선택', lounge: '참여 호텔', up: '일부 스위트까지', out: '오후 4시' } },
        { n: '앰배서더', a: 'A', req: '100박 + 연 US$23,000', bonus: 75, perks: { bf: '웰컴 혜택 선택', lounge: '참여 호텔', up: '일부 스위트까지', out: '오후 4시', etc: '앰배서더 전담 서비스' } },
      ],
    },
    hilton: {
      name: 'Hilton', abbr: 'H', tone: 1,
      terms: 'https://www.hilton.com/en/hilton-honors/member-benefits/',
      tierNote: '2026년부터 박수·투숙 횟수·적격 지출(US$) 중 하나로 달성합니다(다이아몬드 리저브는 박수 또는 횟수에 더해 지출 필요). 조식은 브랜드·지역에 따라 식음 크레딧으로 대신 제공됩니다.',
      defaultTier: 3,
      cards: [
        { name: '힐튼 아너스 아멕스 프리미엄', issuer: '롯데카드', fee: '연회비 50만원', grant: '골드 부여 · 연 2,400만원 이용 시 다이아몬드',
          perks: ['연 2,400만원 이상 이용 시 전 세계 힐튼 주말 무료 숙박권 2매', '1,500원당 국내 2P · 면세점·대한항공·아시아나 6P · 해외·힐튼 8P'] },
        { name: '힐튼 아너스 아멕스', issuer: '롯데카드', fee: '연회비 25만원', grant: '실버 부여 · 연 1,200만원 이용 시 골드',
          perks: ['연 1,200만원 이상 이용 시 주말 무료 숙박권 1매', '1,500원당 국내 2P · 면세점·항공·해외·힐튼 4P'] },
      ],
      cardNote: '무료 숙박권과 등급 업그레이드는 연간 이용실적 기준이 같아 한 번에 받습니다. 숙박권은 받은 날부터 12개월, 금·토·일에 씁니다.',
      tiers: [
        { n: '멤버', a: 'M', req: '가입 시' },
        { n: '실버', a: 'S', req: '10박 · 4회 또는 US$2,500', card: '롯데 힐튼 아너스 아멕스 발급', bonus: 20, perks: { out: '레이트(요청 시)' } },
        { n: '골드', a: 'G', req: '25박 · 15회 또는 US$6,000', card: '아멕스 프리미엄 발급 · 아멕스 연 1,200만원', bonus: 80, perks: { bf: '조식 또는 식음 크레딧', up: '이그제큐티브 룸까지', out: '레이트(요청 시)' } },
        { n: '다이아몬드', a: 'D', req: '50박 · 25회 또는 US$11,500', card: '아멕스 프리미엄 연 2,400만원', bonus: 100, perks: { bf: '조식 또는 식음 크레딧', lounge: '이그제큐티브 라운지', up: '1베드 스위트까지', out: '레이트(요청 시)' } },
        { n: '다이아몬드 리저브', a: 'DR', req: '80박 또는 40회 + US$18,000', bonus: 120, perks: { bf: '조식 또는 식음 크레딧', lounge: '라운지 · 프리미엄 클럽', up: '확정 업그레이드 1회', out: '오후 4시 보장' } },
      ],
    },
  };
  const ORDER = ['accor', 'ihg', 'hotelux', 'marriott', 'hilton'];
  const PERKS = [['bf', '조식'], ['lounge', '라운지'], ['up', '업그레이드'], ['out', '체크아웃'], ['etc', '기타']];

  // ---------- 호텔별 혜택 (등급 번호, 호텔 profile) → 조식·라운지·룸 업그레이드 여부와 짧은 메모 ----------
  const flags = {
    accor(t, pr) {
      if (pr === 'excluded') return { note: 'ALL Accor 멤버십 미참여' };
      const lounge = (pr === 'club' && t >= 3) || (pr === 'fairmont' && t >= 4);
      return { bf: t >= 3, lounge, up: t >= 2 && pr !== 'noUpgrade',
        note: pr === 'fairmont' && t === 3 ? '페어몬트 골드 라운지는 다이아몬드부터' :
          pr === 'noUpgrade' && t >= 2 ? '이비스·이비스 스타일은 등급 객실 업그레이드 제외' : '' };
    },
    ihg(t, pr) {
      const incl = pr === 'breakfastIncluded';
      return { bf: incl || t === 4, lounge: false, up: t >= 3,
        note: incl ? '모든 등급 기본 조식 포함' : pr === 'loungeMilestone' ? '라운지는 별도 연간 라운지 멤버십' : t === 4 ? '웰컴 혜택으로 2인 조식 선택' : '' };
    },
    hotelux(t, pr) {
      return { bf: true, lounge: false, up: true,
        note: pr === 'sofitelExample' ? '혜택 요금: 매일 조식 · US$100 크레딧' : '혜택 포함 요금으로 예약 시' };
    },
    marriott(t, pr) {
      if (pr === 'excluded') return { note: '메리어트 본보이 미참여' };
      if (pr === 'apartments') return { note: '이그제큐티브 아파트먼트 별도 혜택 조건' };
      if (t < 3) return { bf: false, lounge: false, up: t >= 2, note: t === 2 ? '오후 2시 레이트 체크아웃(가능 시)' : '' };
      const bf = ['breakfastChoice', 'clubChoice', 'series', 'courtyardClub', 'club'].includes(pr);
      const lounge = ['club', 'clubChoice', 'courtyardClub'].includes(pr);
      const note = {
        breakfastChoice: '웰컴 혜택으로 2인 조식 선택', clubChoice: '웰컴 혜택으로 조식 선택', series: '조식 선택(호텔 직영 레스토랑 운영 시)',
        club: '라운지에서 조식', courtyardClub: '라운지 조식 · 미운영 시 레스토랑', foodCredit: '조식 대신 식음 크레딧 선택',
        courtyard: '조식 대신 식음 크레딧 선택', welcome: '웰컴 혜택: 포인트 또는 어메니티',
      }[pr] || '';
      return { bf, lounge, up: true, note };
    },
    hilton(t, pr) {
      const join = (...a) => a.filter(Boolean).join(' · ');
      const dr = t === 4 ? '오후 4시 체크아웃' : '';
      if (pr === 'slh') return { bf: t >= 2, lounge: false, up: t >= 2, note: t >= 2 ? 'SLH 2인 컨티넨털 조식' : 'SLH 전용 약관' };
      if (pr === 'garden') return { bf: t >= 2, lounge: false, up: false, note: join(t >= 2 && 'MyWay 조식 선택', dr) };
      // 해외: 이그제큐티브 라운지 운영 여부를 공식 목록에서 확인하지 못한 호텔
      if (pr === 'noLounge') return { bf: t >= 2, lounge: false, up: t >= 2, note: join(t >= 3 && '라운지 운영 여부는 호텔 확인', dr) };
      return { bf: t >= 2, lounge: t >= 3, up: t >= 2, note: join(t === 2 && '라운지 층 객실로 업그레이드되면 입장', dr) };
    },
  };

  const listInfo = {
    accor: {
      condition: '적격 예약 기준입니다. 업그레이드와 얼리 체크인·레이트 체크아웃은 객실 상황에 따릅니다. 플래티넘 이상 아시아·태평양 조식은 참여 호텔과 요금 조건을 확인하세요.',
      sources: [
        ['Accor 서울 호텔·성급', 'https://all.accor.com/a/ko/destination/city/hotels-seoul-v5556.html'],
        ['라운지·조식 참여 호텔', 'https://all.accor.com/loyalty-program/user/hotels-lounge/index.en.shtml'],
        ['ALL Accor 제외 호텔', 'https://all.accor.com/a/en/loyalty-program/hotels-exception.html'],
      ],
    },
    ihg: {
      condition: '레이트 체크아웃은 요청 시 최대 오후 2시이며 호텔 상황에 따릅니다. 플래티넘·다이아몬드의 얼리 체크인과 업그레이드도 가용 시 적용됩니다. 연간 라운지 멤버십은 별도 마일스톤 리워드입니다.',
      sources: [
        ['IHG 서울 호텔', 'https://www.ihg.com/seoul-korea-republic-of'],
        ['IHG 엘리트 혜택 안내', 'https://www.ihg.com/content/us/en/customer-care/main/account/elite-upgrade-benefits'],
      ],
    },
    hotelux: {
      condition: '목록은 공개된 HoteLux 요금 자료에서 확인한 서울 호텔입니다. 등급이 아니라 예약 요금에 혜택이 붙습니다. 조식과 크레딧은 혜택이 포함된 요금에 적용되며 금액·대상 업장·취소 조건은 예약 화면에서 확인하세요.',
      sources: [
        ['HoteLux 공식 예약', 'https://hotel.hotelux.com/'],
        ['서울 호텔 요금 목록 및 소피텔 혜택 예시', 'https://www.togot.travel/knowledge/booking-channels/hotelux/calendar?month=2026-11'],
      ],
    },
    marriott: {
      condition: '조식 선택은 해당 브랜드의 웰컴 기프트 기준입니다(리츠칼튼·에디션·불가리는 조식 선택 없음으로 표시). 라운지는 참여 호텔에서 동일 객실의 회원과 동반 1인 기준이며, 해외 호텔은 공식 정보에서 확인된 곳만 라운지로 표시했습니다. 객실 업그레이드는 가용 시 적용되며 레이트 체크아웃은 약관의 브랜드·호텔 예외를 따릅니다.',
      sources: [
        ['Marriott 한국 공식 호텔 목록', 'https://www.marriott.com/en-us/hotel-sitemap/south-korea-hotel-sitemap'],
        ['Marriott 도쿄·오사카·방콕·다낭·싱가포르·괌 호텔', 'https://www.marriott.com/en-us/destinations/japan/tokyo.mi'],
        ['브랜드별 웰컴 기프트 및 라운지 보장', 'https://www.marriott.com/loyalty/member-benefits/guarantee.mi'],
        ['국내 라운지 운영 호텔', 'https://www.marriott.com/ko/offers/packages/lounge.mi'],
      ],
    },
    hilton: {
      condition: '적격 예약 기준입니다. SLH 제휴 호텔은 Hilton 직접 예약 시 SLH 전용 약관을 적용합니다. 조식 형태와 업그레이드는 브랜드 및 호텔 조건을 따릅니다.',
      sources: [
        ['Hilton 서울 호텔', 'https://www.hilton.com/ko/locations/south-korea/seoul/'],
        ['Hilton Honors 약관·MyWay 혜택', 'https://www.hilton.com/en/hilton-honors/terms/'],
        ['SLH 제휴 약관', 'https://www.hilton.com/en/brands/small-luxury-hotels-slh/slh-terms-and-conditions/'],
      ],
    },
  };

  // ---------- 공통 도우미 ----------
  const ids = (list) => list.filter((id) => P[id]);
  const tile = (abbr, tone, extra = '') =>
    `<span class="tile${extra}" data-tone="${tone}" data-len="${Math.min(abbr.length, 4)}" aria-hidden="true">${esc(abbr)}</span>`;

  // 프로그램 탭: 같은 모양의 알약 탭(관심종목 보기 탭과 동일). box를 안 주면 화면의 #hx-programs
  function renderTabs(list, current, counts, onPick, box = $('programs')) {
    box.innerHTML = list.map((id) => {
      const label = P[id] ? P[id].name : id === 'all' ? '전체' : '기타';
      const n = counts && counts[id] != null ? `<span>${counts[id]}</span>` : '';
      return `<button type="button" role="tab" data-id="${id}" aria-selected="${id === current}">${label}${n}</button>`;
    }).join('');
    if (!box.dataset.bound) {
      box.dataset.bound = '1';
      box.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-id]');
        if (!b) return;
        for (const x of box.querySelectorAll('button')) x.setAttribute('aria-selected', String(x === b));
        b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        box._pick(b.dataset.id);
      });
    }
    box._pick = onPick;
  }
  const setHash = (id) => history.replaceState(null, '', location.pathname + '#' + id); // ?t= 도 함께 지움

  const myTier = (id) => {
    const info = P[id];
    if (!info || info.noTier) return 0;
    const n = Number(store.get(STORE_T + id) ?? info.defaultTier);
    return Number.isInteger(n) && n >= 0 && n < info.tiers.length ? n : info.defaultTier;
  };

  // ---------- 등급표 팝업 (호텔 지도 오른쪽 위 '등급표' 버튼) ----------
  // 등급을 누르면 그 프로그램의 '나의 등급'으로 저장하고 지도 색을 바꿈
  function tierDialog(onPick) {
    const dlg = $('tiers');
    const list = ids(ORDER).filter((id) => !P[id].noTier);
    let current = list[0];
    function draw() {
      const info = P[current];
      renderTabs(list, current, null, (id) => { current = id; draw(); }, $('t-programs'));
      $('t-sub').textContent = `${info.name} · 등급별 달성 방법·제휴카드·혜택 · 2026년 기준. 등급을 누르면 나의 등급으로 지도에 반영돼요.`;
      $('glance').innerHTML = PERKS.slice(0, 4).map(([k, label]) => {
        const i = info.tiers.findIndex((t) => t.perks && t.perks[k]);
        return `<div><span>${label}</span><b>${i < 0 ? '없음' : esc(info.tiers[i].n) + '부터'}</b></div>`;
      }).join('');
      const mine = myTier(current);
      $('t-rows').innerHTML = info.tiers.map((t, i) => {
        const perks = t.perks ? PERKS.filter(([k]) => t.perks[k]).map(([k, label]) =>
          `<span class="hx-perk" data-k="${k}"><b>${label}</b>${esc(t.perks[k])}</span>`).join('') :
          '<span class="hx-perk" data-k="base">회원 요금 · 포인트 적립</span>';
        const how = `<span class="hx-how"><span><b>숙박</b>${esc(t.req)}</span>${t.card ? `<span class="via"><b>카드</b>${esc(t.card)}</span>` : ''}</span>`;
        return `<button type="button" class="wl-row hx-tier" data-i="${i}"${i === mine ? ' aria-current="true"' : ''}>
          ${tile(t.a, 't' + Math.min(i, 5))}
          <span class="wl-id"><span class="nm">${esc(t.n)}${i === mine ? '<em class="hx-mine">나의 등급</em>' : ''}</span>${how}</span>
          <span class="hx-bonus${t.bonus ? '' : ' none'}">${t.bonus ? '+' + t.bonus + '%' : '—'}<small>보너스 적립</small></span>
          <span class="hx-perks">${perks}</span>
        </button>`;
      }).join('');
      $('t-foot').innerHTML = `${esc(info.tierNote)} <a href="${info.terms}" target="_blank" rel="noopener">공식 약관 ↗</a>`;
      const cards = info.cards || [];
      $('t-cards').innerHTML = `<div class="wl-sec-head"><h3>${info.name} 제휴카드</h3><span>국내 발급 · 등급 혜택 요약</span></div>` +
        (cards.length ? `<div class="hx-cards">${cards.map((c) => `<article class="hx-card hx-cc">
          <div class="hx-card-top"><span class="hx-brand">${esc(c.issuer)}</span><span class="hx-fee">${esc(c.fee)}</span></div>
          <h3>${esc(c.name)}</h3>
          <p class="hx-benefit">${esc(c.grant)}</p>
          <ul class="hx-list">${c.perks.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        </article>`).join('')}</div>` : '') +
        (info.cardNote ? `<p class="hx-foot">${esc(info.cardNote)}</p>` : '');
    }
    $('t-rows').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      store.set(STORE_T + current, b.dataset.i);
      onPick(current);
      dlg.close();
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
    return {
      open(program) {
        if (list.includes(program)) current = program;
        else if (list.includes(store.get(STORE_P))) current = store.get(STORE_P);
        draw();
        dlg.showModal();
      },
    };
  }

  // ---------- 호텔 지도: 전세계 → 나라 → 도시(구·동네) → 동네(호텔) ----------
  const DOT = [['bf', '조식'], ['lounge', '라운지'], ['up', '룸업글']];
  async function mapPage() {
    const [data, found, A, geo, world, pdata, valet] = await Promise.all([
      MS.getJSON('directory.json'), MS.getJSON('images.json').catch(() => ({})), MS.getJSON('areas.json'),
      MS.getJSON('map.json').catch(() => ({ cities: {} })), MS.getJSON('../travel/world.json'),
      MS.getJSON('../travel/places.json').catch(() => ({ places: [] })),
      MS.getJSON('valet.json').catch(() => null),
    ]);
    const list = ids(ORDER);
    const tabs = ['all', ...list];
    const params = new URLSearchParams(location.search);
    const openKey = params.get('h'); // 발레파킹 화면에서 ?h=프로그램:호텔id 로 넘어오면 그 호텔 카드를 엶
    const h0 = location.hash.slice(1).toLowerCase();
    let current = tabs.includes(h0) ? h0 : tabs.includes(store.get(STORE_P)) ? store.get(STORE_P) : 'all';
    // 예전 주소(list.html?t=3#marriott)로 들어오면 그 등급을 저장
    if (params.has('t') && P[current] && !P[current].noTier) {
      const t = Number(params.get('t'));
      if (Number.isInteger(t) && t >= 0 && t < P[current].tiers.length) store.set(STORE_T + current, String(t));
    }
    const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    // 발레파킹(valet.json) 연결: 호텔 directory 키 → {id, n: 무료 발레 되는 카드 수}
    const valetOf = {};
    for (const vh of (valet && valet.hotels) || []) {
      if (!vh.directory || (vh.closure && vh.closure.from <= day)) continue;
      const names = new Set();
      for (const p of valet.programs) if (p.hotelIds.includes(vh.id) && !(p.validThrough && p.validThrough < day)) for (const c of p.cards) names.add(p.issuer + c.name);
      if (names.size) for (const k of vh.directory) valetOf[k] = { id: vh.id, n: names.size };
    }
    const placeOf = Object.fromEntries((pdata.places || []).map((p) => [p.id, p]));

    // 호텔 항목 펼치기: 같은 호텔이 HOTELLUX와 체인에 함께 있으면(same) '전체'에서는 체인 쪽 하나만
    const entries = [];
    for (const c of data.countries) for (const ct of c.cities) for (const [pg, hs] of Object.entries(ct.programs)) for (const h of hs) {
      entries.push({ pg, h, country: c.name, city: ct.name, area: A.alias[h.district] || h.district, key: pg + ':' + h.id });
    }
    const byKey = Object.fromEntries(entries.map((e) => [e.key, e]));
    const alsoVia = {};
    for (const e of entries) if (e.h.same && byKey[e.h.same]) (alsoVia[e.h.same] ||= []).push(e);
    const imageOf = (e, depth = 0) => e.h.image || found[e.key] ||
      (e.h.same && depth < 2 && byKey[e.h.same] ? imageOf(byKey[e.h.same], depth + 1) : '') ||
      (alsoVia[e.key] || []).map((x) => x.h.image || found[x.key]).find(Boolean) || '';
    const flagOf = (e) => (e.h.closedFrom && e.h.closedFrom <= day ? { note: e.h.closureNote, closed: true } : flags[e.pg](myTier(e.pg), e.h.profile));
    const score = (f) => (f.bf ? 1 : 0) + (f.lounge ? 1 : 0) + (f.up ? 1 : 0);
    // 휴업 호텔(directory.json closedFrom)은 기본 목록·지도·숫자에서 빼고 '휴업' 칩을 켰을 때만 보여 줌
    let showClosed = false;
    const isClosedH = (e) => !!(e.h.closedFrom && e.h.closedFrom <= day);
    const inProgram = (e) => (current === 'all' ? !(e.h.same && byKey[e.h.same]) : e.pg === current);
    const shownAll = () => entries.filter((e) => inProgram(e) && (showClosed || !isClosedH(e)));

    // ----- 투영 (travel.js와 같은 Natural Earth, 태평양 중심) -----
    const project = (lon, lat) => {
      let l = lon - world.l0;
      l = (((l + 180) % 360) + 360) % 360 - 180;
      const lam = (l * Math.PI) / 180, phi = (lat * Math.PI) / 180, p2 = phi * phi, p4 = p2 * p2;
      const x = lam * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)));
      const y = phi * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
      return [world.tx + world.k * x, world.ty - world.k * y];
    };
    const pt = (ll) => project(ll[1], ll[0]);
    const cityBox = (name) => {
      const [w, s, e, n] = A.cities[name].box;
      const [x0, y1] = project(w, s), [x1, y0] = project(e, n);
      return [x0, y0, x1, y1];
    };
    const union = (bs) => [Math.min(...bs.map((b) => b[0])), Math.min(...bs.map((b) => b[1])), Math.max(...bs.map((b) => b[2])), Math.max(...bs.map((b) => b[3]))];
    const countryOf = (name) => data.countries.find((c) => c.name === name);
    const areaPt = (e) => (A.hotels[e.key] ? pt(A.hotels[e.key]) : pt(A.cities[e.city].areas[e.area]));

    // ----- 상태 -----
    const S = { country: null, city: null, areas: null };
    let custom = null; // 같은 단계 안에서 겹친 거품을 눌러 더 확대한 범위
    const level = () => (S.areas ? 3 : S.city ? 2 : S.country ? 1 : 0);
    (() => { // 주소 ?at=나라/도시/동네
      const at = (params.get('at') || '').split('/').filter(Boolean);
      if (at[0] && countryOf(at[0])) {
        S.country = at[0];
        const cs = countryOf(at[0]).cities;
        if (at[1] && cs.some((c) => c.name === at[1])) S.city = at[1];
        else if (cs.length === 1) S.city = cs[0].name;
        if (S.city && at[2]) {
          const as = at.slice(2).filter((a) => A.cities[S.city].areas[a]);
          if (as.length) S.areas = as;
        }
      }
    })();
    const areaName = (as) => (as.length <= 2 ? as.join('·') : `${as.slice(0, 2).join('·')} 외 ${as.length - 2}`);
    const inScope = (e) => (!S.country || e.country === S.country) && (!S.city || e.city === S.city) && (!S.areas || S.areas.includes(e.area));
    function saveUrl() {
      const url = new URL(location.href);
      url.searchParams.delete('t');
      url.searchParams.delete('h');
      const at = [S.country, S.city, ...(S.areas || [])].filter(Boolean);
      url.searchParams.delete('at');
      let q = url.searchParams.toString();
      if (at.length) q = (q ? q + '&' : '') + 'at=' + at.map(encodeURIComponent).join('/'); // 주소에 '/'가 그대로 보이게
      history.replaceState(null, '', url.pathname + (q ? '?' + q : '') + '#' + current);
      store.set(STORE_P, current);
    }

    // ----- 지도 바탕 -----
    const box = $('map'), svg = $('svg'), marks = $('marks');
    // 세계: 해안선·국경 선(world.json) / 나라·도시: 10m 땅을 칠하고 바다는 바탕색(map.json)
    const countryLayers = Object.entries(geo.countries || {}).map(([name, c]) => `<g class="hm-cn" data-country="${esc(name)}"><path class="hm-landfill" d="${c.land}"/></g>`).join('');
    const cityLayers = Object.entries(geo.cities || {}).map(([name, c]) => `<g class="hm-cl" data-city="${esc(name)}">
      ${c.land ? `<path class="hm-landfill" d="${c.land}"/>` : ''}
      ${(c.gu || []).map((g) => `<path class="hm-gu" data-n="${esc(g.n)}" d="${g.d}"/>`).join('')}
      ${c.rivers ? `<path class="hm-river" d="${c.rivers}"/>` : ''}</g>`).join('');
    svg.innerHTML = `<path class="hm-borders hm-world" d="${world.borders}"/><path class="hm-land hm-world" d="${world.land}"/>${countryLayers}${cityLayers}`;

    let vb = [0, 0, world.w, world.h];
    const size = () => [Math.max(1, box.clientWidth), Math.max(1, box.clientHeight)];
    const toPx = (x, y) => { const [W, H] = size(); return [(x - vb[0]) * W / vb[2], (y - vb[1]) * H / vb[3]]; };
    // 범위 [x0,y0,x1,y1]를 지도 상자 비율에 맞춰 여백과 함께
    const fit = (b, pad = 0.12, minW = 0) => {
      const [W, H] = size(), ar = W / H;
      let w = Math.max(b[2] - b[0], minW), h = b[3] - b[1];
      w *= 1 + pad * 2; h *= 1 + pad * 2;
      if (w / h < ar) w = h * ar; else h = w / ar;
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      return [cx - w / 2, cy - h / 2, w, h];
    };
    const AREA_W = (city) => { const b = cityBox(city); return (b[2] - b[0]) * 0.3; };
    function target() {
      if (custom) return custom;
      const shown = shownAll();
      if (S.areas) {
        const ps = shown.filter(inScope).map(areaPt);
        const c = ps.length ? [ps.reduce((a, p) => a + p[0], 0) / ps.length, ps.reduce((a, p) => a + p[1], 0) / ps.length] : pt(A.cities[S.city].areas[S.areas[0]]);
        const w = AREA_W(S.city);
        return fit([c[0] - w / 2, c[1] - w / 4, c[0] + w / 2, c[1] + w / 4], 0);
      }
      if (S.city) return fit(cityBox(S.city), 0.04);
      if (S.country) return fit(union(countryOf(S.country).cities.map((c) => cityBox(c.name))), 0.25, 6);
      const ps = data.countries.map((c) => pt(A.countries[c.name].ll));
      return fit([Math.min(...ps.map((p) => p[0])), Math.min(...ps.map((p) => p[1])), Math.max(...ps.map((p) => p[0])), Math.max(...ps.map((p) => p[1]))], 0.2);
    }

    // ----- 표시: 거품(나라·도시·동네)과 호텔 핀 -----
    const MAXR = { 0: 26, 1: 28, 2: 24 };
    // 좁은 화면에선 거품을 조금 작게
    const radius = (n, lv) => Math.min(MAXR[lv], 12 + 2.8 * Math.sqrt(n)) * Math.max(0.64, Math.min(1, size()[0] / 700));
    let marksData = [];
    function bubbles(view) {
      const shown = shownAll().filter(inScope);
      const lv = level();
      const [W, H] = size();
      const px = (p) => [(p[0] - view[0]) * W / view[2], (p[1] - view[1]) * H / view[3]];
      let items = [];
      if (lv === 0) {
        for (const c of data.countries) {
          const n = shown.filter((e) => e.country === c.name).length;
          if (n) items.push({ kind: 'country', id: c.name, label: c.name, n, p: pt(A.countries[c.name].ll) });
        }
      } else if (lv === 1) {
        for (const ct of countryOf(S.country).cities) {
          const n = shown.filter((e) => e.city === ct.name).length;
          const b = cityBox(ct.name);
          if (n) items.push({ kind: 'city', id: ct.name, label: ct.name, n, p: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] });
        }
      } else {
        const city = A.cities[S.city];
        const cnt = {};
        for (const e of shownAll().filter((e) => e.city === S.city)) cnt[e.area] = (cnt[e.area] || 0) + 1;
        for (const [a, n] of Object.entries(cnt)) {
          if (lv === 3 && S.areas.includes(a)) continue; // 고른 동네는 호텔 핀으로
          items.push({ kind: 'area', id: a, label: a, n, p: pt(city.areas[a]), dim: lv === 3 });
        }
      }
      // 화면에서 겹치는 거품은 하나로 합침(호텔 많은 쪽 이름). 거품 아래 이름표 자리까지 겹침으로 봄
      const textW = (t) => Array.from(t).reduce((w, ch) => w + (/[가-힣]/.test(ch) ? 11.5 : 7), 10);
      const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
      const nameOf = (ms) => {
        const ls = ms.map((x) => x.label);
        if (ls.length === 1) return ls[0];
        if (ls.length === 2 && (ls[0] + ls[1]).length <= 8) return ls.join('·');
        return `${ls[0]} 외 ${ls.length - 1}`;
      };
      const join = (o, it) => {
        const t = o.n + it.n;
        o.p = [(o.p[0] * o.n + it.p[0] * it.n) / t, (o.p[1] * o.n + it.p[1] * it.n) / t];
        o.n = t;
        o.members.push(...it.members);
        o.members.sort((x, y) => y.n - x.n);
        o.s = px(o.p);
        o.r = radius(t, Math.min(lv, 2)) * (o.dim ? 0.75 : 1);
        o.label = nameOf(o.members);
      };
      items.sort((a, b) => b.n - a.n);
      const out = items.map((it) => {
        const o = { ...it, s: px(it.p), r: radius(it.n, Math.min(lv, 2)) * (it.dim ? 0.75 : 1) };
        o.members = [{ ...o }];
        return o;
      });
      // 거품끼리 겹치면 합침(합쳐서 커진 거품이 또 겹치면 다시)
      const near = (a, b) => Math.hypot(a.s[0] - b.s[0], a.s[1] - b.s[1]) < a.r + b.r + 4;
      for (let again = true; again;) {
        again = false;
        search: for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
          if (near(out[i], out[j])) { join(out[i], out[j]); out.splice(j, 1); again = true; break search; }
        }
      }
      // 이름표는 호텔 많은 거품부터 아래·위·오른쪽·왼쪽 중 빈 자리에 붙이고, 자리가 없으면 숨김(이름은 아래 칩에)
      const [MW, MH] = size();
      const placed = out.map((o) => [o.s[0] - o.r, o.s[1] - o.r, o.s[0] + o.r, o.s[1] + o.r]);
      for (const o of out.slice().sort((a, b) => b.n - a.n)) {
        const w = textW(o.label), [x, y] = o.s, r = o.r;
        const spots = [['b', [x - w / 2, y + r + 1, x + w / 2, y + r + 18]], ['t', [x - w / 2, y - r - 18, x + w / 2, y - r - 1]],
          ['r', [x + r + 2, y - 9, x + r + 2 + w, y + 9]], ['l', [x - r - 2 - w, y - 9, x - r - 2, y + 9]]];
        const ok = spots.find(([, b]) => b[0] >= 0 && b[2] <= MW && b[1] >= 0 && b[3] <= MH && !placed.some((q) => q !== null && overlap(q, b) && !(q[0] === x - r && q[1] === y - r)));
        o.lp = ok ? ok[0] : null;
        if (ok) placed.push(ok[1]);
      }
      return out;
    }
    function hotelPins(view) {
      if (!S.areas) return [];
      const [W, H] = size();
      const ups = view[2] / W; // 1px = 지도 단위
      const hs = shownAll().filter(inScope).map((e) => ({ e, f: flagOf(e) }))
        .sort((a, b) => score(b.f) - score(a.f) || (b.e.h.stars || 0) - (a.e.h.stars || 0) || a.e.h.name.localeCompare(b.e.h.name, 'ko'));
      const exact = hs.filter((x) => A.hotels[x.e.key]);
      const ring = hs.filter((x) => !A.hotels[x.e.key]);
      const c = ring.length ? ring.reduce((a, x) => { const p = pt(A.cities[x.e.city].areas[x.e.area]); return [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length]; }, [0, 0]) : null;
      const pins = exact.map((x) => ({ kind: 'hotel', ...x, p: pt(A.hotels[x.e.key]) }));
      // 위치가 동네 단위라 동네 지점 둘레에 고리로 놓음(가운데부터 8·14·20개씩)
      let i = 0, ringNo = 0;
      const caps = [1, 8, 14, 20, 26];
      while (i < ring.length) {
        const cap = ring.length === 1 ? 1 : caps[Math.min(ringNo + 1, caps.length - 1)];
        const take = ring.slice(i, i + cap);
        const R = ring.length === 1 ? 0 : (32 + ringNo * 26) * ups;
        take.forEach((x, k) => {
          const a = -Math.PI / 2 + (2 * Math.PI * k) / take.length + ringNo * 0.35;
          pins.push({ kind: 'hotel', ...x, p: [c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)] });
        });
        i += cap;
        ringNo++;
      }
      return { pins, center: c, R: ring.length > 1 ? (32 + (ringNo - 1) * 26 + 17) : 20 };
    }
    let ringInfo = null;
    function buildMarks(view) {
      const hp = hotelPins(view);
      ringInfo = hp && hp.center ? hp : null;
      let bs = bubbles(view);
      if (ringInfo) { // 고리와 겹치는 흐린 동네 거품은 숨김
        const [W, H] = size();
        const c = [(ringInfo.center[0] - view[0]) * W / view[2], (ringInfo.center[1] - view[1]) * H / view[3]];
        bs = bs.filter((b) => Math.hypot(b.s[0] - c[0], b.s[1] - c[1]) > ringInfo.R + b.r + 16);
      }
      marksData = [...bs, ...(hp.pins || [])];
      const area = S.areas ? areaName(S.areas) : '';
      marks.innerHTML = (ringInfo ? `<div class="hm-ring" aria-hidden="true"><span>${esc(area)} 일대</span></div>` : '') + marksData.map((m, i) => {
        if (m.kind === 'hotel') {
          const f = m.f;
          const cls = f.closed ? 'off' : f.bf || f.lounge ? 'full' : f.up ? 'up' : 'off';
          return `<button type="button" class="hm-pin ${cls}" data-i="${i}" aria-label="${esc(m.e.h.name)} · ${m.e.h.stars || ''}성 · ${DOT.filter(([k]) => f[k]).map(([, l]) => l).join('·') || '혜택 없음'}" title="${esc(m.e.h.name)}"><i>${m.e.h.stars || ''}</i></button>`;
        }
        return `<button type="button" class="hm-bub k-${m.kind}${m.dim ? ' dim' : ''}${m.lp ? ' lp-' + m.lp : ' nolab'}" data-i="${i}" style="--r:${m.r.toFixed(1)}px" aria-label="${esc(m.label)} 호텔 ${m.n}곳"><b>${m.n}</b><span>${esc(m.label)}</span></button>`;
      }).join('');
      placeMarks();
    }
    function placeMarks() {
      const els = marks.children;
      let k = 0;
      if (ringInfo) {
        const [x, y] = toPx(...ringInfo.center);
        const ring = els[0];
        ring.style.left = x + 'px'; ring.style.top = y + 'px';
        ring.style.width = ring.style.height = ringInfo.R * 2 + 'px';
        k = 1;
      }
      for (let i = 0; i < marksData.length; i++, k++) {
        const [x, y] = toPx(...marksData[i].p);
        els[k].style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      }
    }
    const setVB = (v) => { vb = v; svg.setAttribute('viewBox', v.map((n) => n.toFixed(5)).join(' ')); placeMarks(); };
    let anim;
    function zoom(instant) {
      const to = target();
      svg.dataset.level = String(level());
      buildMarks(to);
      cancelAnimationFrame(anim);
      if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) { setVB(to); return; }
      const from = vb.slice(), t0 = performance.now(), D = 520;
      // 확대 비율이 크면 로그 보간으로 부드럽게
      const lw0 = Math.log(from[2]), lw1 = Math.log(to[2]);
      const step = (now) => {
        const k = Math.min(1, (now - t0) / D), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const w = Math.exp(lw0 + (lw1 - lw0) * e), h = w * to[3] / to[2];
        const cx = from[0] + from[2] / 2 + ((to[0] + to[2] / 2) - (from[0] + from[2] / 2)) * e;
        const cy = from[1] + from[3] / 2 + ((to[1] + to[3] / 2) - (from[1] + from[3] / 2)) * e;
        setVB([cx - w / 2, cy - h / 2, w, h]);
        if (k < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    }

    // ----- 위쪽: 빵부스러기·탭·등급 -----
    const tierSel = $('tier');
    function crumbs() {
      const parts = [['전세계', () => go({})]];
      if (S.country) {
        const multi = countryOf(S.country).cities.length > 1;
        const one = !multi && S.city && S.city !== S.country ? `${S.country} ${S.city}` : S.country;
        parts.push([one, multi ? () => go({ country: S.country }) : () => go({ country: S.country, city: S.city })]);
        if (S.city && multi) parts.push([S.city, () => go({ country: S.country, city: S.city })]);
        if (S.areas) parts.push([areaName(S.areas), null]);
      }
      crumbFns = parts.map((p) => p[1]);
      $('crumbs').innerHTML = parts.map(([t], i) => (i === parts.length - 1
        ? `<b aria-current="location">${esc(t)}</b>` : `<button type="button" data-c="${i}">${esc(t)}</button><span aria-hidden="true">›</span>`)).join('');
      $('up').hidden = !level() && !custom;
    }
    let crumbFns = [];
    function go(next) {
      S.country = next.country || null;
      S.city = next.city || null;
      S.areas = next.areas || null;
      if (S.country && !S.city && countryOf(S.country).cities.length === 1) S.city = countryOf(S.country).cities[0].name;
      custom = null;
      saveUrl();
      draw();
      zoom();
    }
    function up() {
      if (custom) { custom = null; zoom(); crumbs(); return; }
      if (S.areas) return go({ country: S.country, city: S.city });
      if (S.city && countryOf(S.country).cities.length > 1) return go({ country: S.country });
      go({});
    }
    function tabsAndTier() {
      const inPlace = entries.filter((e) => (!S.country || e.country === S.country) && (!S.city || e.city === S.city));
      const counts = { all: inPlace.filter((e) => !(e.h.same && byKey[e.h.same])).length };
      for (const id of list) counts[id] = inPlace.filter((e) => e.pg === id).length;
      renderTabs(tabs, current, counts, (id) => { current = id; saveUrl(); draw(); zoom(true); });
      const info = P[current];
      $('tier-field').hidden = !info || !!info.noTier;
      if (info && !info.noTier) tierSel.replaceChildren(...info.tiers.map((t, i) => new Option(t.n, String(i), false, i === myTier(current))));
      const tp = P[current] && !P[current].noTier ? current : null;
      $('mytier').textContent = tp ? P[tp].tiers[myTier(tp)].n : '';
    }

    // ----- 아래: 바로가기 칩 · 목록 -----
    function chips() {
      const shown = shownAll();
      let items = [];
      if (!S.country) items = data.countries.map((c) => [c.name, shown.filter((e) => e.country === c.name).length, () => go({ country: c.name })]);
      else if (!S.city) items = countryOf(S.country).cities.map((c) => [c.name, shown.filter((e) => e.city === c.name).length, () => go({ country: S.country, city: c.name })]);
      else {
        const cnt = {};
        for (const e of shown.filter((e) => e.city === S.city)) cnt[e.area] = (cnt[e.area] || 0) + 1;
        items = Object.entries(cnt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
          .map(([a, n]) => [a, n, () => go({ country: S.country, city: S.city, areas: S.areas && S.areas.length === 1 && S.areas[0] === a ? null : [a] }), S.areas && S.areas.includes(a)]);
      }
      const closedN = entries.filter((e) => inProgram(e) && isClosedH(e)
        && (!S.country || e.country === S.country) && (!S.city || e.city === S.city)).length;
      if (closedN) items.push(['휴업', closedN, () => { showClosed = !showClosed; draw(); }, showClosed]);
      items = items.filter((x) => x[1] > 0);
      chipFns = items.map((x) => x[2]);
      $('chips').innerHTML = items.map(([t, n, , on], i) => `<button type="button" role="listitem" class="hm-chip" data-k="${i}" aria-pressed="${!!on}">${esc(t)}<span>${n}</span></button>`).join('');
    }
    let chipFns = [];
    const cityLabel = (e) => (e.country === '한국' ? `${e.city} ${e.area}` : `${e.city} · ${e.area}`);
    function rowsHtml(rows) {
      const head = `<div class="hx-h hx-head" aria-hidden="true"><span></span><span>호텔명</span><span>성급</span><span>위치</span>${DOT.map(([, l]) => `<span>${l}</span>`).join('')}</div>`;
      return `<div class="wl-rows hx-table">${head}${rows.map(({ e, f }) => {
        const img = imageOf(e);
        const star = e.h.stars ? e.h.stars + '성' : '—';
        const prog = current === 'all' ? `<em class="hm-prog" data-p="${e.pg}">${esc(P[e.pg].name)}</em>` : '';
        return `<button type="button" class="hx-h${f.bf || f.lounge || f.up ? '' : ' off'}" data-key="${esc(e.key)}">
          <span class="hx-img">${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}<span class="hx-ph" aria-hidden="true">${esc(star)}</span></span>
          <span class="hx-name"><b>${esc(e.h.name)}</b>${prog || f.note ? `<small>${prog}${esc(f.note || '')}</small>` : ''}</span>
          <span class="hx-star">${esc(star)}</span>
          <span class="hx-loc"><span class="m">${esc(star)} · </span>${esc(cityLabel(e))}</span>
          ${DOT.map(([k, l]) => `<span class="hx-dot" data-k="${k}"${f[k] ? ' data-on' : ''} aria-label="${l} ${f[k] ? '있음' : '없음'}"><i aria-hidden="true"></i><em>${l}</em></span>`).join('')}
        </button>`;
      }).join('')}</div>`;
    }
    function listBox() {
      const shown = shownAll();
      const box = $('list');
      if (!S.city) {
        // 나라·도시 단계: 도시별 요약(눌러서 들어가기)
        const cities = data.countries.filter((c) => !S.country || c.name === S.country).flatMap((c) => c.cities.map((ct) => ({ c: c.name, ct: ct.name })));
        const rows = cities.map(({ c, ct }) => {
          const hs = shown.filter((e) => e.city === ct).map((e) => flagOf(e));
          return { c, ct, n: hs.length, bf: hs.filter((f) => f.bf).length, lounge: hs.filter((f) => f.lounge).length };
        }).filter((r) => r.n);
        box.innerHTML = `<div class="wl-sec-head"><h2>도시별 호텔</h2><span>${current === 'all' ? '모든 체인' : esc(P[current].name)} · 나의 등급 기준</span></div>
          <div class="hm-cities">${rows.map((r) => `<button type="button" class="hm-city" data-city="${esc(r.ct)}" data-country="${esc(r.c)}">
            <b>${esc(r.ct)}</b><small>${esc(r.c)}</small><span class="n">${r.n}곳</span>
            <span class="hm-mini"><i class="hx-pink" aria-hidden="true"></i>조식 ${r.bf} · 라운지 ${r.lounge}</span></button>`).join('')}</div>`;
        return;
      }
      const rows = shown.filter(inScope).map((e) => ({ e, f: flagOf(e) }))
        .sort((a, b) => score(b.f) - score(a.f) || (b.e.h.stars || 0) - (a.e.h.stars || 0) || a.e.h.name.localeCompare(b.e.h.name, 'ko'));
      const n = (k) => rows.filter((r) => r.f[k]).length;
      const where = S.areas ? `${S.city} ${areaName(S.areas)}` : S.city;
      if (!rows.length) {
        const has = list.filter((id) => entries.some((e) => e.pg === id && inScope(e))).map((id) => P[id].name);
        box.innerHTML = `<div class="wl-rows"><p class="wl-empty">${esc(where)}에는 아직 정리한 ${current === 'all' ? '' : esc(P[current].name) + ' '}호텔이 없어요.${has.length ? ` (${esc(has.join(' · '))} 목록은 있어요)` : ''}</p></div>`;
        return;
      }
      box.innerHTML = `<div class="wl-sec-head"><h2>${esc(where)} 호텔 ${rows.length}곳</h2><span>누르면 사진·평균가·등급별 혜택</span></div>
        <p class="hx-sum">${DOT.map(([k, l]) => `<span><i class="hx-pink" aria-hidden="true"></i>${l} <b>${n(k)}</b>곳</span>`).join('')}</p>${rowsHtml(rows)}`;
    }
    function notes() {
      const progs = current === 'all' ? list : [current];
      $('conditions').textContent = progs.map((id) => (current === 'all' ? `${P[id].name}: ` : '') + listInfo[id].condition).join(' ');
      const sources = progs.flatMap((id) => [[P[id].name + ' 등급 약관', P[id].terms], ...listInfo[id].sources]);
      sources.push(['호텔업 등급결정 현황', 'https://www.hotelrating.or.kr/hotel'], ['지도: Natural Earth · 서울 구 경계 통계청', 'https://www.naturalearthdata.com/']);
      $('sources').innerHTML = sources.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('');
      $('checked').textContent = `목록 대조일 ${data.updated.replaceAll('-', '.')} · 해외 성급은 브랜드 등급 기준 추정 · 해외 라운지는 호텔 공식 정보 기준이며 바뀔 수 있습니다 · ` +
        '지도 위 호텔 위치는 구·동네 단위로 표시해요(정확한 좌표가 들어온 호텔만 실제 위치) · 사진은 각 호텔 공식 사이트 이미지입니다.';
    }
    function draw() {
      tabsAndTier();
      crumbs();
      chips();
      listBox();
      notes();
      const shown = shownAll().filter(inScope);
      const where = S.areas ? `${S.city} ${areaName(S.areas)}` : S.city || S.country || '전세계';
      const tierTxt = P[current] && !P[current].noTier ? ` · ${P[current].tiers[myTier(current)].n} 기준` : current === 'hotelux' ? ' · 혜택 포함 요금 기준' : ' · 체인별 나의 등급 기준';
      $('sub').textContent = `${where} · ${current === 'all' ? '모든 체인' : P[current].name} ${shown.length}곳${tierTxt}`;
      $('legend').innerHTML = level() === 3
        ? '<span><i class="lg full"></i>조식·라운지</span><span><i class="lg up"></i>룸업글만</span><span><i class="lg off"></i>혜택 없음</span><em>숫자는 성급 · 위치는 동네 단위</em>'
        : `<em>${level() === 2 ? '숫자는 호텔 수 · 눌러서 동네 호텔 보기' : '숫자는 호텔 수 · 눌러서 들어가기'}</em>`;
      for (const g of svg.querySelectorAll('.hm-cn')) g.classList.toggle('on', g.dataset.country === S.country);
      // 서울은 호텔 있는 구를 칠함
      for (const g of svg.querySelectorAll('.hm-gu')) {
        const n = shownAll().filter((e) => e.city === '서울' && e.area === g.dataset.n).length;
        g.classList.toggle('has', n > 0);
        g.classList.toggle('on', !!(S.areas && S.areas.includes(g.dataset.n)));
      }
      for (const g of svg.querySelectorAll('.hm-cl')) g.classList.toggle('on', g.dataset.city === S.city);
    }

    // ----- 호텔 카드 -----
    const dlg = $('hotel');
    function priceText(e) {
      const pr = e.h.price;
      const at = e.h.priceAt ? ` · ${e.h.priceAt.replaceAll('-', '.')} 기준` : '';
      if (Array.isArray(pr) && pr.length === 2) return `<b>${pr[0]}~${pr[1]}만원</b><small>1박 평균${at}</small>`;
      if (Number.isFinite(pr)) return `<b>약 ${pr}만원</b><small>1박 평균${at}</small>`;
      const pl = placeOf[A.cities[e.city].place];
      return `<b class="muted">수집 전</b>${pl && e.h.stars >= 5 ? `<small>${esc(pl.city)} 5성급 1박 시세 ${pl.hotel[0]}~${pl.hotel[1]}만원</small>` : '<small>공식 페이지에서 날짜별 요금 확인</small>'}`;
    }
    function openCard(key) {
      const e = byKey[key];
      if (!e) return;
      const info = P[e.pg];
      const img = imageOf(e);
      const star = e.h.stars ? `${'★'.repeat(e.h.stars)} ${e.h.stars}성` : '성급 정보 없음';
      const closed = e.h.closedFrom && e.h.closedFrom <= day;
      const mine = myTier(e.pg);
      const tiers = info.noTier ? [{ n: '혜택 포함 요금' }] : info.tiers;
      const rows = tiers.map((t, i) => {
        const f = closed ? {} : flags[e.pg](info.noTier ? 0 : i, e.h.profile);
        const me = !info.noTier && i === mine;
        return `<tr${me ? ' class="mine"' : ''}><th scope="row">${esc(t.n)}${me ? '<em>나</em>' : ''}</th>${DOT.map(([k]) => `<td>${f[k] ? '<i class="on" aria-label="있음"></i>' : '<i aria-label="없음"></i>'}</td>`).join('')}</tr>`;
      }).join('');
      const f = flagOf(e);
      const extra = [
        f.note,
        e.h.loungeUnconfirmed ? '라운지 운영 여부는 호텔에 확인하세요' : '',
        e.h.loungeNote || '',
        e.h.checkout === 'availability' ? '레이트 체크아웃은 객실 상황에 따라' : '',
      ].filter(Boolean);
      const via = (alsoVia[e.key] || []).map((x) => `<a href="${esc(x.h.url)}" target="_blank" rel="noopener">${esc(P[x.pg].name)} 예약</a>`).join(' · ');
      const same = e.h.same && byKey[e.h.same] ? byKey[e.h.same] : null;
      const vk = [e.key, e.h.same, ...(alsoVia[e.key] || []).map((x) => x.key)].find((k) => k && valetOf[k]);
      const vl = vk ? valetOf[vk] : null;
      $('card').innerHTML = `
        <div class="hm-c-img">${img ? `<img src="${esc(img)}" alt="${esc(e.h.name)}" decoding="async" referrerpolicy="no-referrer">` : ''}<span class="hx-ph" aria-hidden="true">${e.h.stars || ''}성</span>
          <button class="sheet-x hm-c-x" type="button" data-close aria-label="닫기">✕</button></div>
        <div class="hm-c-body">
          <div class="hm-c-top"><span class="hm-prog" data-p="${e.pg}">${esc(info.name)}</span><span class="hm-c-star">${star}</span></div>
          <h2 id="hx-h-title">${esc(e.h.name)}</h2>
          <p class="hm-c-loc">${esc(e.country)} · ${esc(cityLabel(e))}${A.hotels[e.key] ? '' : ' 일대'}</p>
          <dl class="hm-c-facts">
            <div><dt>성급</dt><dd><b>${e.h.stars ? e.h.stars + '성' : '—'}</b><small>${e.country === '한국' ? '호텔업 등급 기준' : '브랜드 등급 기준 추정'}</small></dd></div>
            <div><dt>1박 평균가</dt><dd>${priceText(e)}</dd></div>
          </dl>
          ${closed ? `<p class="hm-c-closed">${esc(e.h.closureNote || '휴업 중')}</p>` : ''}
          ${vl && !closed ? `<a class="hm-c-valet" href="valet.html?hotel=${encodeURIComponent(vl.id)}"><b>무료 발레파킹</b><span>카드 ${vl.n}종 · 내 카드로 되는지 보기 →</span></a>` : ''}
          <div class="hm-c-k">${info.noTier ? '예약 혜택' : '등급별 혜택'}<small>${info.noTier ? 'HoteLux 혜택 포함 요금' : `나의 등급: ${esc(info.tiers[mine].n)} · 등급표에서 바꿀 수 있어요`}</small></div>
          <table class="hm-c-tiers"><thead><tr><th scope="col">등급</th>${DOT.map(([, l]) => `<th scope="col">${l}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
          ${extra.length ? `<ul class="hm-c-notes">${extra.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          ${via ? `<p class="hm-c-also">이 호텔은 ${via}으로도 혜택을 받을 수 있어요.</p>` : ''}
          ${same ? `<p class="hm-c-also">같은 호텔의 <button type="button" class="hm-link" data-key="${esc(same.key)}">${esc(P[same.pg].name)} 등급 혜택</button>도 있어요.</p>` : ''}
          <div class="hm-c-btns">
            <a class="btn-primary" href="${esc(e.h.url)}" target="_blank" rel="noopener">${info.noTier ? 'HoteLux에서 요금 보기' : '공식 페이지에서 요금 보기'} ↗</a>
            ${!info.noTier ? `<button type="button" class="hm-c-tier" data-p="${e.pg}">${esc(info.name)} 등급표</button>` : ''}
          </div>
        </div>`;
      if (!dlg.open) dlg.showModal();
      dlg.querySelector('.hm-c-body').scrollTop = 0;
    }
    dlg.addEventListener('click', (ev) => {
      if (ev.target === dlg || ev.target.closest('[data-close]')) return dlg.close();
      const l = ev.target.closest('.hm-link[data-key]');
      if (l) return openCard(l.dataset.key);
      const t = ev.target.closest('.hm-c-tier');
      if (t) { dlg.close(); tiersUI.open(t.dataset.p); }
    });
    dlg.addEventListener('error', (ev) => { if (ev.target.tagName === 'IMG') ev.target.remove(); }, true);

    // ----- 이벤트 -----
    const tiersUI = tierDialog(() => { draw(); zoom(true); });
    $('tierbtn').addEventListener('click', () => tiersUI.open(current));
    tierSel.addEventListener('change', () => { store.set(STORE_T + current, tierSel.value); draw(); zoom(true); });
    $('crumbs').addEventListener('click', (e) => { const b = e.target.closest('button[data-c]'); if (b && crumbFns[b.dataset.c]) crumbFns[b.dataset.c](); });
    $('up').addEventListener('click', up);
    $('chips').addEventListener('click', (e) => { const b = e.target.closest('button[data-k]'); if (b) chipFns[b.dataset.k](); });
    marks.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-i]');
      if (!b) return;
      const m = marksData[b.dataset.i];
      if (m.kind === 'hotel') return openCard(m.e.key);
      if (m.members.length > 1) {
        // 겹친 거품: 넓게 퍼져 있으면 더 확대, 아주 가까운 동네끼리면 함께 열기
        const ps = m.members.map((x) => x.p);
        const b2 = [Math.min(...ps.map((p) => p[0])), Math.min(...ps.map((p) => p[1])), Math.max(...ps.map((p) => p[0])), Math.max(...ps.map((p) => p[1]))];
        const span = Math.max(b2[2] - b2[0], b2[3] - b2[1]);
        if (m.kind === 'area' && span < AREA_W(S.city) * 0.15) return go({ country: S.country, city: S.city, areas: m.members.map((x) => x.id) });
        custom = fit(b2, 0.6, m.kind === 'area' ? AREA_W(S.city) * 0.6 : 2);
        crumbs();
        return zoom();
      }
      if (m.kind === 'country') return go({ country: m.id });
      if (m.kind === 'city') return go({ country: S.country, city: m.id });
      if (m.kind === 'area') return go({ country: S.country, city: S.city, areas: [m.id] });
    });
    $('list').addEventListener('click', (ev) => {
      const r = ev.target.closest('[data-key]');
      if (r) return openCard(r.dataset.key);
      const c = ev.target.closest('.hm-city');
      if (c) { go({ country: c.dataset.country, city: c.dataset.city }); box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
    $('list').addEventListener('error', (e) => { if (e.target.tagName === 'IMG') e.target.remove(); }, true);
    window.addEventListener('hashchange', () => { const h = location.hash.slice(1).toLowerCase(); if (tabs.includes(h) && h !== current) { current = h; draw(); zoom(true); } });
    let lastW = 0;
    new ResizeObserver(() => {
      const w = box.clientWidth;
      if (w && w !== lastW) { lastW = w; cancelAnimationFrame(anim); custom = null; svg.dataset.level = String(level()); const t = target(); buildMarks(t); setVB(t); crumbs(); }
    }).observe(box);

    saveUrl();
    draw();
    zoom(true);
    if (openKey && byKey[openKey]) openCard(openKey);
  }

  // ---------- 이벤트 (공식 프로모션을 요약해 화면에서 바로 읽음) ----------
  async function eventsPage() {
    const data = await MS.getJSON('events.json');
    const KST = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const events = data.events.filter((e) => !e.endsAt || e.endsAt >= KST)
      .sort((a, b) => (a.endsAt || '9999').localeCompare(b.endsAt || '9999'));
    const groupOf = (e) => (P[e.program] ? e.program : 'other');
    const list = ['all', ...ids(ORDER).filter((id) => events.some((e) => groupOf(e) === id)), ...(events.some((e) => groupOf(e) === 'other') ? ['other'] : [])];
    const counts = { all: events.length };
    for (const e of events) counts[groupOf(e)] = (counts[groupOf(e)] || 0) + 1;
    let current = list.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'all';

    const dfmt = (s) => s.slice(2).replaceAll('-', '.');
    const dday = (s) => Math.round((Date.parse(s) - Date.parse(KST)) / 864e5);
    const brandTile = (e) => P[e.program] ? tile(P[e.program].abbr, P[e.program].tone) :
      tile(e.brand.includes('Hyatt') ? 'WOH' : e.brand.includes('신라') ? '신라' : e.brand.slice(0, 3), 'o');
    const period = (e) => {
      const rows = [];
      if (e.bookBy) rows.push(['예약', `~ ${dfmt(e.bookBy)}`]);
      if (e.stayFrom || e.stayTo) rows.push(['투숙', `${e.stayFrom ? dfmt(e.stayFrom) : ''} ~ ${e.stayTo ? dfmt(e.stayTo) : ''}`]);
      if (!rows.length) rows.push(['기간', '상시 · 예약 화면 기준']);
      return rows;
    };

    // 조건 줄: 위 예약·투숙 기간을 되풀이만 하는 줄은 빼고 2줄까지, 나머지는 '조건 더 보기'로 접음
    const DATE_ONLY = /\d{4}년\s*\d{1,2}월\s*\d{1,2}일(?:\s*\([^)]*\))?\s*(?:까지|부터)?\s*(?:예약|투숙|체크아웃|체크인)?/g;
    const pointList = (e) => {
      const pts = e.points.filter((x) => x.replace(DATE_ONLY, '').replace(/[\s,·.~\-]/g, '').length > 0);
      if (!pts.length) return '';
      const li = (xs) => xs.map((x) => `<li>${esc(x)}</li>`).join('');
      return `<ul class="hx-list">${li(pts.slice(0, 2))}</ul>` + (pts.length > 2 ? `<details class="hx-more"><summary>조건 ${pts.length - 2}개 더 보기</summary><ul class="hx-list">${li(pts.slice(2))}</ul></details>` : '');
    };
    function draw() {
      const shown = events.filter((e) => current === 'all' || groupOf(e) === current);
      const soon = shown.filter((e) => e.endsAt && dday(e.endsAt) <= 14).length;
      $('sub').textContent = `${shown.length}건 · 2주 안에 마감 ${soon}건 · ${data.updated.replaceAll('-', '.')} 확인`;
      $('events').innerHTML = shown.length ? `<div class="hx-cards">${shown.map((e) => {
        const d = e.endsAt ? dday(e.endsAt) : null;
        return `<article class="hx-card">
          <div class="hx-card-top">${brandTile(e)}<span class="hx-brand">${esc(e.brand)}</span>${d != null ? `<span class="hx-dday${d <= 14 ? ' soon' : ''}">${d === 0 ? '오늘 마감' : 'D-' + d}</span>` : ''}</div>
          <h3>${esc(e.title)}</h3>
          <p class="hx-benefit">${esc(e.benefit)}</p>
          <div class="hx-tags"><span>${esc(e.kind)}</span>${e.register ? '<span class="reg">사전 등록 필요</span>' : ''}<span>${esc(e.region)}</span></div>
          <dl class="hx-period">${period(e).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
          ${pointList(e)}
          <a class="hx-src" href="${esc(e.url)}" target="_blank" rel="noopener">공식 페이지 ↗</a>
        </article>`;
      }).join('')}</div>` : '<div class="wl-rows"><p class="wl-empty">진행 중인 이벤트가 없습니다.</p></div>';
    }
    renderTabs(list, current, counts, (id) => { current = id; setHash(id); if (P[id]) store.set(STORE_P, id); draw(); });
    draw();
  }

  const run = { map: mapPage, events: eventsPage }[page];
  if (run) run().catch(() => {
    const box = $('list') || $('events');
    if (box) box.innerHTML = '<div class="wl-rows"><p class="wl-empty">불러오지 못했습니다. 새로고침해 주세요.</p></div>';
  });
})();
