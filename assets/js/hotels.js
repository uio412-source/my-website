// Mr. Hotels — 티어(index.html) · 호텔(list.html) · 이벤트(events.html)
// 프로그램(Accor·IHG…)과 등급 선택은 이 브라우저에 저장해 세 화면이 같이 씁니다.
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
      return { bf: t >= 2, lounge: t >= 3, up: t >= 2, note: join(t === 2 && '라운지 층 객실로 업그레이드되면 입장', dr) };
    },
  };

  const COMPARE_PERKS = [...PERKS.slice(0, 3), ['out', '레이트 체크아웃']];
  const included = (label) => ({ label, kind: 'included' });
  const conditional = (label) => ({ label, kind: 'conditional' });
  const limited = (label) => ({ label, kind: 'limited' });
  const UP_IF_AVAILABLE = conditional('가능 시');
  const CHECK_HOTEL = limited('호텔 확인');

  function hotelBenefits(program, tier, hotel, day) {
    if (hotel.closedFrom && hotel.closedFrom <= day) {
      const closed = limited('휴업');
      return { bf: closed, lounge: closed, up: closed, out: closed, note: hotel.closureNote };
    }
    const profile = hotel.profile;
    const f = flags[program](tier, profile);
    if (profile === 'excluded') return { note: f.note };
    const up = f.up ? UP_IF_AVAILABLE : null;
    switch (program) {
      case 'accor':
        return {
          bf: f.bf ? conditional('참여 시') : null,
          lounge: f.lounge ? included(profile === 'fairmont' ? '골드 라운지' : '포함') : null,
          up: profile === 'noUpgrade' && tier >= 2 ? limited('브랜드 제외') : up,
          out: tier >= 1 ? conditional('요청 · 가능 시') : null,
          note: [f.note, f.lounge && hotel.loungeNote].filter(Boolean).join(' · '),
        };
      case 'ihg':
        return {
          bf: profile === 'breakfastIncluded' ? included('기본 포함') :
            f.bf ? conditional('2인 선택') : null,
          lounge: profile === 'loungeMilestone' ? limited('연간권 필요') : null,
          up, out: conditional('14시까지 가능 시'),
          note: profile === 'loungeMilestone' ? '라운지는 마일스톤 리워드에서 연간권을 선택한 회원과 동반 1인.' : '',
        };
      case 'marriott': {
        if (profile === 'apartments') {
          return { bf: CHECK_HOTEL, lounge: CHECK_HOTEL, up: CHECK_HOTEL, out: CHECK_HOTEL, note: f.note };
        }
        const breakfast = {
          breakfastChoice: conditional('2인 선택'),
          clubChoice: conditional('2인 선택'),
          club: included('라운지 조식'),
          courtyardClub: included('라운지 조식'),
          series: conditional('직영 식당 운영 시'),
          foodCredit: limited('식음 크레딧'),
          courtyard: limited('식음 크레딧'),
        }[profile];
        const out = tier >= 3
          ? hotel.checkout === 'availability' || profile === 'design'
            ? conditional('16시까지 가능 시')
            : included('16시 보장')
          : tier === 2 ? conditional('14시까지 가능 시') : tier === 1 ? conditional('우선 요청') : null;
        return {
          bf: tier >= 3 ? breakfast : null,
          lounge: f.lounge ? included('회원 + 1인') : tier >= 3 && hotel.loungeUnconfirmed ? CHECK_HOTEL : null,
          up, out,
          note: [
            tier >= 3 && profile === 'courtyardClub' && '라운지 미운영 시 호텔 레스토랑 조식.',
            tier >= 3 && profile === 'series' && '호텔 직영 레스토랑 미운영 시 포인트 제공.',
            tier >= 3 && profile === 'design' && '조식 웰컴 혜택과 라운지 보장은 디자인 호텔스 약관에서 제외.',
            tier >= 3 && hotel.checkout === 'availability' && '리조트의 레이트 체크아웃은 객실 상황에 따릅니다.',
          ].filter(Boolean).join(' '),
        };
      }
      case 'hilton':
        return {
          bf: f.bf ? (profile === 'slh' ? included('2인 컨티넨털') : conditional('MyWay 조식')) : null,
          lounge: f.lounge ? included('회원 + 1인') :
            profile === 'conrad' && tier === 2 ? conditional('라운지 객실 시') : null,
          up, out: tier === 4 && profile !== 'slh' ? included('16시 보장') : conditional('요청 · 가능 시'),
          note: profile === 'slh' ? '힐튼 직접 예약 시 SLH 전용 약관 적용.' : '',
        };
    }
  }

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
  function pickProgram(allowed) {
    const fromHash = location.hash.slice(1).toLowerCase();
    if (allowed.includes(fromHash)) return fromHash;
    const saved = store.get(STORE_P);
    return allowed.includes(saved) ? saved : allowed[0];
  }
  function pickTier(id) {
    const info = P[id];
    const q = new URLSearchParams(location.search).get('t');
    const n = q !== null ? Number(q) : Number(store.get(STORE_T + id) ?? info.defaultTier);
    return Number.isInteger(n) && n >= 0 && n < info.tiers.length ? n : info.defaultTier;
  }
  const tile = (abbr, tone, extra = '') =>
    `<span class="tile${extra}" data-tone="${tone}" data-len="${Math.min(abbr.length, 4)}" aria-hidden="true">${esc(abbr)}</span>`;

  // 프로그램 탭: 같은 모양의 알약 탭(관심종목 보기 탭과 동일)
  function renderTabs(list, current, counts, onPick) {
    const box = $('programs');
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

  // ---------- 티어 ----------
  function tierPage() {
    const list = ids(ORDER).filter((id) => !P[id].noTier);
    let current = pickProgram(list);

    function draw() {
      const info = P[current];
      store.set(STORE_P, current);
      $('sub').textContent = `${info.name} · 등급별 달성 방법·제휴카드·혜택 · 2026년 기준`;

      // 한눈에: 혜택별 시작 등급
      $('glance').innerHTML = PERKS.slice(0, 4).map(([k, label]) => {
        const i = info.tiers.findIndex((t) => t.perks && t.perks[k]);
        return `<div><span>${label}</span><b>${i < 0 ? '없음' : esc(info.tiers[i].n) + '부터'}</b></div>`;
      }).join('');
      $('glance').hidden = false;

      const saved = store.get(STORE_T + current);
      const mine = saved === null ? -1 : Number(saved); // 호텔 화면에서 고른 등급만 표시
      $('tiers').innerHTML = info.tiers.map((t, i) => {
        const perks = t.perks ? PERKS.filter(([k]) => t.perks[k]).map(([k, label]) =>
          `<span class="hx-perk" data-k="${k}"><b>${label}</b>${esc(t.perks[k])}</span>`).join('') :
          '<span class="hx-perk" data-k="base">회원 요금 · 포인트 적립</span>';
        const how = `<span class="hx-how"><span><b>숙박</b>${esc(t.req)}</span>${t.card ? `<span class="via"><b>카드</b>${esc(t.card)}</span>` : ''}</span>`;
        return `<a class="wl-row hx-tier" href="list.html?t=${i}#${current}" data-i="${i}"${i === mine ? ' aria-current="true"' : ''}>
          ${tile(t.a, 't' + Math.min(i, 5))}
          <span class="wl-id"><span class="nm">${esc(t.n)}${i === mine ? '<em class="hx-mine">나의 등급</em>' : ''}</span>${how}</span>
          <span class="hx-bonus${t.bonus ? '' : ' none'}">${t.bonus ? '+' + t.bonus + '%' : '—'}<small>보너스 적립</small></span>
          <span class="hx-perks">${perks}</span>
        </a>`;
      }).join('');
      $('foot').innerHTML = `${esc(info.tierNote)} 등급을 누르면 그 등급으로 서울 호텔별 혜택을 볼 수 있어요. <a href="${info.terms}" target="_blank" rel="noopener">공식 약관 ↗</a>`;

      const cards = info.cards || [];
      $('cardsec').innerHTML = `<section class="hx-sec"><div class="wl-sec-head"><h2>${info.name} 제휴카드</h2><span>국내 발급 · 등급 혜택 요약</span></div>` +
        (cards.length ? `<div class="hx-cards">${cards.map((c) => `<article class="hx-card hx-cc">
          <div class="hx-card-top"><span class="hx-brand">${esc(c.issuer)}</span><span class="hx-fee">${esc(c.fee)}</span></div>
          <h3>${esc(c.name)}</h3>
          <p class="hx-benefit">${esc(c.grant)}</p>
          <ul class="hx-list">${c.perks.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        </article>`).join('')}</div>` : '') +
        (info.cardNote ? `<p class="hx-foot">${esc(info.cardNote)}</p>` : '') + '</section>';
    }
    $('tiers').addEventListener('click', (e) => {
      const a = e.target.closest('a[data-i]');
      if (a) store.set(STORE_T + current, a.dataset.i);
    });
    renderTabs(list, current, null, (id) => { current = id; setHash(id); draw(); });
    draw();
    window.addEventListener('hashchange', () => { current = pickProgram(list); renderTabs(list, current, null, $('programs')._pick); draw(); });
  }

  // ---------- 호텔 ----------
  const DOT = [['bf', '조식'], ['lounge', '라운지'], ['up', '룸업글']];
  async function listPage() {
    const [data, found] = await Promise.all([MS.getJSON('directory.json'), MS.getJSON('images.json').catch(() => ({}))]);
    const country = $('country'), citySel = $('city'), tierSel = $('tier');
    const compareTiers = $('compare-tiers'), search = $('compare-search');
    const list = ids(ORDER);
    let current = pickProgram(list);
    const params = new URLSearchParams(location.search);
    let compare = params.get('view') === 'compare';
    if (params.has('t') && !P[current].noTier) store.set(STORE_T + current, String(pickTier(current)));

    const opts = (sel, values, selected) => sel.replaceChildren(...values.map(([v, t]) => new Option(t, v, false, v === selected)));
    const city = () => data.countries[country.selectedIndex].cities[citySel.selectedIndex];
    const comparePrograms = () => list.filter((id) => !P[id].noTier && city().programs[id]?.length);
    const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    function updateAddress() {
      const url = new URL(location.href);
      url.searchParams.delete('t');
      if (compare) url.searchParams.set('view', 'compare');
      else url.searchParams.delete('view');
      url.hash = current;
      history.replaceState(null, '', url);
    }
    // 대표 이미지: 호텔에 적힌 image → 배포 때 찾은 images.json → 같은 호텔(same)의 이미지
    const byKey = {};
    for (const c of data.countries) for (const ct of c.cities) for (const [pg, hs] of Object.entries(ct.programs)) for (const h of hs) byKey[pg + ':' + h.id] = h;
    const imageOf = (pg, h, depth = 0) => h.image || found[pg + ':' + h.id] ||
      (h.same && depth < 2 && byKey[h.same] ? imageOf(h.same.split(':')[0], byKey[h.same], depth + 1) : '');

    function fillCities() {
      opts(citySel, data.countries[country.selectedIndex].cities.map((c, i) => [String(i), c.name]), '0');
    }
    function makeCompareTierSelects(programs) {
      compareTiers.innerHTML = programs.map((id) => `<label class="hx-field hx-mytier">
        <span>${esc(P[id].name)} 등급</span><select data-program="${id}"></select>
      </label>`).join('');
      for (const select of compareTiers.querySelectorAll('select')) {
        const id = select.dataset.program;
        opts(select, P[id].tiers.map((t, i) => [String(i), t.n]), String(pickTier(id)));
      }
    }
    function selectProgram() {
      const info = P[current];
      store.set(STORE_P, current);
      const counts = Object.fromEntries(list.map((id) => [id, (city().programs[id] || []).length]));
      renderTabs(list, current, counts, pick);
      $('tier-field').hidden = compare || !!info.noTier;
      $('programs').hidden = compare;
      $('list').hidden = compare;
      $('comparison').hidden = !compare;
      $('view-compare').setAttribute('aria-pressed', String(compare));
      $('view-list').setAttribute('aria-pressed', String(!compare));
      if (!info.noTier) opts(tierSel, info.tiers.map((t, i) => [String(i), t.n]), String(pickTier(current)));
      const programs = compare ? comparePrograms() : [current];
      if (compare) makeCompareTierSelects(programs);
      $('conditions').textContent = compare
        ? '호텔과 브랜드별 예외를 반영했습니다. 적격 요금과 라운지 운영 여부를 확인하세요.'
        : listInfo[current].condition;
      const sources = programs.flatMap((id) => [
        [P[id].name + ' 등급 약관', P[id].terms], ...listInfo[id].sources,
      ]);
      if (!compare) sources.push(['호텔업 등급결정 현황', 'https://www.hotelrating.or.kr/hotel']);
      $('sources').innerHTML = sources
        .map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('');
      const abroad = data.countries[country.selectedIndex].name !== '한국';
      $('checked').textContent = '목록 대조일 ' + data.updated.replaceAll('-', '.') +
        (abroad ? ' · 해외 성급은 브랜드 등급 기준 추정 · 해외 라운지는 호텔 공식 정보 기준이며 바뀔 수 있습니다' : ' · 성급은 호텔·공개 등급 자료 기준') +
        ' · 사진은 각 호텔 공식 사이트 이미지입니다.';
      render();
    }

    function renderComparison() {
      const ct = city();
      const fold = (text) => text.toLowerCase().replace(/[\s·-]/g, '');
      const filter = fold(search.value);
      let count = 0;
      const tables = [...compareTiers.querySelectorAll('select')].map((select) => {
        const program = select.dataset.program;
        const tier = Number(select.value);
        const hotels = ct.programs[program].filter((h) => fold(h.name + h.district).includes(filter));
        if (!hotels.length) return '';
        count += hotels.length;
        const cells = hotels.map((h) => {
          const perk = hotelBenefits(program, tier, h, day);
          return `<tr>
            <th scope="row"><a href="${esc(h.url)}">${esc(h.name)}</a><small>${esc(h.district)}</small>
              ${perk.note ? `<small class="hx-compare-note">${esc(perk.note)}</small>` : ''}</th>
            ${COMPARE_PERKS.map(([key]) => {
              const value = perk[key];
              return `<td>${value ? `<span data-kind="${value.kind}">${esc(value.label)}</span>` : '—'}</td>`;
            }).join('')}
          </tr>`;
        }).join('');
        return `<div class="wl-rows hx-compare-group"><table class="hx-compare-table">
          <caption>${esc(P[program].name)} <small>${esc(P[program].tiers[tier].n)} · ${hotels.length}곳</small></caption>
          <thead><tr><th scope="col">호텔</th>${COMPARE_PERKS.map(([, label]) => `<th scope="col">${label}</th>`).join('')}</tr></thead>
          <tbody>${cells}</tbody>
        </table></div>`;
      }).join('');
      $('sub').textContent = `${ct.name} · ${count}곳 비교`;
      $('compare-results').innerHTML = count ? tables : '<p class="wl-empty">조건에 맞는 호텔이 없습니다.</p>';
    }

    function render() {
      if (compare) return renderComparison();
      const info = P[current], ct = city();
      const t = info.noTier ? 0 : Number(tierSel.value);
      const rows = (ct.programs[current] || []).map((h) => ({
        h, f: h.closedFrom && h.closedFrom <= day ? { note: h.closureNote } : flags[current](t, h.profile),
      }));
      const score = (f) => (f.bf ? 1 : 0) + (f.lounge ? 1 : 0) + (f.up ? 1 : 0);
      rows.sort((a, b) => score(b.f) - score(a.f) || (b.h.stars || 0) - (a.h.stars || 0) || a.h.name.localeCompare(b.h.name, 'ko'));
      const n = (k) => rows.filter((r) => r.f[k]).length;
      $('sub').textContent = `${ct.name} · ${info.name} ${rows.length}곳` + (info.noTier ? ' · 혜택 포함 요금 기준' : ` · ${info.tiers[t].n} 기준`);
      if (!rows.length) {
        const has = list.filter((id) => (ct.programs[id] || []).length).map((id) => P[id].name);
        $('list').innerHTML = `<div class="wl-rows"><p class="wl-empty">${esc(ct.name)}에는 아직 정리한 ${esc(info.name)} 호텔이 없습니다.${has.length ? ` (${esc(has.join(' · '))} 목록은 있어요)` : ''}</p></div>`;
        return;
      }
      const sum = `<p class="hx-sum">${DOT.map(([k, l]) => `<span><i class="hx-pink" aria-hidden="true"></i>${l} <b>${n(k)}</b>곳</span>`).join('')}</p>`;
      const head = `<div class="hx-h hx-head" aria-hidden="true"><span></span><span>호텔명</span><span>성급</span><span>위치</span>${DOT.map(([, l]) => `<span>${l}</span>`).join('')}</div>`;
      const korea = data.countries[country.selectedIndex].name === '한국';
      const cityLabel = !korea ? ct.name : ct.name.endsWith('시') ? ct.name : ct.name + '시';
      $('list').innerHTML = sum + `<div class="wl-rows hx-table">${head}${rows.map(({ h, f }) => {
        const img = imageOf(current, h);
        const star = h.stars ? h.stars + '성' : '—';
        return `<a class="hx-h${f.bf || f.lounge || f.up ? '' : ' off'}" href="${esc(h.url)}" target="_blank" rel="noopener">
          <span class="hx-img">${img ? `<img src="${esc(img)}" alt="${esc(h.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}<span class="hx-ph" aria-hidden="true">${esc(star)}</span></span>
          <span class="hx-name"><b>${esc(h.name)}</b>${f.note ? `<small>${esc(f.note)}</small>` : ''}</span>
          <span class="hx-star">${esc(star)}</span>
          <span class="hx-loc"><span class="m">${esc(star)} · </span>${esc(cityLabel)} ${esc(h.district)}</span>
          ${DOT.map(([k, l]) => `<span class="hx-dot" data-k="${k}"${f[k] ? ' data-on' : ''} aria-label="${l} ${f[k] ? '있음' : '없음'}"><i aria-hidden="true"></i><em>${l}</em></span>`).join('')}
        </a>`;
      }).join('')}</div>`;
    }
    // 사진을 못 불러오면 성급 타일로 대신 보여 줌
    $('list').addEventListener('error', (e) => { if (e.target.tagName === 'IMG') e.target.remove(); }, true);

    const pick = (id) => { current = id; updateAddress(); selectProgram(); };
    opts(country, data.countries.map((c, i) => [String(i), c.name]), '0');
    fillCities();
    // 도시를 바꿨는데 지금 프로그램 호텔이 없으면 목록이 있는 프로그램으로 옮김
    const fitProgram = () => {
      if ((city().programs[current] || []).length) return;
      const next = list.find((id) => (city().programs[id] || []).length);
      if (next) { current = next; updateAddress(); }
    };
    country.addEventListener('change', () => { fillCities(); fitProgram(); selectProgram(); });
    citySel.addEventListener('change', () => { fitProgram(); selectProgram(); });
    tierSel.addEventListener('change', () => { store.set(STORE_T + current, tierSel.value); render(); });
    compareTiers.addEventListener('change', (e) => {
      const select = e.target;
      if (!select.matches('select[data-program]')) return;
      store.set(STORE_T + select.dataset.program, select.value);
      renderComparison();
    });
    search.addEventListener('input', renderComparison);
    function chooseView(value) {
      if (compare === value) return;
      compare = value;
      updateAddress();
      selectProgram();
    }
    $('view-compare').addEventListener('click', () => chooseView(true));
    $('view-list').addEventListener('click', () => chooseView(false));
    window.addEventListener('hashchange', () => { current = pickProgram(list); selectProgram(); });
    if (params.has('t')) updateAddress();
    selectProgram();
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
          <ul class="hx-list">${e.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          <a class="hx-src" href="${esc(e.url)}" target="_blank" rel="noopener">출처 · 공식 페이지 ↗</a>
        </article>`;
      }).join('')}</div>` : '<div class="wl-rows"><p class="wl-empty">진행 중인 이벤트가 없습니다.</p></div>';
    }
    renderTabs(list, current, counts, (id) => { current = id; setHash(id); if (P[id]) store.set(STORE_P, id); draw(); });
    draw();
  }

  const run = { tier: async () => tierPage(), list: listPage, events: eventsPage }[page];
  if (run) run().catch(() => {
    const box = $('list') || $('events') || $('tiers');
    if (box) box.innerHTML = '<div class="wl-rows"><p class="wl-empty">불러오지 못했습니다. 새로고침해 주세요.</p></div>';
  });
})();
