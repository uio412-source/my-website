// Mr. Hotels 발레파킹 — ① 가진 카드 고르기 → ② 카드마다 지난달 실적 채웠는지 체크 → 무료 발레 되는 호텔(지도 + 목록)
// 데이터: hotels/valet.json(카드사 공식 안내 정리), 지도 바탕: hotels/map.json(서울 구 경계·강, 호텔 지도와 같은 투영)
// 판정: valet-rules.js (Mr. Cards와 공유)
import {valetStatus, valetDate, valetQuota, valetExtra, valetNoUse} from './valet-rules.js';

const $ = (id) => document.getElementById('hv-' + id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const ko = new Intl.Collator('ko');
const day = valetDate();
const SAVE = 'mrhotels.valet.v2';           // {카드키: {brand: 브랜드|'', met: true|false}}
const OLD_SAVE = 'mrhotels.valet.cards';     // 예전 화면: ['프로그램id:카드key', …]
const OLD_MET = 'mrhotels.valet.spendMet';
const CLEAN_SAVE = 'mrhotels.valet.clean';   // '조건 없이 무료만' 스위치
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 화면에서만 유지 */ } },
};
const won = (n) => (n >= 10000 ? `${n / 10000}만원` : `${n.toLocaleString()}원`);
const ISSUER = {'신한카드': ['신한', 1], '현대카드': ['현대', 5], '하나카드': ['하나', 3], '삼성카드': ['삼성', 1], 'KB국민카드': ['KB', 4], '우리카드': ['우리', 1], '롯데카드': ['롯데', 2], 'BC카드': ['BC', 2], 'NH농협카드': ['NH', 3]};
const tile = (issuer) => { const [a, t] = ISSUER[issuer] || [issuer.slice(0, 2), 1]; return `<span class="tile sm" data-tone="${t}" data-len="${a.length}" aria-hidden="true">${esc(a)}</span>`; };
const short = (name) => name.replace(/^(신한카드|하나카드|현대) /, '');
const brandShort = (b) => b.replace(/^American Express /, '아멕스 ').replace('Mastercard', 'Master');
const parkShort = (p) => p.parking.replace(/ · 초과 유료$/, '');

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
// directory.json은 closedFrom, valet.json은 closure.from을 씁니다 — 둘 다 읽어 휴업 호텔을 같은 기준으로 뺌
const closedFrom = (h) => h.closedFrom || h.closure?.from || '';
const isClosed = (h) => !!closedFrom(h) && closedFrom(h) <= day;
const progsOf = (c, sel = mine[c.key]) => c.programs.filter((p) => !sel?.brand || p.brand === sel.brand);
const hotelCount = (c) => data.hotels.filter((h) => !isClosed(h) && progsOf(c, {}).some((p) => valetStatus(p, h, day) === 'available')).length;

/**
 * 이 호텔에서 카드 한 장의 상태: ok(바로 가능) · spend(실적 채우면) · check(조건 확인 중) · null
 * extra: 실적 말고 이 호텔에만 붙는 조건(당일 ○만원 이상 영수증 등, valet-rules.js valetExtra)
 * free: 안내문에 호텔 이용 없이 무료라고 적힌 경우(valetNoUse)
 */
