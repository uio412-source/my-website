// Mr. Hotels 발레파킹 — ① 가진 카드 고르기 → ② 카드마다 지난달 실적 채웠는지 체크 → 무료 발레 되는 호텔
// 데이터: hotels/valet.json(카드사 공식 안내 정리). 판정: valet-rules.js (Mr. Cards와 공유)
import {valetStatus, valetDate, valetQuota} from './valet-rules.js';

const $ = (id) => document.getElementById('hv-' + id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const ko = new Intl.Collator('ko');
const day = valetDate();
const SAVE = 'mrhotels.valet.v2';           // {카드키: {brand: 브랜드|'', met: true|false}}
const OLD_SAVE = 'mrhotels.valet.cards';     // 예전 화면: ['프로그램id:카드key', …]
const OLD_MET = 'mrhotels.valet.spendMet';
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 화면에서만 유지 */ } },
};
const won = (n) => (n >= 10000 ? `${n / 10000}만원` : `${n.toLocaleString()}원`);
const ISSUER = {'신한카드': ['신한', 1], '현대카드': ['현대', 5], '하나카드': ['하나', 3], '삼성카드': ['삼성', 1], 'KB국민카드': ['KB', 4], '우리카드': ['우리', 1], '롯데카드': ['롯데', 2], 'BC카드': ['BC', 2], 'NH농협카드': ['NH', 3]};
const tile = (issuer) => { const [a, t] = ISSUER[issuer] || [issuer.slice(0, 2), 1]; return `<span class="tile sm" data-tone="${t}" data-len="${a.length}" aria-hidden="true">${esc(a)}</span>`; };
const short = (name) => name.replace(/^(신한카드|하나카드|현대) /, '');
const brandShort = (b) => b.replace(/^American Express /, '아멕스 ').replace('Mastercard', 'Master');

let data, cards = [], byKey = {};
let mine = {};          // 카드키 → {brand, met}
let issuer = '';
let gu = '';
let open = new URLSearchParams(location.search).get('hotel') || '';
let q = '', cq = '';

// ---------- 카드 묶기: 같은 카드가 브랜드별 안내(프로그램) 여러 개에 나옴 ----------
function buildCards() {
  const m = new Map();
  for (const program of data.programs) for (const c of program.cards) {
    const key = program.issuer + '|' + c.name;
    if (!m.has(key)) m.set(key, {key, name: c.name, issuer: program.issuer, catalogId: c.catalogId, programs: [], refs: []});
    const card = m.get(key);
    card.programs.push(program);
    card.refs.push(program.id + ':' + c.key);
    card.catalogId ||= c.catalogId;
  }
  cards = [...m.values()].sort((a, b) => ko.compare(a.issuer, b.issuer) || ko.compare(short(a.name), short(b.name)));
  for (const c of cards) c.brands = [...new Set(c.programs.map((p) => p.brand))];
  byKey = Object.fromEntries(cards.map((c) => [c.key, c]));
}
const isClosed = (h) => h.closure && h.closure.from <= day;
const progsOf = (c, sel = mine[c.key]) => c.programs.filter((p) => !sel?.brand || p.brand === sel.brand);
const hotelCount = (c) => data.hotels.filter((h) => !isClosed(h) && progsOf(c, {}).some((p) => valetStatus(p, h, day) === 'available')).length;

/** 이 호텔에서 카드 한 장의 상태: ok(바로 가능) · spend(실적 채우면) · check(조건 확인 중) · null */
function cardAt(c, h, sel = mine[c.key]) {
  const ps = progsOf(c, sel).map((p) => ({p, st: valetStatus(p, h, day)})).filter((x) => x.st === 'available' || x.st === 'expired');
  if (!ps.length) return null;
  const live = ps.filter((x) => x.st === 'available');
  if (!live.length) return {state: 'check', p: ps[0].p};
  const free = live.find((x) => !x.p.minimumSpend);
  if (free) return {state: 'ok', p: free.p};
  // 브랜드를 정하지 않았으면 실적 조건이 가장 낮은 안내 기준
  const p = live.sort((a, b) => a.p.minimumSpend - b.p.minimumSpend || b.p.monthlyLimit - a.p.monthlyLimit)[0].p;
  return {state: sel?.met === false ? 'spend' : 'ok', p};
}
const RANK = {ok: 0, spend: 1, check: 2};

