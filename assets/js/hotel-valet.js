// Mr. Hotels 발레파킹 — 보유 카드 등록 → 서울 구별 지도 → 호텔 목록 → 호텔을 누르면 내 카드별 이용 조건
// 데이터: hotels/valet.json(카드사 공식 안내 정리), hotels/valet-districts.json(서울 구 경계)
import {valetStatus, valetDate, valetQuota} from './valet-rules.js';

const $ = (id) => document.getElementById('hv-' + id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const ko = new Intl.Collator('ko');
const day = valetDate();
const SAVE = 'mrhotels.valet.cards';       // 보유 카드 (프로그램id:카드key) — 예전 화면과 같은 저장값
const MET = 'mrhotels.valet.spendMet';     // "지난달 실적 채움" 스위치
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 화면에서만 유지 */ } },
};
const won = (n) => (n >= 10000 ? `${n / 10000}만원` : `${n.toLocaleString()}원`);
const ISSUER = {'신한카드': ['신한', 1], '현대카드': ['현대', 5], '하나카드': ['하나', 3], '삼성카드': ['삼성', 1], 'KB국민카드': ['KB', 4], '우리카드': ['우리', 1], '롯데카드': ['롯데', 2], 'BC카드': ['BC', 2], 'NH농협카드': ['NH', 3]};
const tile = (issuer) => { const [a, t] = ISSUER[issuer] || [issuer.slice(0, 2), 1]; return `<span class="tile sm" data-tone="${t}" data-len="${a.length}" aria-hidden="true">${esc(a)}</span>`; };

let data, geo, cards = [], byCard = {};
let mine = new Set(store.get(SAVE, []));
let met = store.get(MET, true);
let district = '';
let open = new URLSearchParams(location.search).get('hotel') || '';
let q = '';

const cardLabel = (c) => `${c.name} · ${c.program.brand}`;
const myCards = () => cards.filter((c) => mine.has(c.id));
// 이 호텔에서 쓸 수 있는 카드 (휴업·명단 밖 제외). expired는 "조건 확인 중"으로 따로
const cardsAt = (hotel, list = cards) => list
  .map((c) => ({c, st: valetStatus(c.program, hotel, day)}))
  .filter((x) => x.st === 'available' || x.st === 'expired');
const isClosed = (h) => h.closure && h.closure.from <= day;
const ready = (x) => x.st === 'available' && (met || !x.c.program.minimumSpend); // 지금 바로 가능

function saveMine() {
  store.set(SAVE, [...mine]);
  renderMine(); renderMap(); renderList(); renderCardList();
}

// ---------- 내 카드 ----------
function renderMine() {
  const list = myCards();
  const box = $('mine');
  if (!list.length) {
    box.innerHTML = `<div class="hv-mine-empty">
      <div><b>보유 카드를 등록해 보세요</b><p>등록한 카드로 무료 발레가 되는 호텔만 지도와 목록에 표시하고, 호텔마다 어떤 카드를 쓰면 되는지 알려 드려요.</p></div>
      <button type="button" class="hv-btn primary" data-act="edit">카드 등록</button></div>`;
    return;
  }
  const n = data.hotels.filter((h) => !isClosed(h) && cardsAt(h, list).some(ready)).length;
  box.innerHTML = `<div class="hv-mine-top"><b>내 카드 ${list.length}장</b><span>서울 ${n}곳에서 바로 무료 발레</span><button type="button" class="hv-btn" data-act="edit">편집</button></div>
    <div class="hv-chips">${list.map((c) => `<span class="hv-chip">${tile(c.program.issuer)}${esc(c.name.replace(/^신한카드 |^하나카드 /, ''))}<small>${esc(c.program.brand)}</small></span>`).join('')}</div>
    <label class="hv-switch"><input type="checkbox" id="hv-met"${met ? ' checked' : ''}><span></span>지난달 전월실적 채운 걸로 보기</label>`;
  $('met').addEventListener('change', (e) => { met = e.target.checked; store.set(MET, met); renderMine(); renderMap(); renderList(); });
}