function cardAt(c, h, sel = mine[c.key]) {
  const ps = progsOf(c, sel).map((p) => ({p, st: valetStatus(p, h, day)})).filter((x) => x.st === 'available' || x.st === 'expired');
  if (!ps.length) return null;
  const live = ps.filter((x) => x.st === 'available').map((x) => x.p);
  if (!live.length) return {state: 'check', p: ps[0].p, extra: ''};
  const met = (p) => !p.minimumSpend || sel?.met !== false;
  const cost = (p) => (met(p) ? 0 : 4) + (valetExtra(p, h) ? 2 : 0) + (valetNoUse(p) ? 0 : 1);
  // 브랜드를 정하지 않았으면 조건이 가장 적은 안내 기준(실적 → 영수증 금액 → 호텔 이용 → 실적 금액 → 횟수 순)
  const p = live.sort((a, b) => cost(a) - cost(b) || (a.minimumSpend || 0) - (b.minimumSpend || 0) || (b.monthlyLimit ?? 99) - (a.monthlyLimit ?? 99))[0];
  return {state: met(p) ? 'ok' : 'spend', p, extra: valetExtra(p, h), free: valetNoUse(p) && !valetExtra(p, h)};
}
/** clean(안내문상 조건 없이 무료) · use(당일 투숙·식음료 이용 시 무료) · cond(이용 + 영수증 금액 조건) · spend · check */
const kindOf = (r) => (!r ? null : r.state === 'ok' ? (r.free ? 'clean' : r.extra ? 'cond' : 'use') : r.state);
const RANK = {clean: 0, use: 1, cond: 2, spend: 3, check: 4};

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
    const mineAt = list.map((c) => ({c, r: cardAt(c, h)})).filter((x) => x.r).sort((a, b) => RANK[kindOf(a.r)] - RANK[kindOf(b.r)]);
    const any = cards.filter((c) => cardAt(c, h, {}));
    const best = kindOf(mineAt[0]?.r);
    return {h, closed, mineAt, any, best};
  }).filter((r) => !r.closed && r.any.length); // 휴업 호텔은 발레 목록·숫자에서 뺌
}
const hasCards = () => Object.keys(mine).length > 0;
const cleanOn = () => hasCards() && $('clean').checked;
/** 스위치·검색까지 거른 호텔(구 필터 전). 지도는 이걸 그대로, 목록은 구까지 거름 */
function filtered(all) {
  const has = hasCards(), clean = cleanOn(), only = has && ($('only').checked || clean);
  const terms = norm(q);
  return all.filter((r) => (!only || (!r.closed && (clean ? r.best === 'clean' : r.best && r.best !== 'check')))
    && (!terms || norm([r.h.name, r.h.district, ...(r.h.aliases || [])].join(' ')).includes(terms)));
}
let rowsNow = [];
function renderResult() {
  const has = hasCards();
  const clean = cleanOn();
  $('switches').hidden = !has;
  $('only').disabled = clean;
  $('only-box').classList.toggle('off', clean);
  const all = rowsFor();
  const live = all.filter((r) => !r.closed);
  const n = (k) => live.filter((r) => r.best === k).length;
  const [nClean, nUse, nCond, nSpend] = [n('clean'), n('use'), n('cond'), n('spend')];
  const nOk = nClean + nUse + nCond;
  $('summary').innerHTML = has
    ? `<div class="hv-big"><b>${clean ? nClean : nOk}</b><span>${clean ? '곳에서 조건 없이 무료 발레' : '곳에서 무료 발레 가능'}</span></div>`
      + (clean
        ? (nClean ? '' : `<p>상품설명서상 호텔을 이용하지 않아도 무료인 곳은 없어요. 고른 카드는 모두 당일 투숙이나 식음료 매장을 이용해야 무료예요${nOk ? ` (이용 시 무료 <b>${nOk}곳</b>)` : ''}.</p>`)
        : (nOk ? `<p>${nClean ? `조건 없이 무료 <b>${nClean}곳</b> · ` : ''}당일 투숙·식음료 이용 시 무료 <b>${nUse + nCond}곳</b>${nCond ? ` (그중 ${nCond}곳은 영수증 금액 조건)` : ''}</p>` : ''))
      + (nSpend && !clean ? `<p>지난달 실적을 채우면 <b>${nSpend}곳</b> 더 돼요.</p>` : nOk || nSpend ? '' : '<p>고른 카드로는 서울 제휴 호텔이 없어요.</p>')
    : `<p class="hv-hint">카드를 고르면 되는 호텔만 보여요 · 지금은 전체 ${live.length}곳</p>`;
  const visible = filtered(all);
  rowsNow = visible;
  // 구 필터 (스위치·검색 뒤 남은 호텔 수)
  const counts = {};
  for (const r of visible) counts[r.h.district] = (counts[r.h.district] || 0) + 1;
  if (gu && !counts[gu]) gu = '';
  $('gus').innerHTML = [['', '전체', visible.length], ...Object.entries(counts).sort((a, b) => b[1] - a[1] || ko.compare(a[0], b[0])).map(([g, c]) => [g, g, c])]
    .map(([g, t, c]) => `<button type="button" data-gu="${esc(g)}" aria-pressed="${g === gu}">${esc(t)} <small>${c}</small></button>`).join('');
  const rows = visible.filter((r) => !gu || r.h.district === gu);
  rows.sort((a, b) => (a.closed - b.closed) || ((RANK[a.best] ?? 9) - (RANK[b.best] ?? 9)) || (b.any.length - a.any.length) || ko.compare(a.h.name, b.h.name));
  const empty = clean ? '상품설명서 기준으로 호텔 이용 없이 무료인 곳이 없어요. ‘조건 없이 무료만’을 끄면 당일 투숙·식음료 이용 시 무료인 호텔이 보여요.'
    : $('only').checked && has ? '조건에 맞는 호텔이 없어요. ‘되는 곳만’을 끄면 전체를 볼 수 있어요.' : '조건에 맞는 호텔이 없어요.';
  $('hotels').innerHTML = rows.length ? rows.map((r) => row(r, has)).join('') : `<p class="wl-empty">${empty}</p>`;
  map.draw();
}