function save() { store.set(SAVE, mine); }
function toggleCard(key) {
  if (mine[key]) delete mine[key];
  else mine[key] = {brand: byKey[key].brands.length === 1 ? byKey[key].brands[0] : '', met: true};
  save(); renderAll();
}

// ---------- ① 카드 고르기 ----------
let showAll = false;
function renderPick() {
  const issuers = [...new Set(cards.map((c) => c.issuer))];
  if (!issuer || !issuers.includes(issuer)) issuer = issuers[0];
  const picked = Object.keys(mine).length;
  $('pick-c').textContent = picked ? `${picked}장 선택` : '';
  const terms = norm(cq);
  $('iss').innerHTML = terms ? '' : issuers.map((i) => {
    const n = cards.filter((c) => c.issuer === i && mine[c.key]).length;
    return `<button type="button" role="tab" aria-selected="${i === issuer}" data-iss="${esc(i)}">${tile(i)}${esc(i.replace(/카드$/, ''))}${n ? `<b>${n}</b>` : ''}</button>`;
  }).join('');
  const found = cards.filter((c) => terms ? norm(`${c.name} ${c.issuer} ${c.brands.join(' ')}`).includes(terms) : c.issuer === issuer);
  // 카드가 많으면(신한 36종 등) 화면이 카드 목록으로만 꽉 차서 결과가 안 보임 → 고른 카드 먼저 + 8개만, 나머지는 펼치기
  const LIMIT = 8;
  const sorted = [...found.filter((c) => mine[c.key]), ...found.filter((c) => !mine[c.key])];
  const list = terms || showAll || sorted.length <= LIMIT + 2 ? sorted : sorted.slice(0, Math.max(LIMIT, sorted.filter((c) => mine[c.key]).length));
  const rest = sorted.length - list.length;
  $('cards').innerHTML = (list.length ? list.map((c) => {
    const on = !!mine[c.key];
    return `<button type="button" class="hv-card${on ? ' on' : ''}" aria-pressed="${on}" data-card="${esc(c.key)}">
      <span class="hv-check" aria-hidden="true">${on ? '✓' : ''}</span>
      <span class="hv-card-t"><b>${esc(short(c.name))}</b><small>${terms ? esc(c.issuer.replace(/카드$/, '')) + ' · ' : ''}서울 ${hotelCount(c)}곳</small></span></button>`;
  }).join('') : '<p class="wl-empty">찾는 카드가 없어요. 아래 목록에서 카드사 공식 안내를 확인해 주세요.</p>')
    + (rest > 0 ? `<button type="button" class="hv-more" data-act="all">${esc(issuer.replace(/카드$/, ''))} 카드 ${rest}종 더 보기</button>`
      : showAll && !terms && sorted.length > LIMIT + 2 ? '<button type="button" class="hv-more" data-act="fold">접기</button>' : '');
  const pend = data.pending || [];
  $('pend').innerHTML = pend.length ? `제휴 호텔 확인 중: ${pend.map((p) => esc(p.name)).join(', ')}` : '';
}