// ---------- 카드 등록 시트 ----------
function renderCardList() {
  const terms = norm($('cq').value);
  const groups = {};
  for (const c of cards) {
    if (terms && !norm(`${c.name} ${c.program.issuer} ${c.program.brand} ${c.program.tier}`).includes(terms)) continue;
    (groups[c.program.issuer] = groups[c.program.issuer] || []).push(c);
  }
  const pend = data.pending.filter((p) => !terms || norm(`${p.name} ${p.issuer}`).includes(terms));
  $('cardlist').innerHTML = Object.entries(groups).map(([iss, cs]) => `<div class="hv-cgroup"><div class="hv-cgh">${tile(iss)}${esc(iss)}</div>${cs.map((c) => {
    const n = data.hotels.filter((h) => !isClosed(h) && valetStatus(c.program, h, day) === 'available').length;
    const p = c.program;
    return `<label class="hv-crow"><input type="checkbox" data-card="${esc(c.id)}"${mine.has(c.id) ? ' checked' : ''}>
      <span class="hv-cname"><b>${esc(c.name)}</b><small>${esc(p.brand)} ${esc(p.tier)} · 서울 ${n}곳 · 전월 ${p.minimumSpend ? won(p.minimumSpend) : '조건 없음'} · ${esc(valetQuota(p))}${p.validThrough ? ` · ${esc(p.validThrough.slice(2).replace(/-/g, '.'))}까지` : ''}</small></span></label>`;
  }).join('')}</div>`).join('') +
    (pend.length ? `<div class="hv-cgroup"><div class="hv-cgh">호텔 명단 확인 중</div>${pend.map((p) => `<div class="hv-crow off"><span class="hv-cname"><b>${esc(p.name)}</b><small>${esc(p.brand)} · ${esc(p.note)}</small></span></div>`).join('')}</div>` : '') ||
    '<p class="wl-empty">찾는 카드가 없어요.</p>';
}

// ---------- 지도 ----------
function counts() {
  const list = myCards();
  const m = {};
  for (const h of data.hotels) {
    if (isClosed(h)) continue;
    const ok = list.length ? cardsAt(h, list).some(ready) : cardsAt(h).length > 0;
    if (ok) m[h.district] = (m[h.district] || 0) + 1;
  }
  return m;
}
function renderMap() {
  const box = $('map');
  if (!box.querySelector('svg')) {
    box.innerHTML = `<svg viewBox="${geo.viewBox}" class="hv-svg" role="group" aria-label="서울 구별 지도">${geo.districts.map((d) =>
      `<path class="hv-gu" data-gu="${esc(d.name)}" d="${d.d}" tabindex="-1"><title>${esc(d.name)}</title></path>`).join('')}<g class="hv-badges"></g></svg>`;
    const svg = box.querySelector('svg');
    svg.addEventListener('click', (e) => {
      const g = e.target.closest('[data-gu]');
      if (!g) return;
      district = district === g.dataset.gu ? '' : g.dataset.gu;
      renderMap(); renderList();
    });
    // 구 이름표 위치 = 경계 상자의 가운데
    geo.centers = Object.fromEntries([...svg.querySelectorAll('.hv-gu')].map((p) => { const b = p.getBBox(); return [p.dataset.gu, [b.x + b.width / 2, b.y + b.height / 2]]; }));
  }
  const m = counts(), max = Math.max(1, ...Object.values(m));
  for (const p of box.querySelectorAll('.hv-gu')) {
    const n = m[p.dataset.gu] || 0;
    p.style.setProperty('--k', n ? Math.round(18 + (n / max) * 62) + '%' : '0%');
    p.classList.toggle('has', n > 0);
    p.classList.toggle('on', p.dataset.gu === district);
  }
  box.querySelector('.hv-badges').innerHTML = Object.entries(m).map(([gu, n]) => {
    const [x, y] = geo.centers[gu] || [0, 0];
    return `<g class="hv-badge${gu === district ? ' on' : ''}" data-gu="${esc(gu)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <text class="nm" y="-13">${esc(gu.replace(/구$/, ''))}</text><circle r="10"/><text class="n" y="4">${n}</text></g>`;
  }).join('');
  const total = Object.values(m).reduce((a, b) => a + b, 0);
  $('legend').innerHTML = myCards().length
    ? `<span class="dot"></span>숫자 = 내 카드로 ${met ? '바로' : '조건 충족 시'} 무료 발레 되는 호텔 수 · 서울 ${total}곳`
    : `<span class="dot"></span>숫자 = 카드 무료 발레 호텔 수 · 서울 ${total}곳 · 구를 누르면 그 구만 보여요`;
}