const STATE = {
  clean: ['ok', '조건 없이 무료'],
  use: ['ok cond', '이용 시 무료'],
  cond: ['ok cond', '금액 조건'],
  spend: ['warn', '실적 채우면'],
  check: ['off', '조건 확인 중'],
};
/** 목록 줄·지도 말풍선에 쓰는 한 줄 요약 */
function lineOf(r) {
  const top = r.mineAt[0];
  if (!top) return '';
  const how = top.r.state !== 'ok' ? parkShort(top.r.p) : top.r.extra ? top.r.extra : top.r.free ? `이용 없이 ${parkShort(top.r.p)}` : `이용 시 ${parkShort(top.r.p)}`;
  return `${short(top.c.name)} · ${how}`;
}
function pillOf(r, has) {
  if (r.closed) return '<span class="hv-pill off">휴업</span>';
  if (!has) return `<span class="hv-pill">카드 ${r.any.length}종</span>`;
  return r.best ? `<span class="hv-pill ${STATE[r.best][0]}">${STATE[r.best][1]}</span>` : '<span class="hv-pill off">내 카드 안 됨</span>';
}
function row(r, has) {
  const {h, closed, best} = r;
  const line = has && !closed ? lineOf(r) : '';
  const isOpen = open === h.id;
  return `<div class="hv-hotel${isOpen ? ' open' : ''}${closed || (has && !best) ? ' dim' : ''}" data-id="${esc(h.id)}">
    <button type="button" class="hv-hrow" aria-expanded="${isOpen}" data-act="hotel">
      <span class="hv-hname"><b>${esc(h.name)}</b><small>${esc(h.district)}${line ? ' · ' + esc(line) : ''}</small></span>${pillOf(r, has)}
      <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    ${isOpen ? detail(r, has) : ''}
  </div>`;
}