// ---------- ② 실적 체크 ----------
function renderMine() {
  const list = cards.filter((c) => mine[c.key]);
  $('mine-box').hidden = !list.length;
  $('res-n').textContent = list.length ? '3' : '2';
  $('mine').innerHTML = list.map((c) => {
    const sel = mine[c.key];
    const ps = progsOf(c);
    const need = Math.min(...ps.map((p) => p.minimumSpend || 0));
    const grace = ps.find((p) => p.grace)?.grace;
    return `<li class="hv-m" data-key="${esc(c.key)}">
      <div class="hv-m-top">${tile(c.issuer)}<span class="hv-m-name"><b>${esc(short(c.name))}</b>
        <small>${need ? `전월 ${won(need)} 이상 써야 무료` : '실적 조건 없음'}</small></span>
        <button type="button" class="hv-x" data-remove="${esc(c.key)}" aria-label="${esc(short(c.name))} 빼기">×</button></div>
      <div class="hv-m-ctl">
        ${need ? `<div class="hv-seg" role="group" aria-label="지난달 실적">
          <button type="button" data-met="1" aria-pressed="${sel.met !== false}">채웠어요</button>
          <button type="button" data-met="0" aria-pressed="${sel.met === false}">못 채웠어요</button></div>` : ''}
        ${c.brands.length > 1 ? `<label class="hv-brand"><span>카드 브랜드</span><select data-brand>
          <option value="">모름</option>${c.brands.map((b) => `<option value="${esc(b)}"${sel.brand === b ? ' selected' : ''}>${esc(brandShort(b))}</option>`).join('')}</select></label>` : `<span class="hv-brand1">${esc(brandShort(c.brands[0]))}</span>`}
      </div>
      ${need && sel.met === false && grace ? '<p class="hv-m-tip">새로 발급한 카드라면 다음 달 말까지는 실적 없이 돼요.</p>' : ''}
    </li>`;
  }).join('');
}

// ---------- 결과 ----------
function rowsFor() {
  const list = cards.filter((c) => mine[c.key]);
  return data.hotels.map((h) => {
    const closed = isClosed(h);
    const mineAt = list.map((c) => ({c, r: cardAt(c, h)})).filter((x) => x.r).sort((a, b) => RANK[a.r.state] - RANK[b.r.state]);
    const any = cards.filter((c) => cardAt(c, h, {}));
    const best = mineAt[0]?.r.state || null;
    return {h, closed, mineAt, any, best};
  }).filter((r) => r.closed || r.any.length);
}
function renderResult() {
  const has = Object.keys(mine).length > 0;
  const only = has && $('only').checked;
  $('only-box').hidden = !has;
  const all = rowsFor();
  const ok = all.filter((r) => !r.closed && r.best === 'ok').length;
  const spend = all.filter((r) => !r.closed && r.best === 'spend').length;
  $('summary').innerHTML = has
    ? `<div class="hv-big"><b>${ok}</b><span>곳에서 지금 무료 발레 가능</span></div>${spend ? `<p>지난달 실적을 채우면 <b>${spend}곳</b> 더 돼요.</p>` : ok ? '' : '<p>고른 카드로는 서울 제휴 호텔이 없어요.</p>'}`
    : `<p class="hv-hint">카드를 고르면 되는 호텔만 보여요 · 지금은 전체 ${all.filter((r) => !r.closed).length}곳</p>`;
  // 구 필터 (되는 곳만 볼 때는 되는 곳 수)
  const visible = all.filter((r) => !only || (!r.closed && r.best && r.best !== 'check'));
  const counts = {};
  for (const r of visible) counts[r.h.district] = (counts[r.h.district] || 0) + 1;
  if (gu && !counts[gu]) gu = '';
  $('gus').innerHTML = [['', '전체', visible.length], ...Object.entries(counts).sort((a, b) => b[1] - a[1] || ko.compare(a[0], b[0])).map(([g, n]) => [g, g, n])]
    .map(([g, t, n]) => `<button type="button" data-gu="${esc(g)}" aria-pressed="${g === gu}">${esc(t)} <small>${n}</small></button>`).join('');
  const terms = norm(q);
  const rows = visible.filter((r) => (!gu || r.h.district === gu) && (!terms || norm([r.h.name, r.h.district, ...(r.h.aliases || [])].join(' ')).includes(terms)));
  rows.sort((a, b) => (a.closed - b.closed) || ((RANK[a.best] ?? 9) - (RANK[b.best] ?? 9)) || (b.any.length - a.any.length) || ko.compare(a.h.name, b.h.name));
  $('hotels').innerHTML = rows.length ? rows.map((r) => row(r, has)).join('') : `<p class="wl-empty">${only ? '조건에 맞는 호텔이 없어요. ‘되는 곳만’을 끄면 전체를 볼 수 있어요.' : '조건에 맞는 호텔이 없어요.'}</p>`;
}

