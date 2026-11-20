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
      tiers: [
        { n: '클래식', a: 'C', req: '가입 시' },
        { n: '실버', a: 'S', req: '10박 또는 2,000 SP', bonus: 24, perks: { out: '레이트(가능 시)' } },
        { n: '골드', a: 'G', req: '30박 또는 7,000 SP', bonus: 48, perks: { up: '가능 시', out: '얼리 또는 레이트' } },
        { n: '플래티넘', a: 'P', req: '60박 또는 14,000 SP', bonus: 76, perks: { bf: '참여 호텔', lounge: '참여 호텔', up: '가능 시', out: '얼리·레이트' } },
        { n: '다이아몬드', a: 'D', req: '26,000 SP (SP로만 달성)', bonus: 76, perks: { bf: '참여 호텔 · 주말 조식', lounge: '페어몬트 골드 포함', up: '가능 시', out: '얼리·레이트', etc: '골드 등급 선물' } },
      ],
    },
    ihg: {
      name: 'IHG', abbr: 'IHG', tone: 3,
      terms: 'https://www.ihg.com/content/kr/ko/customer-care/member-tc/2nd-page',
      tierNote: '연간 적격 숙박일수 또는 적격 포인트로 달성합니다. 라운지는 등급 혜택이 아니라 40박 마일스톤 리워드에서 고르는 연간 라운지 멤버십입니다.',
      defaultTier: 4,
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
      tiers: [
        { n: '멤버', a: 'M', req: '가입 시' },
        { n: '실버', a: 'S', req: '10박', bonus: 10, perks: { out: '우선 레이트(가능 시)' } },
        { n: '골드', a: 'G', req: '25박', bonus: 25, perks: { up: '가능 시', out: '오후 2시(가능 시)' } },
        { n: '플래티넘', a: 'P', req: '50박', bonus: 50, perks: { bf: '웰컴 혜택 선택', lounge: '참여 호텔', up: '일부 스위트까지', out: '오후 4시' } },
        { n: '티타늄', a: 'T', req: '75박', bonus: 75, perks: { bf: '웰컴 혜택 선택', lounge: '참여 호텔', up: '일부 스위트까지', out: '오후 4시' } },
        { n: '앰배서더', a: 'A', req: '100박 + 연 US$23,000', bonus: 75, perks: { bf: '웰컴 혜택 선택', lounge: '참여 호텔', up: '일부 스위트까지', out: '오후 4시', etc: '앰배서더 전담 서비스' } },
      ],
    },
    hilton: {
      name: 'Hilton', abbr: 'H', tone: 1,
      terms: 'https://www.hilton.com/en/hilton-honors/member-benefits/',
      tierNote: '2026년부터 박수·투숙 횟수·적격 지출(US$) 중 하나로 달성합니다(다이아몬드 리저브는 박수 또는 횟수에 더해 지출 필요). 조식은 브랜드·지역에 따라 식음 크레딧으로 대신 제공됩니다.',
      defaultTier: 3,
      tiers: [
        { n: '멤버', a: 'M', req: '가입 시' },
        { n: '실버', a: 'S', req: '10박 · 4회 또는 US$2,500', bonus: 20, perks: { out: '레이트(요청 시)' } },
        { n: '골드', a: 'G', req: '25박 · 15회 또는 US$6,000', bonus: 80, perks: { bf: '조식 또는 식음 크레딧', up: '이그제큐티브 룸까지', out: '레이트(요청 시)' } },
        { n: '다이아몬드', a: 'D', req: '50박 · 25회 또는 US$11,500', bonus: 100, perks: { bf: '조식 또는 식음 크레딧', lounge: '이그제큐티브 라운지', up: '1베드 스위트까지', out: '레이트(요청 시)' } },
        { n: '다이아몬드 리저브', a: 'DR', req: '80박 또는 40회 + US$18,000', bonus: 120, perks: { bf: '조식 또는 식음 크레딧', lounge: '라운지 · 프리미엄 클럽', up: '확정 업그레이드 1회', out: '오후 4시 보장' } },
      ],
    },
  };
  const ORDER = ['accor', 'ihg', 'hotelux', 'marriott', 'hilton'];
  const PERKS = [['bf', '조식'], ['lounge', '라운지'], ['up', '업그레이드'], ['out', '체크아웃'], ['etc', '기타']];

  // ---------- 호텔별 혜택 문구 (등급 번호, 호텔 profile) ----------
  const benefit = {
    accor(tier, profile) {
      if (profile === 'excluded') return 'ALL Accor 멤버십 미참여';
      if (tier === 0) return '회원 요금 · 포인트 적립';
      if (tier === 1) return '레이트 체크아웃(가능 시)';
      if (tier === 2) return '객실 업그레이드 · 얼리 또는 레이트(가능 시)';
      const lounge = profile === 'club' ? ' · 라운지' :
        profile === 'fairmont' ? (tier >= 4 ? ' · 페어몬트 골드 라운지' : ' · 골드 라운지는 다이아몬드부터') : '';
      return '조식(참여 시)' + lounge + ' · 업그레이드 · 얼리·레이트(가능 시)';
    },
    ihg(tier, profile) {
      const perks = [];
      if (profile === 'breakfastIncluded') perks.push('기본 조식 포함');
      else if (tier === 4) perks.push('웰컴 혜택으로 2인 조식 선택');
      if (profile === 'loungeMilestone') perks.push('별도 연간 라운지 멤버십 사용 가능');
      if (tier >= 3) perks.push('업그레이드·얼리(가능 시)');
      perks.push('레이트(가능 시)');
      return perks.join(' · ');
    },
    hotelux(tier, profile) {
      return profile === 'sofitelExample' ? '요금 예시: 매일 조식 · US$100 호텔 크레딧 · 업그레이드(가능 시)' :
        '요금별 조식·크레딧 및 업그레이드·얼리·레이트 조건 확인';
    },
    marriott(tier, profile) {
      if (profile === 'apartments') return '이그제큐티브 아파트먼트 별도 적립·혜택 조건';
      if (tier === 0) return '회원 요금 · 포인트 적립';
      if (tier === 1) return '우선 레이트 체크아웃(가능 시)';
      if (tier === 2) return '객실 업그레이드 · 오후 2시 체크아웃(가능 시)';
      const perks = {
        breakfastChoice: '웰컴 혜택으로 2인 조식 선택',
        foodCredit: '웰컴 혜택으로 식음 크레딧 선택',
        courtyard: '웰컴 혜택으로 식음 크레딧 선택',
        courtyardClub: '라운지 조식 · 미운영 시 레스토랑 조식',
        club: '라운지',
        clubChoice: '라운지 · 웰컴 혜택으로 조식 선택',
        series: '웰컴 혜택으로 조식 선택(레스토랑 운영 조건)',
        welcome: '웰컴 혜택(포인트 또는 지정 어메니티)',
      };
      return perks[profile] + ' · 업그레이드(가능 시) · 오후 4시 체크아웃';
    },
    hilton(tier, profile) {
      if (profile === 'slh') return tier >= 2 ? 'SLH 2인 컨티넨털 조식 · 업그레이드·레이트(가능 시)' : 'SLH 레이트 체크아웃(가능 시)';
      if (tier <= 1) return tier === 1 ? '포인트 20% 추가 적립' : '회원 요금 · 포인트 적립';
      const reserve = tier === 4 ? ' · 오후 4시 체크아웃(참여 호텔)' : '';
      if (profile === 'garden') return 'MyWay 조식 선택' + reserve;
      return '조식 · 업그레이드(가능 시)' +
        (tier >= 3 ? ' · 이그제큐티브 라운지' : ' · 업그레이드로 라운지 대상 객실 배정 시 입장') + reserve;
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
      condition: '조식 선택은 해당 브랜드의 웰컴 기프트 기준입니다. 라운지는 참여 호텔에서 동일 객실의 회원과 동반 1인 기준입니다. 객실 업그레이드는 가용 시 적용되며 레이트 체크아웃은 약관의 브랜드·호텔 예외를 따릅니다.',
      sources: [
        ['Marriott 한국 공식 호텔 목록', 'https://www.marriott.com/en-us/hotel-sitemap/south-korea-hotel-sitemap'],
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
      $('sub').textContent = `${info.name} · 등급 ${info.tiers.length - 1}단계 · 2026년 기준`;

      // 한눈에: 혜택별 시작 등급
      const glance = PERKS.slice(0, 4).map(([k, label]) => {
        const i = info.tiers.findIndex((t) => t.perks && t.perks[k]);
        return `<div><span>${label}</span><b>${i < 0 ? '없음' : esc(info.tiers[i].n) + '부터'}</b></div>`;
      }).join('');
      $('glance').innerHTML = glance;
      $('glance').hidden = false;

      const saved = store.get(STORE_T + current);
      const mine = saved === null ? -1 : Number(saved); // 호텔 화면에서 고른 등급만 표시
      $('tiers').innerHTML = info.tiers.map((t, i) => {
        const perks = t.perks ? PERKS.filter(([k]) => t.perks[k]).map(([k, label]) =>
          `<span class="hx-perk" data-k="${k}"><b>${label}</b>${esc(t.perks[k])}</span>`).join('') :
          '<span class="hx-perk" data-k="base">회원 요금 · 포인트 적립</span>';
        return `<a class="wl-row hx-tier" href="list.html?t=${i}#${current}" data-i="${i}"${i === mine ? ' aria-current="true"' : ''}>
          ${tile(t.a, 't' + Math.min(i, 5))}
          <span class="wl-id"><span class="nm">${esc(t.n)}${i === mine ? '<em class="hx-mine">선택한 등급</em>' : ''}</span><small>${esc(t.req)}</small></span>
          <span class="hx-bonus${t.bonus ? '' : ' none'}">${t.bonus ? '+' + t.bonus + '%' : '—'}<small>보너스 적립</small></span>
          <span class="hx-perks">${perks}</span>
        </a>`;
      }).join('');
      $('foot').innerHTML = `${esc(info.tierNote)} 등급을 누르면 그 등급으로 서울 호텔별 혜택을 볼 수 있어요. <a href="${info.terms}" target="_blank" rel="noopener">공식 약관 ↗</a>`;
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
  async function listPage() {
    const data = await MS.getJSON('directory.json');
    const city = data.countries[0].cities[0];
    const list = ids(ORDER);
    const counts = Object.fromEntries(list.map((id) => [id, (city.programs[id] || []).length]));
    let current = pickProgram(list);
    const tierSel = $('tier'), distSel = $('district'), query = $('query');

    const opts = (sel, values, selected) => {
      sel.replaceChildren(...values.map(([v, t]) => new Option(t, v, false, v === selected)));
    };
    function selectProgram() {
      const info = P[current];
      store.set(STORE_P, current);
      $('tier-field').hidden = !!info.noTier;
      if (!info.noTier) opts(tierSel, info.tiers.map((t, i) => [String(i), t.n + ' 혜택']), String(pickTier(current)));
      const hotels = city.programs[current] || [];
      const districts = [...new Set(hotels.map((h) => h.district))].sort((a, b) => a.localeCompare(b, 'ko'));
      opts(distSel, [['', '전체 구'], ...districts.map((d) => [d, d])], '');
      const li = listInfo[current];
      $('conditions').textContent = li.condition;
      $('sources').innerHTML = [...li.sources, ['공식 등급 혜택·약관', info.terms],
        ['호텔업 등급결정 현황', 'https://www.hotelrating.or.kr/hotel']]
        .map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('');
      $('checked').textContent = '목록 대조일 ' + data.updated.replaceAll('-', '.') + ' · 성급은 호텔·공개 등급 자료 기준입니다.';
      render();
    }

    const norm = (v) => v.toLocaleLowerCase('ko').replace(/[^\p{L}\p{N}]/gu, '');
    function render() {
      const info = P[current];
      const t = info.noTier ? 0 : Number(tierSel.value);
      const words = query.value.trim().split(/\s+/).filter(Boolean).map(norm);
      const hotels = (city.programs[current] || []).filter((h) => {
        const name = norm(h.name + h.district);
        return (!distSel.value || h.district === distSel.value) && words.every((w) => name.includes(w));
      }).sort((a, b) => a.district.localeCompare(b.district, 'ko') || (b.stars || 0) - (a.stars || 0) || a.name.localeCompare(b.name, 'ko'));
      $('sub').textContent = `${city.name} · ${info.name} ${hotels.length}곳` + (info.noTier ? ' · 요금별 혜택' : ` · ${info.tiers[t].n} 기준`);

      if (!hotels.length) {
        $('list').innerHTML = '<div class="wl-rows"><p class="wl-empty">검색 조건에 맞는 호텔이 없습니다.</p></div>';
        return;
      }
      const groups = new Map();
      for (const h of hotels) (groups.get(h.district) || groups.set(h.district, []).get(h.district)).push(h);
      $('list').innerHTML = [...groups].map(([d, hs]) => `<section class="wl-block">
        <h2 class="wl-block-head">${esc(d)}<span>${hs.length}</span></h2>
        <div class="wl-rows">${hs.map((h) => {
          const text = benefit[current](t, h.profile);
          const off = h.profile === 'excluded';
          const chips = text.split(' · ').map((c) => `<span class="hx-perk">${esc(c)}</span>`).join('');
          return `<a class="wl-row hx-hotel${off ? ' off' : ''}" href="${esc(h.url)}" target="_blank" rel="noopener">
            ${tile(h.stars ? h.stars + '성' : '—', 's' + (h.stars || 0))}
            <span class="wl-id"><span class="nm">${esc(h.name)}</span><span class="hx-perks">${chips}</span></span>
            <svg class="hx-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>
          </a>`;
        }).join('')}</div></section>`).join('');
    }

    renderTabs(list, current, counts, (id) => { current = id; setHash(id); query.value = ''; selectProgram(); });
    tierSel.addEventListener('change', () => { store.set(STORE_T + current, tierSel.value); render(); });
    distSel.addEventListener('change', render);
    query.addEventListener('input', render);
    window.addEventListener('hashchange', () => { current = pickProgram(list); renderTabs(list, current, counts, $('programs')._pick); selectProgram(); });
    selectProgram();
    if (location.search) setHash(current); // 티어 화면에서 넘어온 ?t= 는 한 번만 쓰고 주소에서 지움
  }

  // ---------- 이벤트 ----------
  async function eventsPage() {
    const data = await MS.getJSON('events.json');
    const KST = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const events = data.events.filter((e) => !e.endsAt || e.endsAt >= KST);
    const groupOf = (e) => (P[e.program] ? e.program : 'other');
    const list = ['all', ...ids(ORDER).filter((id) => events.some((e) => groupOf(e) === id)), ...(events.some((e) => groupOf(e) === 'other') ? ['other'] : [])];
    const counts = { all: events.length };
    for (const e of events) counts[groupOf(e)] = (counts[groupOf(e)] || 0) + 1;
    let current = list.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'all';

    const dfmt = (s) => s.slice(5).replace('-', '.');
    const dday = (s) => Math.round((Date.parse(s) - Date.parse(KST)) / 864e5);
    const brandTile = (e) => P[e.program] ? tile(P[e.program].abbr, P[e.program].tone) :
      tile(e.brand.includes('Hyatt') ? 'WOH' : e.brand.includes('롯데') ? '롯데' : e.brand.includes('신라') ? '신라' : e.brand.slice(0, 2), 'o');

    function draw() {
      const shown = events.filter((e) => current === 'all' || groupOf(e) === current);
      const active = shown.filter((e) => e.status === 'active');
      const hubs = shown.filter((e) => e.status !== 'active');
      $('sub').textContent = `진행 중 ${active.length} · 공식 오퍼 ${hubs.length} · 확인일 ${data.updated.replaceAll('-', '.')}`;
      let html = '';
      if (active.length) {
        html += `<section class="hx-sec"><div class="wl-sec-head"><h2>진행 중인 이벤트</h2><span>기간 한정</span></div><div class="hx-cards">` +
          active.map((e) => {
            const d = e.endsAt ? dday(e.endsAt) : null;
            return `<article class="hx-card">
              <div class="hx-card-top">${brandTile(e)}<span class="hx-brand">${esc(e.chain)}</span>${d != null ? `<span class="hx-dday${d <= 14 ? ' soon' : ''}">${d === 0 ? '오늘 마감' : 'D-' + d}</span>` : ''}</div>
              <h3>${esc(e.title)}</h3>
              ${e.benefit ? `<p class="hx-benefit">${esc(e.benefit)}</p>` : ''}
              <p class="hx-desc">${esc(e.description)}</p>
              <p class="hx-period">${e.startsAt ? dfmt(e.startsAt) : ''} ~ ${e.endsAt ? dfmt(e.endsAt) : '상시'}${e.tags.length ? ' · ' + e.tags.map(esc).join(' · ') : ''}</p>
              ${e.requirements.length ? `<details class="hx-req"><summary>참여 조건 ${e.requirements.length}</summary><ul>${e.requirements.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></details>` : ''}
              <a class="hx-cta" href="${esc(e.url)}" target="_blank" rel="noopener">공식 페이지에서 등록 ↗</a>
            </article>`;
          }).join('') + '</div></section>';
      }
      if (hubs.length) {
        html += `<section class="hx-sec"><div class="wl-sec-head"><h2>공식 오퍼 모음</h2><span>체인별 상시 페이지</span></div><div class="wl-rows">` +
          hubs.map((e) => `<a class="wl-row hx-hub" href="${esc(e.url)}" target="_blank" rel="noopener">
            ${brandTile(e)}
            <span class="wl-id"><span class="nm">${esc(e.title)}</span><small class="hx-hub-desc">${esc(e.description)}</small></span>
            <svg class="hx-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>
          </a>`).join('') + '</div></section>';
      }
      $('events').innerHTML = html || '<div class="wl-rows"><p class="wl-empty">진행 중인 이벤트가 없습니다.</p></div>';
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