function terms(p, h, extra) {
  const o = p.hotelOverrides?.[h.id];
  const warn = [extra && !o?.note ? `${extra}이 필요할 수 있어요. 호텔에 확인하세요.` : '', o?.note || ''].filter(Boolean).join(' ');
  return `<dl class="hv-dl">
    <div><dt>무료</dt><dd>${esc(p.parking)}</dd></div>
    <div><dt>횟수</dt><dd>${esc(valetQuota(p, h))}${p.familyQuota ? ' · 가족카드 합산' : ''}</dd></div>
    <div><dt>조건</dt><dd>${esc(p.visit)}</dd></div>
    <div><dt>보여줄 것</dt><dd>${esc(p.proof)}</dd></div>
    ${p.minimumSpend ? `<div><dt>실적</dt><dd>${esc(p.spendScope)} ${won(p.minimumSpend)} 이상</dd></div>` : ''}
    ${warn ? `<div class="hv-warn"><dt>주의</dt><dd>${esc(warn)}</dd></div>` : ''}
  </dl><a class="hv-src" href="${esc(p.source)}" target="_blank" rel="noopener">${esc(p.issuer)} 공식 안내 ↗</a>`;
}
function detail({h, closed, mineAt, any}, has) {
  if (closed) return `<div class="hv-detail"><p class="hv-closed">${esc(h.closure.note)} <a href="${esc(h.closure.source)}" target="_blank" rel="noopener">공지 ↗</a></p></div>`;
  const note = h.note ? `<p class="hv-hnote">${esc(h.note)}</p>` : '';
  const mineHtml = mineAt.map(({c, r}) => {
    const k = kindOf(r);
    return `<li class="hv-cl ${STATE[k][0]}">
    <div class="hv-cl-top">${tile(c.issuer)}<b>${esc(short(c.name))}</b><small>${esc(brandShort(r.p.brand))}</small><span class="hv-st ${STATE[k][0]}">${k === 'spend' ? `전월 ${won(r.p.minimumSpend)} 채우면` : STATE[k][1]}</span></div>
    ${terms(r.p, h, r.extra)}</li>`;
  }).join('');
  const others = any.filter((c) => !mine[c.key]);
  const othersHtml = others.length ? `<div class="hv-dh">${has ? '다른 카드' : '이 호텔에서 되는 카드'} <small>내 카드면 눌러서 고르세요</small></div>
    <div class="hv-addchips">${others.map((c) => `<button type="button" class="hv-add" data-card="${esc(c.key)}">+ ${esc(short(c.name))}</button>`).join('')}</div>` : '';
  const dir = h.directory?.[0];
  const link = dir ? `<a class="hv-maplink" href="./?at=${encodeURIComponent('한국')}/${encodeURIComponent('서울')}/${encodeURIComponent(h.district)}&h=${encodeURIComponent(dir)}">호텔 지도에서 등급 혜택 보기 →</a>` : '';
  return `<div class="hv-detail">${note}
    ${mineHtml ? `<ul class="hv-cls">${mineHtml}</ul>` : has ? '<p class="hv-none">고른 카드로는 이 호텔 무료 발레가 안 돼요.</p>' : ''}
    ${othersHtml}${link}</div>`;
}