const STATE = {
  ok: ['ok', '가능'],
  spend: ['warn', '실적 채우면'],
  check: ['off', '조건 확인 중'],
};
function row(r, has) {
  const {h, closed, mineAt, any, best} = r;
  let pill, line = '';
  if (closed) pill = '<span class="hv-pill off">휴업</span>';
  else if (has) {
    pill = best ? `<span class="hv-pill ${STATE[best][0]}">${STATE[best][1]}</span>` : '<span class="hv-pill off">내 카드 안 됨</span>';
    const top = mineAt[0];
    if (top) line = `${esc(short(top.c.name))} · ${esc(top.r.p.parking.replace(/ · 초과 유료$/, ''))}`;
  } else {
    pill = `<span class="hv-pill">카드 ${any.length}종</span>`;
  }
  const isOpen = open === h.id;
  return `<div class="hv-hotel${isOpen ? ' open' : ''}${closed || (has && !best) ? ' dim' : ''}" data-id="${esc(h.id)}">
    <button type="button" class="hv-hrow" aria-expanded="${isOpen}" data-act="hotel">
      <span class="hv-hname"><b>${esc(h.name)}</b><small>${esc(h.district)}${line ? ' · ' + line : ''}</small></span>${pill}
      <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    ${isOpen ? detail(r, has) : ''}
  </div>`;
}

function terms(p, h) {
  const o = p.hotelOverrides?.[h.id];
  return `<dl class="hv-dl">
    <div><dt>무료</dt><dd>${esc(p.parking)}</dd></div>
    <div><dt>횟수</dt><dd>${esc(valetQuota(p, h))}${p.familyQuota ? ' · 가족카드 합산' : ''}</dd></div>
    <div><dt>조건</dt><dd>${esc(p.visit)}</dd></div>
    <div><dt>보여줄 것</dt><dd>${esc(p.proof)}</dd></div>
    ${p.minimumSpend ? `<div><dt>실적</dt><dd>${esc(p.spendScope)} ${won(p.minimumSpend)} 이상</dd></div>` : ''}
    ${o?.note ? `<div><dt>주의</dt><dd>${esc(o.note)}</dd></div>` : ''}
  </dl><a class="hv-src" href="${esc(p.source)}" target="_blank" rel="noopener">${esc(p.issuer)} 공식 안내 ↗</a>`;
}
function detail({h, closed, mineAt, any}, has) {
  if (closed) return `<div class="hv-detail"><p class="hv-closed">${esc(h.closure.note)} <a href="${esc(h.closure.source)}" target="_blank" rel="noopener">공지 ↗</a></p></div>`;
  const note = h.note ? `<p class="hv-hnote">${esc(h.note)}</p>` : '';
  const mineHtml = mineAt.map(({c, r}) => `<li class="hv-cl ${STATE[r.state][0]}">
    <div class="hv-cl-top">${tile(c.issuer)}<b>${esc(short(c.name))}</b><small>${esc(brandShort(r.p.brand))}</small><span class="hv-st ${STATE[r.state][0]}">${r.state === 'spend' ? `전월 ${won(r.p.minimumSpend)} 채우면` : STATE[r.state][1]}</span></div>
    ${terms(r.p, h)}</li>`).join('');
  const others = any.filter((c) => !mine[c.key]);
  const othersHtml = others.length ? `<div class="hv-dh">${has ? '다른 카드' : '이 호텔에서 되는 카드'} <small>내 카드면 눌러서 고르세요</small></div>
    <div class="hv-addchips">${others.map((c) => `<button type="button" class="hv-add" data-card="${esc(c.key)}">+ ${esc(short(c.name))}</button>`).join('')}</div>` : '';
  return `<div class="hv-detail">${note}
    ${mineHtml ? `<ul class="hv-cls">${mineHtml}</ul>` : has ? '<p class="hv-none">고른 카드로는 이 호텔 무료 발레가 안 돼요.</p>' : ''}
    ${othersHtml}</div>`;
}