// ---------- 호텔 목록 ----------
function renderList() {
  const list = myCards();
  const terms = norm(q);
  const rows = data.hotels
    .filter((h) => (!district || h.district === district) && (!terms || norm([h.name, h.district, ...(h.aliases || [])].join(' ')).includes(terms)))
    .map((h) => {
      const all = cardsAt(h), my = list.length ? cardsAt(h, list) : [];
      return {h, all, my, rd: my.filter(ready).length, closed: isClosed(h)};
    })
    .filter((r) => r.closed || r.all.length);
  rows.sort((a, b) => (a.closed - b.closed) || (b.rd - a.rd) || (b.my.length - a.my.length) || (b.all.length - a.all.length) || ko.compare(a.h.name, b.h.name));
  const okCount = rows.filter((r) => !r.closed && (list.length ? r.rd : r.all.length)).length;
  $('where').innerHTML = `<b>${esc(district || '서울 전체')}</b><span>${list.length ? `내 카드 가능 ${okCount}곳 / ` : ''}${rows.length}곳</span>` +
    (district ? '<button type="button" class="hv-btn sm" data-act="all">서울 전체</button>' : '');
  $('hotels').innerHTML = rows.length ? rows.map(row).join('') : '<p class="wl-empty">조건에 맞는 호텔이 없어요.</p>';
  if (open) document.querySelector(`.hv-hotel[data-id="${CSS.escape(open)}"]`)?.scrollIntoView({block: 'nearest'});
}

function row(r) {
  const {h, all, my, rd, closed} = r;
  const list = myCards();
  let badge;
  if (closed) badge = '<span class="hv-pill off">휴업</span>';
  else if (list.length) badge = rd ? `<span class="hv-pill ok">내 카드 ${rd}장 가능</span>` : my.length ? `<span class="hv-pill warn">실적 충족 시 ${my.length}장</span>` : '<span class="hv-pill off">내 카드 없음</span>';
  else badge = `<span class="hv-pill">카드 ${new Set(all.map((x) => x.c.name)).size}종</span>`;
  const isOpen = open === h.id;
  return `<div class="hv-hotel${isOpen ? ' open' : ''}${closed || (list.length && !my.length) ? ' dim' : ''}" data-id="${esc(h.id)}">
    <button type="button" class="hv-hrow" aria-expanded="${isOpen}" data-act="hotel">
      <span class="hv-hname"><b>${esc(h.name)}</b><small>${esc(h.district)}${h.note ? ' · 복합시설' : ''}</small></span>${badge}
      <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    ${isOpen ? detail(r) : ''}
  </div>`;
}