// ---------- 지도: 서울 구 경계 위에 호텔 핀 (호텔 지도와 같은 map.json·투영) ----------
const map = (() => {
  const box = $('map'), svg = $('svg'), marks = $('marks'), pop = $('pop');
  let geo = null, proj = null, guBox = {}, guC = {}, seoulBox = null, minW = 0;
  let vb = null, custom = null, sel = '', items = [], anim, lastGu = null, ready = false;
  const project = (lat, lon) => {
    let l = lon - proj.l0;
    l = (((l + 180) % 360) + 360) % 360 - 180;
    const lam = (l * Math.PI) / 180, phi = (lat * Math.PI) / 180, p2 = phi * phi, p4 = p2 * p2;
    const x = lam * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)));
    const y = phi * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
    return [proj.tx + proj.k * x, proj.ty - proj.k * y];
  };
  const bboxOf = (d) => {
    const n = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i + 1 < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]); }
    return [x0, y0, x1, y1];
  };
  const size = () => [Math.max(1, box.clientWidth), Math.max(1, box.clientHeight)];
  const fit = (b, pad = 0.1, mw = 0) => {
    const [W, H] = size(), ar = W / H;
    let w = Math.max(b[2] - b[0], mw), h = Math.max(b[3] - b[1], mw / ar);
    w *= 1 + pad * 2; h *= 1 + pad * 2;
    if (w / h < ar) w = h * ar; else h = w / ar;
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    return [cx - w / 2, cy - h / 2, w, h];
  };
  // 위치: 호텔 ll(위도·경도) → 없으면 구 가운데 둘레(새로 들어온 호텔)
  const ptCache = new Map();
  const ptOf = (h) => {
    if (ptCache.has(h.id)) return ptCache.get(h.id);
    let p;
    if (Array.isArray(h.ll)) p = project(h.ll[0], h.ll[1]);
    else {
      const c = guC[h.district] || [(seoulBox[0] + seoulBox[2]) / 2, (seoulBox[1] + seoulBox[3]) / 2];
      const i = data.hotels.filter((x) => !x.ll && x.district === h.district).indexOf(h);
      const a = i * 2.4, r = minW * 0.12 * Math.sqrt(i);
      p = [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
    }
    ptCache.set(h.id, p);
    return p;
  };
  const nameOf = (h) => {
    const s = h.name.replace(/ 서울(?= |$)/, '').replace(/^호텔 /, '').replace(/ 호텔$/, '').trim();
    return s.length > 12 ? s.slice(0, 11) + '…' : s;
  };

  function init(g) {
    geo = g;
    const C = g?.cities?.['서울'];
    if (!C || !g.proj) { box.hidden = true; return; }
    proj = g.proj;
    ptCache.clear();
    guBox = Object.fromEntries(C.gu.map((x) => [x.n, bboxOf(x.d)]));
    guC = Object.fromEntries(C.gu.map((x) => [x.n, x.c || [(guBox[x.n][0] + guBox[x.n][2]) / 2, (guBox[x.n][1] + guBox[x.n][3]) / 2]]));
    const bs = Object.values(guBox);
    seoulBox = [Math.min(...bs.map((b) => b[0])), Math.min(...bs.map((b) => b[1])), Math.max(...bs.map((b) => b[2])), Math.max(...bs.map((b) => b[3]))];
    // 가장 깊게 들어가는 폭 ≈ 2.4km
    minW = project(37.55, 127.025)[0] - project(37.55, 127)[0];
    svg.innerHTML = `${C.land ? `<path class="hm-landfill" d="${C.land}"/>` : ''}
      ${C.gu.map((x) => `<path class="hm-gu" data-n="${esc(x.n)}" d="${x.d}"><title>${esc(x.n)}</title></path>`).join('')}
      ${C.rivers ? `<path class="hm-river" d="${C.rivers}"/>` : ''}`;
    box.hidden = false;
    ready = true;
    vb = null;
  }
  const target = () => custom || (gu && guBox[gu] ? fit(guBox[gu], 0.14, minW * 1.6) : fit(seoulBox, 0.02));
  const deep = (v) => v[2] < (seoulBox[2] - seoulBox[0]) * 0.42;

  /** 화면 기준으로 핀을 모음: 겹치면 묶음(숫자), 더 확대해도 겹치는 같은 건물·단지는 둘레에 펼침 */
  function layout(v) {
    const [W, H] = size(), s = W / v[2];
    const px = (p) => [(p[0] - v[0]) * s, (p[1] - v[1]) * s];
    // 화면 밖(여유 40px) 호텔은 그리지 않음
    const shown = rowsNow.map((r) => ({r, p: ptOf(r.h)})).map((x) => ({...x, s: px(x.p)}))
      .filter((x) => x.s[0] > -40 && x.s[0] < W + 40 && x.s[1] > -40 && x.s[1] < H + 40)
      .sort((a, b) => (a.r.closed - b.r.closed) || ((RANK[a.r.best] ?? 9) - (RANK[b.r.best] ?? 9)) || (b.r.any.length - a.r.any.length));
    // 묶기: 핀 19px 안쪽은 같은 묶음, 그린 모양(핀·숫자 거품·펼친 고리)이 서로 겹치면 다시 합침
    const sMax = W / minW;
    const shape = (g) => {
      const xs = g.m.map((x) => x.p[0]), ys = g.m.map((x) => x.p[1]);
      g.b = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      g.c = [(g.b[0] + g.b[2]) / 2, (g.b[1] + g.b[3]) / 2];
      g.s = px(g.c);
      // 같은 건물·단지처럼 끝까지 확대해도 겹치거나, 이미 끝까지 확대했으면 둘레에 펼침
      g.spread = g.m.length > 1 && (Math.max(g.b[2] - g.b[0], g.b[3] - g.b[1]) * sMax < 24 || v[2] <= minW * 2.2);
      g.r = g.m.length === 1 ? 9 : g.spread ? 12 + 3 * g.m.length + 10 : 15;
      return g;
    };
    let groups = [];
    for (const it of shown) {
      const g = groups.find((x) => x.m.some((y) => Math.hypot(y.s[0] - it.s[0], y.s[1] - it.s[1]) < 19));
      if (g) g.m.push(it); else groups.push({m: [it]});
    }
    groups = groups.map(shape);
    for (let again = true; again;) {
      again = false;
      outer: for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i], b = groups[j];
        if (Math.hypot(a.s[0] - b.s[0], a.s[1] - b.s[1]) < a.r + b.r + 2) {
          a.m.push(...b.m); groups.splice(j, 1); shape(a); again = true; break outer;
        }
      }
    }
    const out = [];
    for (const g of groups) {
      if (g.m.length === 1) { out.push({kind: 'pin', ...g.m[0]}); continue; }
      const c = g.c;
      if (g.spread) {
        // 펼치기: 묶음 가운데 둘레에 놓음(지도 단위로 저장해야 확대 애니메이션 중에도 따라감). 바탕 고리가 핀 아래로 가게 먼저 넣음
        const R = (12 + 3 * g.m.length) / s;
        out.push({kind: 'ring', p: c, r: R * s + 13});
        g.m.forEach((x, i) => {
          const a = -Math.PI / 2 + (2 * Math.PI * i) / g.m.length;
          out.push({kind: 'pin', ...x, p: [c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)], spread: true});
        });
      } else {
        out.push({kind: 'bub', m: g.m, p: c, b: g.b, best: g.m[0].r.best, closed: g.m.every((x) => x.r.closed)});
      }
    }
    return out;
  }
  const PIN = {clean: 'clean', use: 'cond', cond: 'cond', spend: 'spend', check: 'off'};
  const pinCls = (r, has) => (r.closed ? 'off' : !has ? 'any' : r.best ? PIN[r.best] : 'off');
  function build(v) {
    const has = hasCards();
    items = layout(v);
    const [W, H] = size(), s = W / v[2];
    const px = (p) => [(p[0] - v[0]) * s, (p[1] - v[1]) * s];
    // 이름표: 확대했을 때만, 빈 자리(오른쪽·왼쪽·아래·위)에만
    const taken = items.filter((m) => m.kind !== 'ring').map((m) => { const [x, y] = px(m.p), r = m.kind === 'bub' ? 15 : 9; return [x - r, y - r, x + r, y + r]; });
    const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    const textW = (t) => Array.from(t).reduce((w, ch) => w + (/[가-힣]/.test(ch) ? 11 : 6.5), 8);
    const free = (b) => b[0] >= 2 && b[2] <= W - 2 && b[1] >= 2 && b[3] <= H - 2 && !taken.some((q) => overlap(q, b));
    const labels = new Map();
    if (deep(v) || sel) {
      for (const m of items) {
        if (m.kind !== 'pin' || (!deep(v) && m.r.h.id !== sel)) continue;
        const t = nameOf(m.r.h), w = textW(t), [x, y] = px(m.p);
        const spots = [['r', [x + 11, y - 9, x + 11 + w, y + 9]], ['l', [x - 11 - w, y - 9, x - 11, y + 9]], ['b', [x - w / 2, y + 10, x + w / 2, y + 27]], ['t', [x - w / 2, y - 27, x + w / 2, y - 10]]];
        const ok = spots.find(([, b]) => free(b)) || (m.r.h.id === sel ? spots[0] : null);
        if (ok) { labels.set(m, [ok[0], t]); taken.push(ok[1]); }
      }
    }
    // 구 이름: 핀·이름표와 안 겹치는 곳에만 흐리게
    const gl = [];
    for (const [n, c] of Object.entries(guC)) {
      const [x, y] = px(c), w = textW(n) * 0.85;
      const b = [x - w / 2, y - 8, x + w / 2, y + 8];
      if (free(b)) { gl.push([n, c]); taken.push(b); }
    }
    marks.innerHTML = gl.map(([n]) => `<span class="hv-gl" aria-hidden="true">${esc(n)}</span>`).join('') + items.map((m, i) => {
      if (m.kind === 'ring') return '<span class="hv-ringbg" aria-hidden="true"></span>';
      if (m.kind === 'bub') {
        const cls = m.closed ? 'off' : !has ? 'any' : m.best ? PIN[m.best] : 'off';
        return `<button type="button" class="hv-bub ${cls}" data-i="${i}" aria-label="호텔 ${m.m.length}곳 · 눌러서 확대"><b>${m.m.length}</b></button>`;
      }
      const lab = labels.get(m);
      const on = m.r.h.id === sel;
      return `<button type="button" class="hv-pin ${pinCls(m.r, has)}${on ? ' sel' : ''}${lab ? ' lp-' + lab[0] : ''}" data-i="${i}" aria-label="${esc(m.r.h.name)} · ${esc(pillText(m.r, has))}" aria-pressed="${on}">${lab ? `<span>${esc(lab[1])}</span>` : ''}</button>`;
    }).join('');
    marks.dataset.gl = String(gl.length);
    glPts = gl.map(([, c]) => c);
    if (vb) place();
  }
  let glPts = [];
  const toPx = (p) => { const [W] = size(), s = W / vb[2]; return [(p[0] - vb[0]) * s, (p[1] - vb[1]) * s]; };
  function place() {
    const els = marks.children;
    let k = 0;
    for (const c of glPts) { const [x, y] = toPx(c); els[k++].style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; }
    for (const m of items) {
      const el = els[k++];
      const [x, y] = toPx(m.p);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (m.kind === 'ring') el.style.width = el.style.height = (m.r * 2).toFixed(0) + 'px';
    }
  }
  const setVB = (v) => { vb = v; svg.setAttribute('viewBox', v.map((n) => n.toFixed(5)).join(' ')); place(); };
  function zoomTo(to, instant) {
    build(to);
    cancelAnimationFrame(anim);
    if (!vb || instant || matchMedia('(prefers-reduced-motion: reduce)').matches) { setVB(to); return; }
    const from = vb.slice(), t0 = performance.now(), D = 480;
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
  const pillText = (r, has) => (r.closed ? '휴업' : !has ? `카드 ${r.any.length}종` : r.best ? STATE[r.best][1] : '내 카드 안 됨');
  function legend() {
    const has = hasCards();
    $('legend').innerHTML = has
      ? [['clean', 'v-clean', '조건 없이 무료'], ['use', 'v-cond', '이용 시 무료'], ['spend', 'v-spend', '실적 채우면'], ['off', 'v-off', '안 됨']]
        .filter(([k]) => rowsNow.some((r) => (k === 'use' ? r.best === 'use' || r.best === 'cond' : k === 'off' ? !r.closed && (!r.best || r.best === 'check') : r.best === k)))
        .map(([, c, t]) => `<span><i class="lg ${c}"></i>${t}</span>`).join('') || '<em>보이는 호텔이 없어요</em>'
      : '<span><i class="lg v-any"></i>카드 무료 발레 호텔</span><em>카드를 고르면 색으로 나눠 보여요</em>';
  }
  function popup() {
    const r = sel && rowsNow.find((x) => x.h.id === sel);
    if (!r) { sel = ''; pop.hidden = true; $('legend').hidden = false; return; }
    const has = hasCards();
    const line = has && !r.closed ? lineOf(r) : r.closed ? r.h.closure.note : `카드 ${r.any.length}종 무료 발레`;
    pop.innerHTML = `<div class="hv-pop-top"><b>${esc(r.h.name)}</b>${pillOf(r, has)}<button type="button" class="hv-pop-x" data-act="pop-x" aria-label="닫기">×</button></div>
      <small>${esc(r.h.district)}${line ? ' · ' + esc(line) : ''}</small>
      <button type="button" class="hv-pop-go" data-act="pop-open">조건 보기 ↓</button>`;
    pop.hidden = false;
    $('legend').hidden = true;
  }
  return {
    init,
    get ready() { return ready; },
    /** 필터가 바뀌면 다시 그림. 구가 바뀌었으면 그 구로 확대 */
    draw() {
      if (!ready) return;
      for (const g of svg.querySelectorAll('.hm-gu')) {
        g.classList.toggle('has', rowsNow.some((r) => r.h.district === g.dataset.n));
        g.classList.toggle('on', g.dataset.n === gu);
      }
      legend();
      const moved = gu !== lastGu;
      if (moved) custom = null;
      lastGu = gu;
      $('up').hidden = !gu && !custom;
      zoomTo(target(), !vb);
      popup();
    },
    select(id, {zoom} = {}) {
      sel = id;
      if (zoom && id) {
        const h = data.hotels.find((x) => x.id === id);
        if (h) {
          const p = ptOf(h);
          custom = fit([p[0], p[1], p[0], p[1]], 0, minW * 2.4);
          custom[1] += custom[3] * 0.2; // 아래 말풍선에 가리지 않게 핀을 위쪽에
          $('up').hidden = false;
        }
      }
      if (ready) { zoomTo(target(), !zoom); popup(); }
    },
    click(el) {
      const m = items[el.dataset.i];
      if (!m) return;
      if (m.kind === 'bub') { custom = fit(m.b, 0.5, minW); $('up').hidden = false; zoomTo(target()); return; }
      sel = sel === m.r.h.id ? '' : m.r.h.id;
      build(vb); popup();
    },
    up() { custom = null; },
    resize() { if (ready && vb) { cancelAnimationFrame(anim); const t = target(); build(t); setVB(t); } },
    get sel() { return sel; },
  };
})();