function renderAll() { renderPick(); renderMine(); renderResult(); }

// ---------- 이벤트 ----------
document.addEventListener('click', (e) => {
  const t = e.target;
  const iss = t.closest('[data-iss]');
  if (iss) { issuer = iss.dataset.iss; showAll = false; renderPick(); return; }
  if (t.closest('[data-act="all"]')) { showAll = true; renderPick(); return; }
  if (t.closest('[data-act="fold"]')) { showAll = false; renderPick(); return; }
  const card = t.closest('[data-card]');
  if (card) { toggleCard(card.dataset.card); return; }
  const rm = t.closest('[data-remove]');
  if (rm) { delete mine[rm.dataset.remove]; save(); renderAll(); return; }
  const metBtn = t.closest('[data-met]');
  if (metBtn) { mine[metBtn.closest('.hv-m').dataset.key].met = metBtn.dataset.met === '1'; save(); renderMine(); renderResult(); return; }
  const g = t.closest('[data-gu]');
  if (g) { gu = g.dataset.gu; renderResult(); return; }
  if (t.closest('[data-act="hotel"]')) {
    const id = t.closest('.hv-hotel').dataset.id;
    open = open === id ? '' : id;
    renderResult();
  }
});
document.addEventListener('change', (e) => {
  if (e.target.matches('[data-brand]')) { mine[e.target.closest('.hv-m').dataset.key].brand = e.target.value; save(); renderMine(); renderResult(); }
});
$('only').addEventListener('change', renderResult);
let timer;
$('q').addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => { q = e.target.value; renderResult(); }, 120); });
$('cq').addEventListener('input', (e) => { cq = e.target.value; renderPick(); });

async function load() {
  data = await MS.getJSON('valet.json');
  buildCards();
  mine = store.get(SAVE, null);
  if (!mine) { // 예전 '보유 카드 등록' 저장값 옮기기
    mine = {};
    const met = store.get(OLD_MET, true);
    for (const ref of store.get(OLD_SAVE, [])) { const c = cards.find((x) => x.refs.includes(ref)); if (c) mine[c.key] = {brand: '', met}; }
  }
  for (const k of Object.keys(mine)) if (!byKey[k]) delete mine[k];
  // Mr. Cards에서 ?card=카드ID(또는 프로그램id:카드key)로 넘어오면 그 카드를 골라 둠
  const want = new URLSearchParams(location.search).get('card');
  if (want) for (const c of cards) if (c.catalogId === want || c.refs.includes(want)) {
    const prog = want.includes(':') ? c.programs[c.refs.indexOf(want)] : null;
    mine[c.key] = {brand: prog ? prog.brand : (c.brands.length === 1 ? c.brands[0] : ''), met: mine[c.key]?.met ?? true};
    issuer = c.issuer;
  }
  if (!issuer && Object.keys(mine).length) issuer = byKey[Object.keys(mine)[0]].issuer;
  save();
  if (open && !data.hotels.some((h) => h.id === open)) open = '';
  if (open) $('only').checked = false;
  $('sub').textContent = `서울 호텔 ${data.hotels.length}곳 · 카드 ${cards.length}종 · 카드사 공식 안내 ${data.updatedAt.slice(2).replace(/-/g, '.')} 확인`;
  $('note').textContent = '카드사 공식 안내(상품설명서·혜택 안내)에 나온 서울 제휴 호텔만 정리했어요. 무료 시간·횟수는 카드사 기준이고, 만차·행사 때는 호텔 사정으로 제한될 수 있어요. 고른 카드와 실적 체크는 이 브라우저에만 저장돼요.';
  renderAll();
  if (open) document.querySelector(`.hv-hotel[data-id="${CSS.escape(open)}"]`)?.scrollIntoView({block: 'center'});
}
const onError = () => { $('hotels').innerHTML = '<p class="wl-empty">불러오지 못했습니다. 새로고침해 주세요.</p>'; };
window.addEventListener('datarefresh', (e) => e.detail.tasks.push(load().catch(onError)));
load().catch(onError);
