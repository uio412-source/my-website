// Mr. Pay — 가맹점(pay/index.html) · 브랜드(pay/brands.html)
// 데이터: pay/data/onnuri/meta.json·<시도>.json (배포 때 tools/pay/build.py가 공공데이터포털 온누리·상가정보로 만듦, 커밋 안 함)
//         pay/brands.json (토스페이·네이버페이 페이스사인 브랜드·장소, 손으로 정리 + 출처)
// '온누리 + 토스페이/네이버'는 매장 단위 공개 목록이 없어서, 온누리 가맹점 상호에 브랜드 이름이 들어 있는지로만 봄(브랜드 기준)
(() => {
  const page = document.body.dataset.page;
  const $ = (id) => document.getElementById('py-' + id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const ymd = (s) => {
    if (!s) return '';
    const d = String(s).replace(/-/g, '');
    return /^\d{8}$/.test(d) ? `${d.slice(2, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}` : String(s);
  };
  const num = (n) => Number(n || 0).toLocaleString('ko-KR');
  // 상호 비교용: (주)·띄어쓰기·기호 빼고 소문자 (tools/pay/build.py의 nname과 같은 규칙)
  const norm = (s) => String(s || '').replace(/\(주\)|㈜|주식회사|\(유\)|유한회사/g, '').replace(/[\s\-_·.,'"()[\]{}&/+~!@#*]+/g, '').toLowerCase();
  const STATUS = { '됨': 'ok', '일부': 'part', '예정': 'plan' };
  const SHORT = { toss: '토스페이', naver: '네이버' };

  const loadBrands = () => MS.getJSON('brands.json').catch(() => ({ programs: [], brands: [] }));
  const loadMeta = () => MS.getJSON('data/onnuri/meta.json').catch(() => null);

  // 브랜드 이름(영문은 단어 경계, 한글은 포함)으로 상호를 맞춤 → [{brand}]
  const brandMatcher = (brands) => {
    const keys = brands.filter((b) => b.kind === 'brand' && b.match !== false).flatMap((b) => [b.name, ...(b.aliases || [])].filter(Boolean).map((n) => {
      const ascii = /^[\x20-\x7e]+$/.test(n);
      return { b, ascii, key: norm(n), rx: ascii ? new RegExp('(^|[^a-z0-9])' + n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])') : null };
    }));
    return (name) => {
      const lo = String(name).toLowerCase(), nn = norm(name), hits = [];
      for (const k of keys) if ((k.ascii ? k.rx.test(lo) : k.key && nn.includes(k.key)) && !hits.includes(k.b)) hits.push(k.b);
      return hits;
    };
  };

  const sourcesLine = (meta) => {
    if (!meta) return '';
    const [on, sg] = [meta.sources.find((s) => s.id === 'onnuri'), meta.sources.find((s) => s.id === 'sangga')];
    const ver = (s) => (s && s.fileDate ? ` ${ymd(s.fileDate)}판` : '');
    return `원본: 공공데이터포털 <a href="${esc(on.url)}" target="_blank" rel="noopener">온누리 가맹점${ver(on)} ↗</a>` +
      (sg ? ` · 업종 <a href="${esc(sg.url)}" target="_blank" rel="noopener">상가(상권)정보${ver(sg)} ↗</a>` : '') +
      ` · 매월 초 새 판 확인`;
  };

  // ======================= 가맹점 =======================
  async function storesPage() {
    const [meta, bdata] = await Promise.all([loadMeta(), loadBrands()]);
    const programs = bdata.programs || [];
    const brandsOf = brandMatcher(bdata.brands || []);
    if (!meta || !meta.sidos || !meta.sidos.length) {
      $('sub').textContent = '온누리 가맹점';
      $('list').innerHTML = '<div class="wl-rows"><p class="wl-empty" role="status">가맹점 DB 준비 중이에요. 다음 배포 때 채워져요.</p></div>';
      $('combo').hidden = true;
      return;
    }
    const checked = (meta.sources.find((s) => s.id === 'onnuri') || {}).checked || meta.built;
    const onv = (meta.sources.find((s) => s.id === 'onnuri') || {}).fileDate;
    $('sub').textContent = `온누리 가맹점 ${num(meta.total)}곳${onv ? ` · 원본 ${ymd(onv)}판` : ''} · ${ymd(checked)} 확인`;
    $('foot').innerHTML = sourcesLine(meta) + ` · <a href="brands.html">토스·네이버 브랜드 출처</a>`;

    const sidoIds = meta.sidos.map((s) => s.id);
    const hashCombo = () => (['toss', 'naver'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'all');
    const state = {
      sido: sidoIds.includes(store.get('mrpay.sido')) ? store.get('mrpay.sido') : (sidoIds.includes('seoul') ? 'seoul' : sidoIds[0]),
      sgg: 'all', cat: 'all', kind: 'all', combo: hashCombo(), q: '', limit: 50,
    };
    const cache = {};
    let rows = [];

    const loadSido = async (id) => {
      if (!cache[id]) {
        const d = await MS.getJSON(`data/onnuri/${id}.json`);
        // 시장 표(이름·시군구·동) + 가맹점 줄. 원본 소재지가 시도뿐이라 주소는 상가정보와 맞춘 곳만 있고,
        // 나머지는 시장 위치(그 시장 가맹점들이 모인 시군구·동)를 보여 줌
        const mk = d.markets.map((r) => Object.fromEntries(d.mcols.map((c, i) => [c, r[i]])));
        cache[id] = d.rows.map((r) => {
          const s = Object.fromEntries(d.cols.map((c, i) => [c, r[i]]));
          const m = mk[s.m] || {};
          s.market = m.name || '';
          s.sgg = m.sgg || '위치 모름';
          s.short = s.addr || (m.sgg ? `${m.sgg}${m.dong ? ' ' + m.dong : ''} 일대` : '');
          s.brands = brandsOf(s.name);
          s.hay = norm([s.name, s.market, s.goods, s.addr, m.sgg, m.dong, s.biz, s.cat].join(' '));
          return s;
        });
      }
      return cache[id];
    };

    const pass = (s, skip) => {
      if (skip !== 'sgg' && state.sgg !== 'all' && s.sgg !== state.sgg) return false;
      if (skip !== 'cat' && state.cat !== 'all' && (s.cat || '미확인') !== state.cat) return false;
      if (skip !== 'kind' && state.kind === 'paper' && !s.paper) return false;
      if (skip !== 'kind' && state.kind === 'digital' && !s.digital) return false;
      if (skip !== 'combo' && state.combo !== 'all' && !s.brands.some((b) => b.program === state.combo)) return false;
      if (state.q) for (const t of state.q) if (!s.hay.includes(t)) return false;
      return true;
    };
    const count = (skip, f) => rows.reduce((m, s) => { if (pass(s, skip)) { const k = f(s); m[k] = (m[k] || 0) + 1; } return m; }, {});

    const FNAME = { sgg: '지역', cat: '업종', kind: '종류' };
    const chipRow = (name, items, current, lead = '') => `<div class="py-frow"><span class="py-flabel" aria-hidden="true">${FNAME[name]}</span><div class="py-chiprow" data-f="${name}" role="group" aria-label="${FNAME[name]}">${lead}${items.map(([v, label, n]) =>
      `<button type="button" class="py-chip" data-v="${esc(v)}" aria-pressed="${v === current}">${esc(label)}${n != null ? `<span>${num(n)}</span>` : ''}</button>`).join('')}</div></div>`;
    const TONE = { '음식': 2, '소매': 1, '수리·개인': 3, '생활서비스': 3, '교육': 4, '예술·스포츠': 5, '숙박': 5, '보건의료': 4, '부동산': 4, '과학·기술': 4, '시설관리·임대': 4 };
    const catTile = (s) => {
      const c = s.cat || '';
      const t = c ? (c === '수리·개인' ? '생활' : c.replace(/·.*/, '').slice(0, 2)) : '?';
      return `<span class="tile${c ? '' : ' py-unk'}" data-tone="${TONE[c] || 1}" data-len="${t.length}" aria-hidden="true">${esc(t)}</span>`;
    };
    const mapUrl = (s) => 'https://map.naver.com/p/search/' + encodeURIComponent(s.addr ? `${s.name} ${s.addr}` : `${s.name} ${s.market}`);

    function render() {
      const sido = meta.sidos.find((s) => s.id === state.sido);
      // 결제 조합 탭
      const comboN = count('combo', (s) => 'all');
      const progN = {};
      for (const s of rows) if (pass(s, 'combo')) for (const p of new Set(s.brands.map((b) => b.program))) progN[p] = (progN[p] || 0) + 1;
      $('combo').innerHTML = [['all', '온누리 전체', comboN.all || 0], ...programs.map((p) => [p.id, `+ ${p.short || p.name}`, progN[p.id] || 0])]
        .map(([id, label, n]) => `<button type="button" role="tab" data-id="${id}" aria-selected="${id === state.combo}">${esc(label)}<span>${num(n)}</span></button>`).join('');
      const prog = programs.find((p) => p.id === state.combo);
      $('note').hidden = !prog;
      if (prog) $('note').innerHTML = `상호에 ${esc(prog.short || prog.name)} 브랜드가 들어간 가맹점 · 매장마다 다를 수 있어 지도에서 확인 · <a href="brands.html#${prog.id}">브랜드 목록</a>`;

      // 필터 (지역은 시도 고르기 + 시군구, 업종, 상품권 종류)
      const sggN = count('sgg', (s) => s.sgg);
      const sel = `<label class="py-sido"><select id="py-sido" aria-label="시도">${meta.sidos.map((s) => `<option value="${s.id}"${s.id === state.sido ? ' selected' : ''}>${esc(s.name)} ${num(s.count)}</option>`).join('')}</select></label>`;
      const sggs = (sido ? sido.sigungu : []).map((g) => [g.name, g.name, sggN[g.name] || 0]).filter(([, , n]) => n || state.sgg !== 'all');
      const catN = count('cat', (s) => s.cat || '미확인');
      const cats = Object.entries(catN).sort((a, b) => (a[0] === '미확인') - (b[0] === '미확인') || b[1] - a[1]);
      const kindN = { all: 0, paper: 0, digital: 0 };
      for (const s of rows) if (pass(s, 'kind')) { kindN.all++; if (s.paper) kindN.paper++; if (s.digital) kindN.digital++; }
      $('filters').innerHTML =
        chipRow('sgg', [['all', '전체', null], ...sggs], state.sgg, sel) +
        chipRow('cat', [['all', '전체', null], ...cats.map(([k, n]) => [k, k === '미확인' ? '업종 미확인' : k, n])], state.cat) +
        chipRow('kind', [['all', '전체', kindN.all], ['paper', '지류(종이)', kindN.paper], ['digital', '디지털(카드·모바일)', kindN.digital]], state.kind);

      // 목록
      const list = rows.filter((s) => pass(s));
      if (prog) list.sort((a, b) => (statusRank(a, prog.id) - statusRank(b, prog.id)));
      const shown = list.slice(0, state.limit);
      const head = `<div class="wl-block-head">${esc(sido ? sido.name : '')}${state.sgg !== 'all' ? ' ' + esc(state.sgg) : ''}${state.cat !== 'all' ? ' · ' + esc(state.cat === '미확인' ? '업종 미확인' : state.cat) : ''}<span>${num(list.length)}곳</span></div>`;
      const empty = prog ? `이 조건에서 ${esc(prog.name)} 브랜드 매장은 아직 없어요. <a href="brands.html#${prog.id}">브랜드 목록 보기</a>` : '조건에 맞는 가맹점이 없어요.';
      $('list').innerHTML = head + (list.length ? `<div class="wl-rows">${shown.map(row).join('')}</div>` +
        (list.length > shown.length ? `<button type="button" class="py-more" data-more="1">${num(Math.min(50, list.length - shown.length))}곳 더 보기 <span>(남은 ${num(list.length - shown.length)}곳)</span></button>` : '')
        : `<div class="wl-rows"><p class="wl-empty">${empty}</p></div>`);
    }
    const statusRank = (s, pid) => Math.min(...s.brands.filter((b) => b.program === pid).map((b) => ({ ok: 0, part: 1, plan: 2 }[STATUS[b.status]] ?? 3)), 9);

    function row(s) {
      const tags = [];
      if (s.paper) tags.push('<span>지류</span>');
      if (s.digital) tags.push('<span>디지털</span>');
      for (const b of s.brands) tags.push(`<span class="py-b ${STATUS[b.status] || ''}" title="${esc(b.name)} · ${esc(b.scope || '')}">${esc(SHORT[b.program] || b.program)} ${esc(b.status)}</span>`);
      return `<article class="wl-row py-row">
        ${catTile(s)}
        <div class="py-body">
          <div class="py-name"><b>${esc(s.name)}</b>${s.biz ? `<small>${esc(s.biz)}</small>` : s.inf ? '<small>업종 추정</small>' : ''}</div>
          <div class="py-addr">${s.market ? `<em>${esc(s.market)}</em>${s.short ? ' · ' : ''}` : ''}${esc(s.short)}</div>
          ${s.goods ? `<div class="py-goods">${esc(s.goods)}</div>` : ''}
          <div class="py-tags">${tags.join('')}</div>
        </div>
        <a class="py-map" href="${esc(mapUrl(s))}" target="_blank" rel="noopener" aria-label="${esc(s.name)} 지도에서 보기">지도</a>
      </article>`;
    }

    async function setSido(id) {
      state.sido = id; state.sgg = 'all'; state.cat = 'all'; state.limit = 50;
      store.set('mrpay.sido', id);
      $('list').innerHTML = '<div class="wl-rows"><p class="wl-empty" role="status">불러오는 중…</p></div>';
      try { rows = await loadSido(id); } catch (e) { rows = []; $('list').innerHTML = '<div class="wl-rows"><p class="wl-empty">이 지역 가맹점을 불러오지 못했어요.</p></div>'; return; }
      render();
    }

    $('combo').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-id]');
      if (!b) return;
      state.combo = b.dataset.id; state.limit = 50;
      history.replaceState(null, '', state.combo === 'all' ? location.pathname : '#' + state.combo);
      render();
    });
    $('filters').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      state[b.closest('[data-f]').dataset.f] = b.dataset.v;
      state.limit = 50;
      render();
    });
    $('filters').addEventListener('change', (e) => { if (e.target.id === 'py-sido') setSido(e.target.value); });
    $('list').addEventListener('click', (e) => { if (e.target.closest('[data-more]')) { state.limit += 50; render(); } });
    let t;
    $('q').addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = e.target.value.split(/\s+/).map(norm).filter(Boolean); state.limit = 50; render(); }, 150);
    });
    window.addEventListener('hashchange', () => { state.combo = hashCombo(); render(); });
    await setSido(state.sido);
  }

  // ======================= 브랜드 =======================
  async function brandsPage() {
    const [meta, bdata] = await Promise.all([loadMeta(), loadBrands()]);
    const programs = bdata.programs || [], brands = bdata.brands || [];
    const nb = brands.filter((b) => b.kind === 'brand').length, np = brands.length - nb;
    $('sub').textContent = `브랜드 ${nb}개 · 장소 ${np}곳${bdata.checked ? ` · ${ymd(bdata.checked)} 확인` : ''}`;
    const ORDER = { '됨': 0, '일부': 1, '예정': 2 };
    $('brands').innerHTML = programs.map((p) => {
      const list = brands.filter((b) => b.program === p.id).sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3) || (a.kind === 'place') - (b.kind === 'place'));
      return `<section class="py-prog" id="${esc(p.id)}">
        <h2>${esc(p.name)}</h2>
        <dl class="py-facts">
          <div><dt>결제</dt><dd>${esc(p.how)}</dd></div>
          <div><dt>매장 찾기</dt><dd>${esc(p.find)}${p.url ? ` · <a href="${esc(p.url)}" target="_blank" rel="noopener">공식 안내 ↗</a>` : ''}</dd></div>
        </dl>
        ${list.length ? `<div class="wl-rows">${list.map((b) => `<article class="wl-row py-brow">
          <span class="tile" data-tone="${b.kind === 'place' ? 3 : p.id === 'toss' ? 1 : 3}" data-len="${Math.min(4, b.name.slice(0, 2).length)}" aria-hidden="true">${esc(b.kind === 'place' ? '장소' : b.name.slice(0, 2))}</span>
          <div class="py-body">
            <div class="py-name"><b>${esc(b.name)}</b><small>${esc(b.cat || '')}</small></div>
            <div class="py-addr">${[b.method, b.scope, b.date].filter(Boolean).map(esc).join(' · ')}</div>
          </div>
          <div class="py-side">
            <span class="py-st ${STATUS[b.status] || ''}">${esc(b.status)}</span>
            ${b.src ? `<a href="${esc(b.src)}" target="_blank" rel="noopener" title="${esc(b.srcTitle || '출처')}">출처 ↗</a>` : ''}
          </div>
        </article>`).join('')}</div>` : '<div class="wl-rows"><p class="wl-empty">정리된 브랜드가 아직 없어요.</p></div>'}
        ${list.some((b) => b.kind === 'brand') ? `<a class="py-go" href="./#${esc(p.id)}">온누리 가맹점 중 이 브랜드 매장 보기 →</a>` : ''}
      </section>`;
    }).join('') || '<div class="wl-rows"><p class="wl-empty">브랜드 목록 준비 중이에요.</p></div>';
    $('foot').innerHTML = '매장 단위 공개 목록이 없어 공식 발표·보도된 브랜드·장소만 모았어요(됨·일부·예정) · 매월 초 확인' + (meta ? ' · ' + sourcesLine(meta) : '');
    if (location.hash) { const el = document.getElementById(location.hash.slice(1)); el && el.scrollIntoView(); }
  }

  const run = page === 'stores' ? storesPage : page === 'brands' ? brandsPage : null;
  if (run) run().catch((e) => { console.error(e); const l = $('list') || $('brands'); if (l) l.innerHTML = '<div class="wl-rows"><p class="wl-empty">불러오지 못했어요. 새로고침해 주세요.</p></div>'; });
})();