function renderAll() { renderPick(); renderMine(); renderResult(); }
function setGu(g) { gu = g; renderResult(); }

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
  if (g) { setGu(g.dataset.gu); return; }
  // 지도
  const mk = t.closest('.hv-pin[data-i], .hv-bub[data-i]');
  if (mk) { map.click(mk); return; }
  const gp = t.closest('#hv-svg .hm-gu');
  if (gp) { setGu(gp.dataset.n === gu ? '' : gp.dataset.n); return; }
  if (t.closest('#hv-up')) { map.up(); setGu(''); return; }
  if (t.closest('[data-act="pop-x"]')) { map.select(''); return; }
  if (t.closest('[data-act="pop-open"]')) {
    open = map.sel;
    if (gu && !rowsNow.some((r) => r.h.id === open && r.h.district === gu)) gu = '';
    renderResult();
    document.querySelector(`.hv-hotel[data-id="${CSS.escape(open)}"]`)?.scrollIntoView({behavior: 'smooth', block: 'start'});
    return;
  }
  if (t.closest('[data-act="hotel"]')) {
    const id = t.closest('.hv-hotel').dataset.id;
    open = open === id ? '' : id;
    renderResult();
    if (open) map.select(open);
  }
});
document.addEventListener('change', (e) => {
  if (e.target.matches('[data-brand]')) { mine[e.target.closest('.hv-m').dataset.key].brand = e.target.value; save(); renderMine(); renderResult(); }
});
$('only').addEventListener('change', renderResult);
$('clean').addEventListener('change', (e) => { store.set(CLEAN_SAVE, e.target.checked); renderResult(); });
let timer;
$('q').addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => { q = e.target.value; renderResult(); }, 120); });
$('cq').addEventListener('input', (e) => { cq = e.target.value; renderPick(); });
let lastW = 0;
new ResizeObserver(() => { const w = $('map').clientWidth; if (w && w !== lastW) { lastW = w; map.resize(); } }).observe($('map'));