function cardLine(x, h, canAdd) {
  const p = x.c.program, o = p.hotelOverrides?.[h.id];
  const state = x.st === 'expired' ? '<span class="hv-st warn">조건 확인 중</span>'
    : !p.minimumSpend ? '<span class="hv-st ok">조건 없이 가능</span>'
      : met && mine.has(x.c.id) ? `<span class="hv-st ok">가능 · 전월 ${won(p.minimumSpend)} 채움</span>`
        : `<span class="hv-st warn">전월 ${won(p.minimumSpend)} 이상이면</span>`;
  return `<li class="hv-cl">
    <div class="hv-cl-top">${tile(p.issuer)}<b>${esc(x.c.name)}</b><small>${esc(p.brand)}</small>${state}</div>
    <dl>
      <div><dt>한도</dt><dd>${esc(valetQuota(p, h))}${p.familyQuota ? ' · 가족카드 합산' : ''}</dd></div>
      <div><dt>무료</dt><dd>${esc(p.parking)}</dd></div>
      <div><dt>조건</dt><dd>${esc(p.visit)}</dd></div>
      <div><dt>제시</dt><dd>${esc(p.proof)}</dd></div>
      ${p.minimumSpend ? `<div><dt>실적</dt><dd>${esc(p.spendScope)} ${won(p.minimumSpend)} 이상${p.grace ? ` · ${esc(p.grace)}` : ''}</dd></div>` : ''}
      ${o?.note ? `<div><dt>주의</dt><dd>${esc(o.note)}</dd></div>` : ''}
    </dl>
    <div class="hv-cl-foot"><a href="${esc(p.source)}" target="_blank" rel="noopener">카드사 공식 안내 ↗</a>${x.c.catalogId ? `<a href="../paymorevent/cards/${encodeURIComponent(x.c.catalogId)}/">Mr. Cards 카드 정보</a>` : ''}${canAdd ? `<button type="button" class="hv-btn sm" data-add="${esc(x.c.id)}">${mine.has(x.c.id) ? '내 카드 ✓' : '내 카드에 추가'}</button>` : ''}</div>
  </li>`;
}

// 카드 미등록·다른 카드: 같은 조건(카드사 안내 묶음)끼리 한 줄로 묶고 카드 이름은 칩으로
function groupLines(xs, h) {
  const groups = new Map();
  for (const x of xs) {
    const p = x.c.program;
    const k = [p.issuer, p.brand, p.minimumSpend, valetQuota(p, h), p.parking, x.st].join('|');
    if (!groups.has(k)) groups.set(k, {p, st: x.st, cs: []});
    groups.get(k).cs.push(x.c);
  }
  const list = [...groups.values()].sort((a, b) => (a.p.minimumSpend || 0) - (b.p.minimumSpend || 0) || ko.compare(a.p.issuer, b.p.issuer));
  return `<ul class="hv-cls">${list.map(({p, st, cs}) => `<li class="hv-cl hv-grp">
    <div class="hv-cl-top">${tile(p.issuer)}<b>${esc(p.issuer)} ${esc(p.brand)} ${esc(p.tier)}</b>${st === 'expired' ? '<span class="hv-st warn">조건 확인 중</span>'
      : !p.minimumSpend ? '<span class="hv-st ok">조건 없이 가능</span>' : `<span class="hv-st warn">전월 ${won(p.minimumSpend)} 이상</span>`}</div>
    <p class="hv-grp-sum">${esc(valetQuota(p, h))} · ${esc(p.parking)} · ${esc(p.visit)}${p.hotelOverrides?.[h.id]?.note ? ` · ${esc(p.hotelOverrides[h.id].note)}` : ''}</p>
    <div class="hv-addchips">${cs.map((c) => `<button type="button" class="hv-add${mine.has(c.id) ? ' on' : ''}" data-add="${esc(c.id)}" aria-pressed="${mine.has(c.id)}">${mine.has(c.id) ? '✓' : '+'} ${esc(c.name.replace(/^신한카드 |^하나카드 /, ''))}</button>`).join('')}</div>
    <div class="hv-cl-foot"><a href="${esc(p.source)}" target="_blank" rel="noopener">카드사 공식 안내 ↗</a></div>
  </li>`).join('')}</ul>`;
}

