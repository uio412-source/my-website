// 배당: 보유 종목(이 브라우저에 저장) × 종목별 최근 12개월 주당 배당금 → 투자금 · 연 배당금 · 배당률
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const getJSON = (name) => window.MS.getJSON("data/" + name + ".json");
  const KEY = "mrstocks.dividend.v1";
  const TAX_KEY = "mrstocks.dividend.tax";
  const TAX = { KRW: 0.154, USD: 0.15 }; // 국내 배당소득세, 미국 원천징수 (단순 적용)
  const MKT = { US: "미국", KOSPI: "코스피", KOSDAQ: "코스닥" };
  const FREQ = { 월: "월배당", 분기: "분기배당", 반기: "반기배당", 연: "연배당" };

  const ticker = (s) => s.replace(/\.(KS|KQ)$/, "");
  const isKR = (s) => ticker(s) !== s;
  const curOf = (s) => (isKR(s) ? "KRW" : "USD");
  const norm = (t) => (t || "").toLowerCase().replace(/[\s.\-·]/g, "");
  const nf0 = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const won = (v) => nf0.format(Math.round(v)) + "원";
  const money = (v, cur) => (cur === "USD" ? "$" + nf2.format(v) : won(v));
  const pct = (v) => (Number.isFinite(v) ? (v * 100).toFixed(2) + "%" : "—");
  // 막대 위 짧은 금액 (12.3만, 1.2억)
  const short = (v) => (v >= 1e8 ? (v / 1e8).toFixed(1).replace(/\.0$/, "") + "억" : v >= 1e4 ? (v / 1e4).toFixed(v >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "만" : nf0.format(Math.round(v)));
  const tone = (s) => Array.from(s).reduce((a, c) => a + c.charCodeAt(0), 0) % 5 + 1;
  const initials = (name, s) => {
    if (!isKR(s)) return ticker(s).slice(0, 4);
    const n = name.replace(/\s/g, "");
    const latin = /^[A-Za-z]+/.exec(n);
    return latin ? latin[0].slice(0, 2).toUpperCase() : Array.from(n).slice(0, 2).join("");
  };
  const tile = (name, s) => { const t = initials(name, s); return `<span class="tile" data-tone="${tone(s)}" data-len="${t.length}" aria-hidden="true">${esc(t)}</span>`; };

  const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
  let holdings = read(KEY, []);
  let afterTax = read(TAX_KEY, false) === true;
  let DIV = { items: {}, fx: {} }, QUOTES = {}, catalog = null, catalogP = null;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(holdings)); return true; } catch { return false; } };

  async function load() {
    const [d, q] = await Promise.all([
      getJSON("ungjup/dividends").catch(() => ({ items: {}, fx: {} })),
      getJSON("ungjup/holdings_lv").catch(() => ({ items: {} })),
    ]);
    DIV = d;
    QUOTES = q.items || {};
    render();
  }

  // ---------- 계산 ----------
  const fx = () => DIV.fx?.USDKRW || null;
  function calc(h) {
    const d = DIV.items[h.symbol];
    const cur = d?.cur || curOf(h.symbol);
    const price = d?.price ?? QUOTES[h.symbol]?.close ?? null;
    const cost = h.cost ?? price;
    const dps = d ? d.dps : h.dps ?? null; // 데이터가 있으면 그것, 없으면 직접 입력값
    const rate = cur === "USD" ? fx() : 1;
    const keep = afterTax ? 1 - (TAX[cur] ?? 0.154) : 1;
    const ok = rate && Number.isFinite(cost) && cost > 0;
    return {
      d, cur, price, cost, dps, rate,
      invest: ok ? h.qty * cost * rate : null,
      annual: ok && Number.isFinite(dps) ? h.qty * dps * rate * keep : null,
      yieldCost: Number.isFinite(dps) && cost > 0 ? (dps * keep) / cost : null,
      yieldNow: Number.isFinite(dps) && price > 0 ? (dps * keep) / price : null,
      months: (d?.months || []).map(([m, a]) => [m, h.qty * a * rate * keep]),
      manual: !d && Number.isFinite(h.dps),
    };
  }

  // ---------- 화면 ----------
  function render() {
    const rows = holdings.map((h) => ({ h, c: calc(h) }));
    const invest = rows.reduce((s, r) => s + (r.c.invest || 0), 0);
    const annual = rows.reduce((s, r) => s + (r.c.annual || 0), 0);
    const nowValue = rows.reduce((s, r) => s + (r.c.price && r.c.rate ? r.h.qty * r.c.price * r.c.rate : 0), 0);

    $("k-invest").textContent = won(invest);
    $("k-div").textContent = won(annual);
    $("k-yield").textContent = invest ? pct(annual / invest) : "—";
    $("k-count").textContent = `${holdings.length}종목`;
    $("k-month").textContent = `월 평균 ${won(annual / 12)}`;
    $("k-cur").textContent = nowValue ? `현재가 기준 ${pct(annual / nowValue)}` : "현재가 기준 —";
    $("dv-sub").textContent = `${holdings.length}종목 · ${afterTax ? "세후" : "세전"}` + (fx() ? ` · 1달러 ${nf0.format(fx())}원` : "");
    $("dv-tax").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tax === (afterTax ? "1" : "0"))));
    $("dv-count").textContent = holdings.length ? "연 배당금 순" : "";

    renderCalendar(rows);

    const sorted = rows.sort((a, b) => (b.c.annual ?? -1) - (a.c.annual ?? -1));
    $("dv-list").innerHTML = sorted.length
      ? `<div class="wl-rows">${sorted.map(({ h, c }) => {
          const sub = [`${Number.isInteger(h.qty) ? nf0.format(h.qty) : +h.qty.toFixed(6)}주`,
            Number.isFinite(c.cost) ? `${h.cost != null ? "평단" : "현재가"} ${money(c.cost, c.cur)}` : ""].filter(Boolean).join(" · ");
          const freq = c.d?.freq ? `<span class="freq">${FREQ[c.d.freq]}</span>` : c.manual ? `<span class="freq manual">직접 입력</span>` : "";
          const right = c.annual != null && c.dps > 0
            ? `<b class="px">${won(c.annual)}</b><em class="yld">${pct(c.yieldCost)}</em>`
            : c.annual === 0 || c.dps === 0
              ? `<b class="px muted">배당 없음</b><em class="yld none">0.00%</em>`
              : `<b class="px muted">—</b><em class="yld none">정보 없음</em>`;
          return `<button type="button" class="wl-row" data-id="${esc(h.id)}" aria-label="${esc(h.name)} 수정">
            ${tile(h.name, h.symbol)}
            <span class="wl-id"><b class="nm">${esc(h.name)}</b><small>${esc(sub)}${freq}</small></span>
            <span class="wl-px">${right}</span>
          </button>`;
        }).join("")}</div>`
      : `<div class="dv-empty">
          <div class="dv-empty-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg></div>
          <b>보유 종목을 추가해 보세요</b>
          <p>수량과 취득가를 넣으면 예상 배당금과 배당률을 계산해 드려요.</p>
          <button type="button" class="btn-primary" data-add>첫 종목 추가하기</button>
        </div>`;

    $("dv-note").innerHTML = `배당금은 최근 12개월 실제 지급액(배당락일 기준) 합계로 계산한 예상치예요. ` +
      `${afterTax ? "세후는 국내 15.4%, 미국 15%를 단순 적용했어요. " : ""}미국 종목은 오늘 환율로 원화 환산했어요. ` +
      `보유 종목은 이 브라우저에만 저장돼요.` + (DIV.updated ? ` · 배당 데이터 ${esc(DIV.updated.slice(5, 10).replace("-", "."))} 갱신` : "");
  }

  function renderCalendar(rows) {
    const m = Array(13).fill(0);
    let spread = 0;
    for (const { c } of rows) {
      if (c.months.length) c.months.forEach(([mo, v]) => (m[mo] += v));
      else if (c.manual && c.annual) spread += c.annual / 12; // 직접 입력은 12개월에 고르게
    }
    for (let i = 1; i <= 12; i++) m[i] += spread;
    const max = Math.max(...m.slice(1));
    const box = $("dv-cal");
    box.hidden = !(max > 0);
    if (!(max > 0)) return;
    const now = new Date().getMonth() + 1;
    $("cal-bars").innerHTML = m.slice(1).map((v, i) => {
      const mo = i + 1;
      const h = v > 0 ? Math.max(6, (v / max) * 100) : 0;
      return `<div class="cal-col${mo === now ? " now" : ""}" title="${mo}월 ${won(v)}">
        <span class="cal-v">${v > 0 ? short(v) : ""}</span>
        <div class="cal-track"><i style="height:${h}%"></i></div>
        <span class="cal-m">${mo}월</span>
      </div>`;
    }).join("");
  }

  // ---------- 추가 · 수정 시트 ----------
  async function symbols() {
    catalogP ??= getJSON("ungjup/symbols").then((d) => (catalog = d.rows.map(([symbol, ko, en, market, etf]) =>
      ({ symbol, ko, en, market, etf, name: ko || en || symbol, k: norm(ko), e: norm(en), s: norm(symbol), code: norm(ticker(symbol)) }))))
      .catch((e) => { catalogP = null; throw e; });
    return catalogP;
  }
  function search(q) {
    const n = norm(q);
    if (!n || !catalog) return [];
    return catalog.flatMap((x) => {
      let r;
      if (x.s === n || x.code === n) r = 0;
      else if (x.k === n) r = 1;
      else if (x.s.startsWith(n)) r = 2;
      else if (x.k.startsWith(n)) r = 3;
      else if (x.e.startsWith(n)) r = 4;
      else if (x.k.includes(n) || (n.length >= 3 && x.e.includes(n))) r = 5;
      if (r === undefined) return [];
      return [{ r: r - (DIV.items[x.symbol]?.dps > 0 ? 0.4 : 0), x }]; // 배당 데이터 있는 종목을 조금 위로
    }).sort((a, b) => a.r - b.r || a.x.name.length - b.x.name.length).slice(0, 12).map((p) => p.x);
  }

  let picked = null, editing = null, results = [], active = -1;

  function setPicked(p) {
    picked = p;
    const box = $("dv-picked");
    if (!p) { box.hidden = true; $("dv-dps-wrap").hidden = true; preview(); return; }
    const d = DIV.items[p.symbol];
    const cur = d?.cur || curOf(p.symbol);
    const price = d?.price ?? QUOTES[p.symbol]?.close;
    $("dv-q").value = p.name;
    box.hidden = false;
    box.innerHTML = `${tile(p.name, p.symbol)}
      <div><b>${esc(p.name)}</b><span>${esc(ticker(p.symbol))} · ${isKR(p.symbol) ? (p.symbol.endsWith(".KQ") ? "코스닥" : "코스피") : "미국"}</span></div>
      <dl>
        <div><dt>현재가</dt><dd>${Number.isFinite(price) ? money(price, cur) : "—"}</dd></div>
        <div><dt>주당 배당금(연)</dt><dd>${d ? money(d.dps, cur) : "직접 입력"}</dd></div>
        <div><dt>배당률</dt><dd>${d && price ? pct(d.dps / price) : "—"}${d?.freq ? ` · ${FREQ[d.freq]}` : ""}</dd></div>
      </dl>`;
    $("dv-cost-label").textContent = `취득가 (주당, ${cur === "USD" ? "달러" : "원"})`;
    $("dv-cost").placeholder = Number.isFinite(price) ? `비우면 현재가 ${money(price, cur)}` : "현재가를 몰라서 꼭 입력해 주세요";
    $("dv-dps-wrap").hidden = !!d;
    $("dv-dps-label").textContent = `연간 주당 배당금 (${cur === "USD" ? "달러" : "원"}, 직접 입력)`;
    preview();
  }

  function formItem() {
    const num = (id) => ($(id).value === "" ? null : Number($(id).value));
    return { qty: num("dv-qty"), cost: num("dv-cost"), dps: num("dv-dps") };
  }
  function preview() {
    const box = $("dv-preview");
    const f = formItem();
    if (!picked || !(f.qty > 0)) { box.hidden = true; return; }
    const c = calc({ symbol: picked.symbol, qty: f.qty, cost: f.cost, dps: DIV.items[picked.symbol] ? null : f.dps });
    if (c.annual == null) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<span>예상 연 배당금</span><b>${won(c.annual)}</b><span>배당률</span><b>${pct(c.yieldCost)}</b>`;
  }

  function openOptions(list) {
    results = list;
    active = list.length ? 0 : -1;
    const ul = $("dv-opts");
    ul.hidden = !list.length;
    $("dv-q").setAttribute("aria-expanded", String(!!list.length));
    ul.innerHTML = list.map((x, i) => {
      const d = DIV.items[x.symbol];
      const y = d && d.price ? d.dps / d.price : null;
      return `<li role="option" id="opt-${i}" data-i="${i}" aria-selected="${i === active}">
        <span class="o-nm">${esc(x.name)}${x.etf ? "<em>ETF</em>" : ""}</span>
        <span class="o-sub">${esc(ticker(x.symbol))} · ${MKT[x.market]}${y != null ? ` · <b>배당률 ${pct(y)}</b>${d.freq ? " " + FREQ[d.freq] : ""}` : ""}</span>
      </li>`;
    }).join("");
    $("dv-q").setAttribute("aria-activedescendant", active >= 0 ? "opt-0" : "");
  }
  function closeOptions() { $("dv-opts").hidden = true; $("dv-q").setAttribute("aria-expanded", "false"); }
  function highlight(i) {
    active = i;
    $("dv-opts").querySelectorAll("li").forEach((li, k) => li.setAttribute("aria-selected", String(k === i)));
    const el = $("opt-" + i);
    if (el) { el.scrollIntoView({ block: "nearest" }); $("dv-q").setAttribute("aria-activedescendant", el.id); }
  }
  function choose(i) {
    const x = results[i];
    if (!x) return;
    closeOptions();
    setPicked({ symbol: x.symbol, name: x.name });
    $("dv-qty").focus();
  }

  function openSheet(id) {
    editing = id || null;
    const h = holdings.find((x) => x.id === id);
    $("dv-title").textContent = h ? "보유 종목 수정" : "보유 종목 추가";
    $("dv-del").hidden = !h;
    $("dv-err").textContent = "";
    $("dv-qty").value = h?.qty ?? "";
    $("dv-cost").value = h?.cost ?? "";
    $("dv-dps").value = h?.dps ?? "";
    $("dv-q").value = "";
    closeOptions();
    setPicked(h ? { symbol: h.symbol, name: h.name } : null);
    $("dv-dlg").showModal();
    if (!h) { $("dv-q").focus(); symbols().catch(() => {}); }
  }

  function submit(e) {
    e.preventDefault();
    const f = formItem();
    const err = (t) => { $("dv-err").textContent = t; };
    if (!picked) return err("종목을 검색해서 골라 주세요.");
    if (!(f.qty > 0)) return err("수량을 입력해 주세요.");
    const d = DIV.items[picked.symbol];
    const price = d?.price ?? QUOTES[picked.symbol]?.close;
    if (f.cost == null && !Number.isFinite(price)) return err("이 종목은 현재가를 몰라서 취득가를 입력해야 해요.");
    if (f.cost != null && !(f.cost > 0)) return err("취득가는 0보다 커야 해요.");
    const item = { id: editing || "d" + Date.now().toString(36), symbol: picked.symbol, name: picked.name, qty: f.qty, cost: f.cost };
    if (!d && f.dps != null) item.dps = f.dps;
    const next = holdings.filter((h) => h.id !== item.id);
    // 같은 종목을 새로 추가하면 수량·평단을 합침
    const same = !editing && next.find((h) => h.symbol === item.symbol);
    if (same) {
      const pa = same.cost ?? price, pb = item.cost ?? price;
      same.cost = Number.isFinite(pa) && Number.isFinite(pb) ? (same.qty * pa + item.qty * pb) / (same.qty + item.qty) : same.cost;
      same.qty += item.qty;
    } else next.push(item);
    holdings = next;
    if (!save()) return err("이 브라우저에 저장할 수 없어요.");
    $("dv-dlg").close();
    render();
    $("dv-status").textContent = `${item.name} ${same ? "수량을 합쳤어요" : editing ? "수정됨" : "추가됨"}`;
  }

  function setup() {
    const dlg = $("dv-dlg");
    $("dv-add").addEventListener("click", () => openSheet());
    $("dv-list").addEventListener("click", (e) => {
      const row = e.target.closest(".wl-row");
      if (row) return openSheet(row.dataset.id);
      if (e.target.closest("[data-add]")) openSheet();
    });
    dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); });
    $("dv-del").addEventListener("click", () => {
      const h = holdings.find((x) => x.id === editing);
      holdings = holdings.filter((x) => x.id !== editing);
      save();
      dlg.close();
      render();
      if (h) $("dv-status").textContent = `${h.name} 삭제됨`;
    });
    $("dv-form").addEventListener("submit", submit);
    ["dv-qty", "dv-cost", "dv-dps"].forEach((id) => $(id).addEventListener("input", preview));
    $("dv-tax").addEventListener("click", (e) => {
      const b = e.target.closest("[data-tax]");
      if (!b) return;
      afterTax = b.dataset.tax === "1";
      try { localStorage.setItem(TAX_KEY, JSON.stringify(afterTax)); } catch {}
      render();
    });

    // 드롭다운 검색
    const q = $("dv-q");
    let req = 0;
    q.addEventListener("input", async () => {
      const id = ++req;
      if (picked && q.value !== picked.name) setPicked(null);
      try { await symbols(); } catch { $("dv-err").textContent = "종목 목록을 불러오지 못했어요."; return; }
      if (id !== req) return;
      openOptions(search(q.value));
    });
    q.addEventListener("focus", () => { if (!picked && q.value) openOptions(search(q.value)); });
    q.addEventListener("keydown", (e) => {
      if ($("dv-opts").hidden) return;
      if (e.key === "ArrowDown") { e.preventDefault(); highlight(Math.min(results.length - 1, active + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); highlight(Math.max(0, active - 1)); }
      else if (e.key === "Enter") { e.preventDefault(); choose(active); }
      else if (e.key === "Escape") { e.preventDefault(); closeOptions(); }
    });
    $("dv-opts").addEventListener("pointerdown", (e) => {
      const li = e.target.closest("li");
      if (!li) return;
      e.preventDefault(); // 입력창 포커스 유지
      choose(+li.dataset.i);
    });
    q.addEventListener("blur", () => setTimeout(closeOptions, 120));
  }

  document.addEventListener("DOMContentLoaded", () => {
    setup();
    load().catch(() => { $("dv-list").innerHTML = '<p class="wl-empty">배당 데이터를 불러오지 못했어요. 오른쪽 아래 새로고침을 눌러 주세요.</p>'; });
  });
  window.addEventListener("datarefresh", (e) => e.detail.tasks.push(load()));
})();