async function load() {
  const [d, geo] = await Promise.all([MS.getJSON('valet.json'), MS.getJSON('map.json').catch(() => null)]);
  data = d;
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
  $('clean').checked = !open && store.get(CLEAN_SAVE, false) === true;
  if (open) $('only').checked = false;
  map.init(geo);
  $('sub').textContent = `서울 호텔 ${data.hotels.length}곳 · 카드 ${cards.length}종 · 카드사 공식 안내 ${data.updatedAt.slice(2).replace(/-/g, '.')} 확인`;
  $('note').textContent = '카드사 공식 안내(상품설명서·혜택 안내)에 나온 서울 제휴 호텔만 정리했어요. 무료 시간·횟수는 카드사 기준이고, 만차·행사 때는 호텔 사정으로 제한될 수 있어요. '
    + '‘조건 없이 무료’는 상품설명서·브랜드 서비스 안내에 호텔 이용 없이 무료라고 적힌 곳만이에요(전월실적은 채워야 함). 당일 투숙·식음료 매장 이용이 필요한 곳은 ‘이용 시 무료’로 보여요. '
    + '지도 위치는 호텔 주소 기준 대략 위치예요(지도: Natural Earth, 구 경계: 통계청). 고른 카드와 실적 체크는 이 브라우저에만 저장돼요.';
  renderAll();
  if (open) {
    map.select(open, {zoom: true});
    document.querySelector(`.hv-hotel[data-id="${CSS.escape(open)}"]`)?.scrollIntoView({block: 'center'});
  }
}
const onError = (err) => { console.error(err); $('hotels').innerHTML = '<p class="wl-empty">불러오지 못했습니다. 새로고침해 주세요.</p>'; };
window.addEventListener('datarefresh', (e) => e.detail.tasks.push(load().catch(onError)));
load().catch(onError);