function detail({h, all, my, closed}) {
  if (closed) return `<div class="hv-detail"><p class="hv-closed">${esc(h.closure.note)} <a href="${esc(h.closure.source)}" target="_blank" rel="noopener">공지 ↗</a></p></div>`;
  const list = myCards();
  const note = h.note ? `<p class="hv-hnote">${esc(h.note)}</p>` : '';
  if (!list.length) {
    return `<div class="hv-detail">${note}<div class="hv-dh">이 호텔에서 무료 발레가 되는 카드 <small>내 카드면 눌러서 추가하세요</small></div>${groupLines(all, h)}</div>`;
  }
  const ok = my.filter(ready), cond = my.filter((x) => !ready(x));
  const others = all.filter((x) => !mine.has(x.c.id));
  return `<div class="hv-detail">${note}
    ${ok.length ? `<div class="hv-dh ok">내 카드로 바로 가능 ${ok.length}장</div><ul class="hv-cls">${ok.map((x) => cardLine(x, h)).join('')}</ul>` : ''}
    ${cond.length ? `<div class="hv-dh warn">조건 충족 시 가능 ${cond.length}장</div><ul class="hv-cls">${cond.map((x) => cardLine(x, h)).join('')}</ul>` : ''}
    ${!my.length ? '<p class="hv-none">등록한 카드로는 이 호텔 무료 발레가 안 돼요.</p>' : ''}
    ${others.length ? `<details class="hv-others"><summary>다른 카드로는 ${others.length}장 가능</summary>${groupLines(others, h)}</details>` : ''}
  </div>`;
}

// ---------- 이벤트 ----------
document.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'edit') { $('cq').value = ''; renderCardList(); $('sheet').showModal(); }
  if (act === 'all') { district = ''; renderMap(); renderList(); }
  if (act === 'hotel') {
    const id = e.target.closest('.hv-hotel').dataset.id;
    open = open === id ? '' : id;
    renderList();
  }
  const add = e.target.closest('[data-add]');
  if (add) {
    const id = add.dataset.add, keepOthers = !!add.closest('details[open]');
    mine.has(id) ? mine.delete(id) : mine.add(id); saveMine();
    if (keepOthers) document.querySelector('.hv-hotel.open .hv-others')?.setAttribute('open', '');
  }
});
$('cardlist').addEventListener('change', (e) => {
  const id = e.target.dataset.card;
  if (!id) return;
  e.target.checked ? mine.add(id) : mine.delete(id);
  store.set(SAVE, [...mine]);
});
$('sheet').addEventListener('close', () => { renderMine(); renderMap(); renderList(); });
$('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) $('sheet').close(); }); // 바깥 누르면 닫기
$('cq').addEventListener('input', renderCardList);
let t;
$('q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value; renderList(); }, 120); });

async function load() {
  [data, geo] = await Promise.all([MS.getJSON('valet.json'), MS.getJSON('valet-districts.json')]);
  cards = data.programs.flatMap((program) => program.cards.map((c) => ({...c, program, id: `${program.id}:${c.key}`})))
    .sort((a, b) => ko.compare(a.program.issuer, b.program.issuer) || ko.compare(cardLabel(a), cardLabel(b)));
  byCard = Object.fromEntries(cards.map((c) => [c.id, c]));
  mine = new Set([...mine].filter((id) => byCard[id]));
  // Mr. Cards에서 ?card=카드ID 로 넘어오면 그 카드를 보유 카드로 담아 보여 줌
  const want = new URLSearchParams(location.search).get('card');
  if (want) for (const c of cards) if (c.id === want || c.catalogId === want) mine.add(c.id);
  if (open && !data.hotels.some((h) => h.id === open)) open = '';
  if (open) district = data.hotels.find((h) => h.id === open).district;
  $('sub').textContent = `서울 호텔 ${data.hotels.length}곳 · 카드 ${new Set(cards.map((c) => c.name)).size}종 · 카드사 공식 안내 ${data.updatedAt.slice(2).replace(/-/g, '.')} 확인`;
  $('note').innerHTML = `카드사 공식 안내(상품설명서·혜택 안내)에 나온 서울 제휴 호텔만 정리했어요. 무료 시간·횟수는 카드사 기준이고, 만차·행사 때는 호텔 사정으로 제한될 수 있어요. ` +
    `지도 경계: <a href="${esc(geo.source)}" target="_blank" rel="noopener">southkorea/seoul-maps</a> (${esc(geo.license)}).`;
  renderMine(); renderMap(); renderList();
}
const onError = () => { $('hotels').innerHTML = '<p class="wl-empty">불러오지 못했습니다. 새로고침해 주세요.</p>'; };
window.addEventListener('datarefresh', (e) => e.detail.tasks.push(load().catch(onError)));
load().catch(onError);
