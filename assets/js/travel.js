// Mr. Travel — 혜택(index.html) · 여행지(places.html)
// 데이터: travel/benefits.json(배포 때 tools/travel/benefits.py가 Mr. Cards 데이터에서 생성),
//         travel/places.json(여행지 정보, 직접 수정), travel/world.json(지도, tools/travel/world.mjs)
(() => {
  const page = document.body.dataset.page;
  const $ = (id) => document.getElementById('tv-' + id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const kst = new Date(Date.now() + 9 * 3600e3);
  const TODAY = kst.toISOString().slice(0, 10);
  const MONTH = kst.getUTCMonth(); // 0~11
  const ymd = (s) => (s ? s.slice(2).replace(/-/g, '.') : '');
  const dday = (end) => {
    if (!end) return '상시';
    const d = Math.round((Date.parse(end) - Date.parse(TODAY)) / 864e5);
    return d <= 0 ? '오늘 마감' : 'D-' + d;
  };
  const won = (n) => (n >= 10000 ? (n / 10000).toFixed(n % 10000 ? 1 : 0) + '억' : n + '만');
  const SEASON = ['비수기', '보통', '성수기'];

  // 카드사 타일 (짧은 이름, 색)
  const ISSUER = {
    'KB국민카드': ['KB', 4], '신한카드': ['신한', 1], '삼성카드': ['삼성', 1], '현대카드': ['현대', 5],
    '롯데카드': ['롯데', 2], '하나카드': ['하나', 3], '우리카드': ['우리', 1], 'NH농협카드': ['NH', 3],
    'BC카드': ['BC', 2], 'IBK기업은행': ['IBK', 1], 'iM뱅크': ['iM', 3], '광주은행': ['광주', 1],
  };
  const issuerTile = (name) => {
    const [a, tone] = ISSUER[name] || [name.slice(0, 2), 1];
    return `<span class="tile" data-tone="${tone}" data-len="${Math.min(a.length, 4)}" aria-hidden="true">${esc(a)}</span>`;
  };
  // 지역 묶음 코드 (benefits.py와 같음)
  const GROUP_LABEL = { EU: ['🇪🇺', '유럽 여러 나라'], SEA: ['🌏', '동남아 여러 나라'], APAC: ['🌏', '아시아·태평양'], EG: ['🇪🇬', '이집트'] };

  // ======================= 혜택 =======================
  async function benefitsPage() {
    const [data, pdata] = await Promise.all([MS.getJSON('benefits.json'), MS.getJSON('places.json').catch(() => ({ places: [], groups: {} }))]);
    const P = Object.fromEntries(pdata.places.map((p) => [p.id, p]));
    const groups = pdata.groups || {};
    const placeLabel = (c) => (P[c] ? [P[c].flag, P[c].name] : GROUP_LABEL[c] || ['🌐', c]);
    // 나라 X를 고르면 그 나라가 속한 지역 묶음(EU 등) 혜택도 함께 보여 줌
    const inPlace = (e, c) => e.places.includes(c) || e.places.some((g) => (groups[g] || []).includes(c)) ||
      (groups[c] || []).some((m) => e.places.includes(m));

    const state = { tab: 'common', kind: 'all', issuer: 'all', place: 'all', ctype: 'all', q: '' };
    const fromHash = () => {
      const h = decodeURIComponent(location.hash.slice(1));
      if (h.startsWith('place')) { state.tab = 'place'; state.place = h.split('-')[1] || 'all'; }
      else if (h === 'cards') state.tab = 'cards';
      else if (h === 'common') state.tab = 'common';
    };
    fromHash();

    const hay = (e) => [e.title, e.text, e.issuer, e.kind, e.brand, ...e.places.map((c) => placeLabel(c)[1])].join(' ').toLowerCase();
    const cardHay = (c) => [c.name, c.issuer, c.type, c.fee, ...(c.brands || []), c.pay ? '해외결제 수수료 면제' : '', c.atm ? 'atm 인출' : '', c.lounge ? '라운지' : ''].join(' ').toLowerCase();
    const matches = (text) => state.q.split(/\s+/).filter(Boolean).every((t) => text.includes(t));
    const qEvents = () => data.events.filter((e) => matches(hay(e)));
    const qCards = () => data.cards.filter((c) => matches(cardHay(c)));

    const countBy = (list, f) => list.reduce((m, x) => { for (const k of [].concat(f(x))) m[k] = (m[k] || 0) + 1; return m; }, {});
    // 필터 줄마다 왼쪽에 이름(종류·카드사·나라)을 붙여 줄끼리 헷갈리지 않게 (Mr. Cards와 같은 모양)
    const FNAME = {kind: '종류', issuer: '카드사', place: '나라', ctype: '종류'};
    const chips = (name, items, current) => `<div class="tv-frow"><span class="tv-flabel" aria-hidden="true">${FNAME[name] || ''}</span><div class="tv-chiprow" data-f="${name}" role="group" aria-label="${FNAME[name] || ''}">${items.map(([v, label, n]) =>
      `<button type="button" class="tv-chip" data-v="${esc(v)}" aria-pressed="${v === current}">${label}${n != null ? `<span>${n}</span>` : ''}</button>`).join('')}</div></div>`;
    // 제목 앞 [카드사x제휴처] 꼬리표는 아래 태그와 겹치니 떼고, 제목을 되풀이하는 설명은 숨김
    // "[NH농협카드x트립닷컴] 결제 시…" → "트립닷컴 결제 시…" (카드사·브랜드 이름은 태그에 있으니 빼고 제휴처만 남김)
    const cleanTitle = (t) => {
      const m = /^\s*\[([^\]]{1,30})\]\s*(.+)$/.exec(t);
      if (!m) return t;
      const keep = m[1].split(/\s*[x×X&+]\s*/).filter((w) => w && !/카드|card|visa|master|비자|마스터|유니온|jcb|amex/i.test(w));
      return (keep.length ? keep.join('·') + ' ' : '') + m[2];
    };
    const grams = (t) => { const x = t.replace(/[^가-힣A-Za-z0-9]/g, ''); const g = new Set(); for (let i = 0; i < x.length - 1; i++) g.add(x.slice(i, i + 2)); return g; };
    const echoes = (a, b) => { const A = grams(a), B = grams(b); if (!A.size) return true; let n = 0; for (const g of A) if (B.has(g)) n++; return n / A.size >= 0.6; };

    function render() {
      const evs = qEvents(), common = evs.filter((e) => !e.places.length), placed = evs.filter((e) => e.places.length);
      const cards = qCards();
      const tabs = [['common', '공통', common.length], ['place', '나라별', placed.length], ['cards', '트래블카드', cards.length]];
      $('tabs').innerHTML = tabs.map(([id, label, n]) =>
        `<button type="button" role="tab" data-id="${id}" aria-selected="${id === state.tab}">${label}<span>${n}</span></button>`).join('');

      let filters = '', body = '', head = '';
      if (state.tab === 'common') {
        const kinds = countBy(common, (e) => e.kind), iss = countBy(common, (e) => e.issuer);
        filters = chips('kind', [['all', '전체', common.length], ...Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, k, n])], state.kind) +
          chips('issuer', [['all', '모든 카드사', null], ...Object.entries(iss).sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, (ISSUER[k] || [k])[0], n])], state.issuer);
        const list = common.filter((e) => (state.kind === 'all' || e.kind === state.kind) && (state.issuer === 'all' || e.issuer === state.issuer));
        head = `<div class="wl-block-head">나라 구분 없는 혜택 · 마감 임박 순<span>${list.length}건</span></div>`;
        body = rows(list);
      } else if (state.tab === 'place') {
        const counts = {};
        for (const e of placed) for (const c of e.places) counts[c] = 0;
        for (const c of Object.keys(counts)) counts[c] = placed.filter((e) => inPlace(e, c)).length;
        const order = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        if (state.place !== 'all' && !counts[state.place] && !placed.some((e) => inPlace(e, state.place))) state.place = 'all';
        filters = chips('place', [['all', '전체', placed.length], ...order.map(([c, n]) => { const [f, nm] = placeLabel(c); return [c, `${f} ${esc(nm)}`, n]; })], state.place);
        if (state.place === 'all') {
          // 나라마다 묶어서 (여러 나라에 걸치면 첫 나라)
          body = order.map(([c]) => {
            const list = placed.filter((e) => e.places[0] === c);
            if (!list.length) return '';
            const [f, nm] = placeLabel(c);
            return `<section class="wl-block"><div class="wl-block-head">${f} ${esc(nm)}<span>${list.length}건</span></div>${rows(list)}</section>`;
          }).join('');
        } else {
          const list = placed.filter((e) => inPlace(e, state.place));
          const [f, nm] = placeLabel(state.place);
          const link = P[state.place] ? ` · <a href="places.html#${state.place}">여행지 정보 →</a>` : '';
          head = `<div class="wl-block-head">${f} ${esc(nm)}<span>${list.length}건</span>${link}</div>`;
          body = rows(list);
        }
      } else {
        const types = countBy(cards, (c) => c.type);
        filters = chips('ctype', [['all', '전체', cards.length], ...['체크', '신용'].filter((t) => types[t]).map((t) => [t, t + '카드', types[t]])], state.ctype);
        const list = cards.filter((c) => state.ctype === 'all' || c.type === state.ctype);
        head = `<div class="wl-block-head">카드사별 트래블카드 · 해외 결제·인출 수수료와 라운지<span>${list.length}종</span></div>`;
        body = cardRows(list);
      }
      $('filters').innerHTML = filters;
      $('list').innerHTML = head + (body || '<div class="wl-rows"><p class="wl-empty">조건에 맞는 혜택이 없습니다.</p></div>');
    }

    function rows(list) {
      if (!list.length) return '';
      return `<div class="wl-rows">${list.map((e) => {
        const tags = [`<span class="k">${esc(e.kind)}</span>`];
        if (e.brand) tags.push(`<span>${esc(e.brand)}</span>`);
        for (const c of e.places) { const [f, nm] = placeLabel(c); tags.push(`<span>${f} ${esc(nm)}</span>`); }
        if (e.check) tags.push('<span class="warn">조건 확인 필요</span>');
        const soon = e.end && (Date.parse(e.end) - Date.parse(TODAY)) / 864e5 <= 14;
        return `<article class="wl-row tv-ev">
          ${issuerTile(e.issuer)}
          <div class="tv-ev-body">
            <a class="tv-ev-title" href="../paymorevent/events/${encodeURIComponent(e.id)}/">${esc(cleanTitle(e.title))}</a>
            ${e.text && !echoes(e.text, e.title) ? `<p class="tv-ev-text">${esc(e.text)}</p>` : ''}
            <div class="tv-tags"><span class="iss">${esc(e.issuer)}</span>${tags.join('')}</div>
          </div>
          <div class="tv-ev-side">
            <b class="dd${soon ? ' soon' : ''}">${dday(e.end)}</b>
            <small>${e.end ? '~' + ymd(e.end) : ''}</small>
            ${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">공식 ↗</a>` : ''}
          </div>
        </article>`;
      }).join('')}</div>`;
    }

    function cardRows(list) {
      if (!list.length) return '';
      const byIssuer = {};
      for (const c of list) (byIssuer[c.issuer] = byIssuer[c.issuer] || []).push(c);
      return Object.entries(byIssuer).map(([iss, cs]) => `<section class="wl-block"><div class="wl-block-head">${esc(iss)}<span>${cs.length}종</span></div><div class="wl-rows">${cs.map((c) => {
        const perks = [
          [c.pay, '해외결제 수수료 면제'], [c.atm, 'ATM 인출 수수료 면제'], [c.lounge, '공항 라운지'],
          [c.back, c.back ? `해외 최대 ${c.back}%` : ''],
        ].filter(([on]) => on).map(([, t]) => `<span class="on">${t}</span>`);
        if (!c.pay) perks.push('<span class="off">결제 수수료 면제 없음</span>');
        return `<article class="wl-row tv-card">
          ${issuerTile(c.issuer)}
          <div class="tv-ev-body">
            <a class="tv-ev-title" href="../paymorevent/cards/${encodeURIComponent(c.id)}/">${esc(c.name)}</a>
            <div class="tv-sub2">${esc(c.type)}카드${c.brands?.length ? ' · ' + esc(c.brands.join('/')) : ''} · ${esc(c.fee || '-')}</div>
            <div class="tv-perks">${perks.join('')}</div>
          </div>
          <div class="tv-ev-side">${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">공식 ↗</a>` : ''}</div>
        </article>`;
      }).join('')}</div></section>`).join('');
    }

    $('sub').textContent = `해외·여행 혜택 ${data.events.length}건 · 트래블카드 ${data.cards.length}종 · 카드사 공식 페이지 ${ymd(data.checked)} 확인`;
    $('foot').innerHTML = `Mr. Cards의 카드사 이벤트·카드 데이터에서 해외·여행 혜택만 배포 때 자동으로 골라 요약합니다(${ymd(data.built)} 기준, 마감 지난 행사는 숨김). ` +
      `대상 카드·한도·응모 여부는 <b>공식 ↗</b> 페이지에서 꼭 확인하세요. 제목을 누르면 Mr. Cards 상세로 이동합니다.`;

    $('tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-id]');
      if (!b) return;
      state.tab = b.dataset.id;
      history.replaceState(null, '', '#' + (state.tab === 'place' && state.place !== 'all' ? 'place-' + state.place : state.tab));
      render();
    });
    $('filters').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      const f = b.closest('[data-f]').dataset.f;
      state[f] = b.dataset.v;
      if (f === 'place') history.replaceState(null, '', '#' + (state.place === 'all' ? 'place' : 'place-' + state.place));
      render();
    });
    let t;
    $('q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value.trim().toLowerCase(); render(); }, 120); });
    window.addEventListener('hashchange', () => { fromHash(); render(); });
    render();
  }

  // ======================= 여행지 =======================
  async function placesPage() {
    const [pdata, world, bdata] = await Promise.all([
      MS.getJSON('places.json'), MS.getJSON('world.json'), MS.getJSON('benefits.json').catch(() => ({ events: [] })),
    ]);
    const places = pdata.places, groups = pdata.groups || {};
    const byId = Object.fromEntries(places.map((p) => [p.id, p]));
    const regions = [{ id: 'all', name: '전체' }, ...pdata.regions];
    const benefitsOf = (id) => bdata.events.filter((e) => e.places.includes(id) || e.places.some((g) => (groups[g] || []).includes(id)));

    // world.mjs와 같은 투영(Natural Earth, 태평양 중심)
    const project = (lon, lat) => {
      let l = lon - world.l0;
      l = (((l + 180) % 360) + 360) % 360 - 180;
      const lam = (l * Math.PI) / 180, phi = (lat * Math.PI) / 180, p2 = phi * phi, p4 = p2 * p2;
      const x = lam * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)));
      const y = phi * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
      return [world.tx + world.k * x, world.ty - world.k * y];
    };
    for (const p of places) [p.x, p.y] = project(p.lon, p.lat);
    const LEFT = new Set(['MO', 'LA', 'MY', 'ES', 'HI', 'FR', 'GB']); // 이름표를 왼쪽에

    const fromHash = () => byId[location.hash.slice(1).toUpperCase()] ? location.hash.slice(1).toUpperCase() : null;
    let sel = fromHash() || (byId[store.get('mrtravel.place')] ? store.get('mrtravel.place') : 'JP');
    // 휴대폰에선 세계 전체가 너무 작아서, 고른 나라의 지역부터 보여 줌
    let region = fromHash() || innerWidth <= 720 ? byId[sel].region : 'all';

    // ----- 지도 -----
    const box = $('map');
    box.innerHTML = `<svg class="tv-svg" viewBox="0 0 ${world.w} ${world.h}" role="img" aria-label="여행지 세계지도">
      <path class="tv-shape" id="tv-shape" d=""/>
      <path class="tv-borders" d="${world.borders}"/>
      <path class="tv-land" d="${world.land}"/>
      <g class="tv-pins">${places.map((p) => `<g class="tv-pin" data-id="${p.id}" tabindex="0" role="button" aria-label="${esc(p.name)}">
        <circle class="hit" r="13"/><circle class="dot" r="5"/>
        <text class="lab" x="${LEFT.has(p.id) ? -9 : 9}" y="4" text-anchor="${LEFT.has(p.id) ? 'end' : 'start'}">${esc(p.name)}</text></g>`).join('')}</g>
    </svg>`;
    const svg = box.querySelector('svg');
    const pins = [...svg.querySelectorAll('.tv-pin')];
    let vb = [0, 0, world.w, world.h];
    const setVB = (v) => {
      vb = v;
      svg.setAttribute('viewBox', v.map((n) => n.toFixed(2)).join(' '));
      const s = v[2] / Math.max(1, svg.clientWidth || box.clientWidth || 600); // 화면 1px = 지도 몇 단위
      for (const g of pins) {
        const p = byId[g.dataset.id];
        g.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) scale(${(s * 1.0).toFixed(4)})`);
      }
    };
    // 화면 비율(데스크톱 1000:470, 모바일 4:3)에 맞춰 지역이 꽉 차게
    const target = (rid) => {
      const ar = svg.clientWidth && svg.clientHeight ? svg.clientWidth / svg.clientHeight : world.w / world.h;
      let x0 = 0, x1 = world.w, y0 = 0, y1 = world.h, pad = 0, minW = 0;
      if (rid !== 'all') {
        const ps = places.filter((p) => p.region === rid);
        x0 = Math.min(...ps.map((p) => p.x)); x1 = Math.max(...ps.map((p) => p.x));
        y0 = Math.min(...ps.map((p) => p.y)); y1 = Math.max(...ps.map((p) => p.y));
        pad = 34; minW = 170;
      }
      let w = Math.max(x1 - x0 + pad * 2.6, minW), h = Math.max(y1 - y0 + pad * 2, 80);
      if (w / h < ar) w = h * ar; else h = w / ar;
      const cx = (x0 + x1) / 2 + (rid === 'all' ? 0 : 8), cy = (y0 + y1) / 2;
      return [cx - w / 2, cy - h / 2, w, h];
    };
    let anim;
    const zoomTo = (rid, instant) => {
      const from = vb.slice(), to = target(rid);
      cancelAnimationFrame(anim);
      svg.classList.toggle('zoomed', rid !== 'all');
      if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) { setVB(to); return; }
      const t0 = performance.now(), D = 480;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / D), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        setVB(from.map((a, i) => a + (to[i] - a) * e));
        if (k < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    };

    const regionTabs = () => {
      $('regions').innerHTML = regions.map((r) => `<button type="button" role="tab" data-id="${r.id}" aria-selected="${r.id === region}">${esc(r.name)}<span>${r.id === 'all' ? places.length : places.filter((p) => p.region === r.id).length}</span></button>`).join('');
    };
    const chipsRow = () => {
      const list = places.filter((p) => region === 'all' || p.region === region);
      $('chips').innerHTML = list.map((p) => `<button type="button" role="listitem" class="tv-chip" data-id="${p.id}" aria-pressed="${p.id === sel}">${p.flag} ${esc(p.name)}</button>`).join('');
    };

    // ----- 상세 -----
    const bar = (lo, hi, max) => `<div class="bar"><i style="left:${Math.min(100, (lo / max) * 100)}%;width:${Math.max(2, Math.min(100, (hi / max) * 100) - Math.min(100, (lo / max) * 100))}%"></i></div>`;
    const seasonCells = (s, big) => s.map((v, i) => `<span class="m s${v}${i === MONTH ? ' now' : ''}" title="${i + 1}월 ${SEASON[v]}">${big ? `<b>${i + 1}</b>` : ''}</span>`).join('');
    function detail() {
      const p = byId[sel];
      const bn = benefitsOf(p.id);
      const shapeKey = p.id === 'HI' ? null : p.id;
      $('shape').setAttribute('d', (shapeKey && world.shapes[shapeKey]) || '');
      for (const g of pins) g.classList.toggle('on', g.dataset.id === sel);
      const onPin = pins.find((g) => g.dataset.id === sel);
      onPin && onPin.parentNode.appendChild(onPin); // 맨 위로
      $('detail').innerHTML = `
        <div class="tv-d-head">
          <span class="tv-flag" aria-hidden="true">${p.flag}</span>
          <div class="tv-d-title"><h2>${esc(p.name)} <small>${esc(p.city)}</small></h2>
            <p>✈ ${esc(p.fly)} · ${esc(p.tz)} · ${esc(p.cur)}</p></div>
          <span class="tv-now s${p.season[MONTH]}">${MONTH + 1}월 ${SEASON[p.season[MONTH]]}</span>
        </div>
        <div class="tv-sec-k">월별 성수기 · 비수기</div>
        <div class="tv-season">${seasonCells(p.season, true)}</div>
        <div class="tv-legend"><span class="s2">성수기</span><span class="s1">보통</span><span class="s0">비수기</span><em>가격·혼잡 기준</em></div>
        <p class="tv-note">${esc(p.note)}</p>
        <div class="tv-meters">
          <div class="tv-meter air"><div class="k">왕복 항공권 <small>비수기 특가 ~ 성수기</small></div>
            <div class="v">${won(p.air[0])} ~ ${won(p.air[1])}원</div>${bar(p.air[0], p.air[1], 300)}
            <div class="scale"><span>0</span><span>150만</span><span>300만원</span></div></div>
          <div class="tv-meter hotel"><div class="k">5성급 호텔 1박 <small>${esc(p.city)} · 저가 ~ 최고급</small></div>
            <div class="v">${won(p.hotel[0])} ~ ${won(p.hotel[1])}원</div>${bar(p.hotel[0], p.hotel[1], 300)}
            <div class="scale"><span>0</span><span>150만</span><span>300만원+</span></div></div>
        </div>
        <dl class="tv-facts"><div><dt>입국</dt><dd>${esc(p.entry)}</dd></div></dl>
        <a class="tv-bn" href="./#place-${p.id}"><span>${p.flag} ${esc(p.name)} 카드 혜택</span><b>${bn.length}건 보기 →</b></a>
        ${bn.length ? `<ul class="tv-bn-list">${bn.slice(0, 3).map((e) => `<li><span>${esc((ISSUER[e.issuer] || [e.issuer])[0])}</span>${esc(e.title)}</li>`).join('')}</ul>` : ''}`;
      [...$('chips').children].forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.id === sel)));
      [...$('months').querySelectorAll('.tv-mrow')].forEach((r) => r.setAttribute('aria-current', String(r.dataset.id === sel)));
    }

    // ----- 월별 한눈에 -----
    function months() {
      const list = places.filter((p) => region === 'all' || p.region === region);
      const off = list.filter((p) => p.season[MONTH] === 0);
      $('months').innerHTML = `
        <div class="tv-sec-k">월별 성수기 한눈에 <small>${region === 'all' ? '전체' : esc(regions.find((r) => r.id === region).name)}</small></div>
        ${off.length ? `<p class="tv-off"><b>${MONTH + 1}월 비수기</b> ${off.map((p) => `<button type="button" data-id="${p.id}">${p.flag} ${esc(p.name)}</button>`).join('')}</p>` : ''}
        <div class="tv-mgrid">
          <div class="tv-mrow head"><span class="nm"></span>${Array.from({ length: 12 }, (_, i) => `<span class="m${i === MONTH ? ' now' : ''}">${i + 1}</span>`).join('')}</div>
          ${list.map((p) => `<button type="button" class="tv-mrow" data-id="${p.id}" aria-current="${p.id === sel}"><span class="nm">${p.flag} ${esc(p.name)}</span>${seasonCells(p.season, false)}</button>`).join('')}
        </div>
        <div class="tv-legend"><span class="s2">성수기</span><span class="s1">보통</span><span class="s0">비수기</span></div>`;
    }

    const select = (id, keepRegion) => {
      if (!byId[id]) return;
      sel = id;
      store.set('mrtravel.place', id);
      history.replaceState(null, '', '#' + id);
      if (!keepRegion && region !== 'all' && byId[id].region !== region) { region = byId[id].region; regionTabs(); chipsRow(); months(); zoomTo(region); }
      detail();
    };
    const setRegion = (rid) => { region = rid; regionTabs(); chipsRow(); months(); zoomTo(rid); detail(); };

    svg.addEventListener('click', (e) => { const g = e.target.closest('.tv-pin'); if (g) select(g.dataset.id, true); });
    svg.addEventListener('keydown', (e) => { const g = e.target.closest('.tv-pin'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(g.dataset.id, true); } });
    $('regions').addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (b) setRegion(b.dataset.id); });
    $('chips').addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (b) select(b.dataset.id, true); });
    $('months').addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]');
      if (!b) return;
      select(b.dataset.id, true);
      if (innerWidth <= 720) $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    window.addEventListener('hashchange', () => { const h = fromHash(); if (h && h !== sel) select(h); });
    let lastW = 0;
    new ResizeObserver(() => { const w = box.clientWidth; if (w !== lastW) { lastW = w; cancelAnimationFrame(anim); setVB(target(region)); } }).observe(box);

    $('foot').innerHTML = `항공권·호텔 요금은 ${ymd(pdata.checked)} 기준 참고 범위로, 시기·예약 시점·항공사(직항/경유·LCC)에 따라 크게 달라집니다. ` +
      `입국 조건은 출국 전 <a href="https://www.0404.go.kr/" target="_blank" rel="noopener">외교부 해외안전여행 ↗</a>에서 다시 확인하세요. 지도: Natural Earth.`;
    regionTabs(); chipsRow(); months();
    zoomTo(region, true);
    detail();
  }

  const run = { benefits: benefitsPage, places: placesPage }[page];
  if (run) run().catch((err) => {
    console.error(err);
    const box = $('list') || $('map');
    if (box) box.innerHTML = '<div class="wl-rows"><p class="wl-empty">불러오지 못했습니다. 새로고침해 주세요.</p></div>';
  });
})();
