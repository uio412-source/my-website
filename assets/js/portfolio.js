// 보유종목 · 자산 페이지 공용 스크립트
(() => {
  const $ = (id) => document.getElementById(id);
  const won = (v) => Math.round(v).toLocaleString("ko-KR") + "원";
  const signed = (v) => (v > 0 ? "+" : v < 0 ? "-" : "") + Math.abs(Math.round(v)).toLocaleString("ko-KR") + "원";
  const pctS = (v, d = 2) => (v > 0 ? "+" : v < 0 ? "-" : "") + Math.abs(v * 100).toFixed(d) + "%";
  const cls = (v) => (v > 0 ? "up" : v < 0 ? "down" : "");
  const qtyS = (q) => q == null || q === "" ? "" : (+(+q).toFixed(6)).toLocaleString("ko-KR", { maximumFractionDigits: 6 }) + "주";
  const lvBand = (lv) => (lv == null ? "n" : lv >= 900 ? "h" : lv >= 400 ? "m" : "l");
  const rate = (it) => (it.value - it.pnl ? it.pnl / (it.value - it.pnl) : 0);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // 차트 페이지에 있는 지수와 연결
  const CHART = { QLD: "qld", SPY: "spy", GLD: "gld", "^NDX": "ndx", "BTC-USD": "btc" };

  // 직접 추가한 종목 (이 브라우저에만 저장)
  // 새로고침 버튼(main.js)을 누른 뒤에는 캐시를 건너뛰고 받음
  const getJSON = (u) => (window.MS && MS.getJSON ? MS.getJSON(u) : fetch(u).then((r) => r.json()));
  const KEY = "mrstocks.added.v1";
  const readAdded = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const writeAdded = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} };

  async function load() {
    const [h, lv] = await Promise.all([
      getJSON("data/holdings.json"),
      getJSON("data/ungjup/holdings_lv.json").catch(() => ({ items: {} })),
    ]);
    readAdded().forEach((a) => {
      const g = h.groups.find((x) => x.id === (a.market === "US" ? "us" : "kr")) || h.groups[0];
      g.items.push({ ...a, added: true });
    });
    h.groups.forEach((g) => g.items.forEach((it, i) => {
      it.order = i;
      it.group = g.id;
      it.lvi = lv.items[it.symbol] || null;
    }));
    return { h, lvUpdated: lv.updated };
  }

  // ---------- 뉴스 자막 ----------
  const ago = (iso) => {
    const m = Math.max(1, Math.round((Date.now() - new Date(iso)) / 60000));
    return m < 60 ? m + "분 전" : m < 1440 ? Math.round(m / 60) + "시간 전" : Math.round(m / 1440) + "일 전";
  };
  async function news() {
    let d;
    try { d = await getJSON("data/ungjup/news.json"); } catch (e) { return; }
    if (!d.items?.length) return;
    const one = d.items.map((n) => `<a class="news-item" href="${esc(n.link)}" target="_blank" rel="noopener">
        <b class="${n.symbol ? "" : "mkt"}">${esc(n.label)}</b>${esc(n.title)}<span class="src">${esc(n.source)} · ${ago(n.time)}</span></a>`).join("");
    const track = $("news-track");
    track.innerHTML = one + one; // 두 번 이어 붙여 끊김 없이 반복
    $("news").hidden = false;
    // 글자 양에 맞춰 일정한 속도(초당 약 60px)로 흐르게
    requestAnimationFrame(() => track.style.setProperty("--dur", Math.max(30, track.scrollWidth / 2 / 60) + "s"));
  }

  // ---------- 보유종목 ----------
  let H = null, sort = "default", bound = false;
  function holdings(d) {
    H = d.h;
    const h = H;
    const render = () => {
      const sorter = {
        default: (a, b) => a.order - b.order,
        value: (a, b) => b.value - a.value,
        pnl: (a, b) => rate(b) - rate(a),
        lv: (a, b) => (b.lvi?.lv ?? -1) - (a.lvi?.lv ?? -1),
      }[sort];
      $("h-list").innerHTML = h.groups.filter((g) => g.items.length).map((g) => {
        const tv = g.items.reduce((s, x) => s + x.value, 0);
        const tp = g.items.reduce((s, x) => s + x.pnl, 0);
        const rows = [...g.items].sort(sorter).map((it) => {
          const r = rate(it);
          const L = it.lvi;
          const band = lvBand(L?.lv);
          const href = !it.added && CHART[it.symbol] ? `ungjup.html#${CHART[it.symbol]}` : null;
          const tag = it.added ? "button" : href ? "a" : "div";
          const attrs = it.added ? ` type="button" data-edit="${esc(it.id)}"` : href ? ` href="${href}"` : "";
          const badgeTitle = L?.lv != null ? `웅줍LV ${L.lv}${L.short ? " (상장 이력이 짧아 추정)" : ""}` : "웅줍LV 없음";
          const sub = [it.sub, qtyS(it.qty)].filter(Boolean).join(" · ");
          return `<${tag} class="h-row${it.added ? " added" : ""}"${attrs}>
            <div class="lv-badge lv-${band}${L?.short ? " est" : ""}" title="${badgeTitle}">
              <small>LV</small><span>${L?.lv ?? "–"}</span>
            </div>
            <div class="h-left">
              <div class="h-name"><span class="nm">${esc(it.name)}</span>${L?.zone === 2 ? '<span class="tag-zone">웅줍</span>' : ""}${it.added ? '<span class="tag-added">직접 추가</span>' : ""}</div>
              <div class="h-qty">${sub}</div>
            </div>
            <div class="h-right">
              <div class="h-val">${won(it.value)}</div>
              <div class="h-pnl ${cls(it.pnl)}">${signed(it.pnl)} (${pctS(r)})</div>
            </div>
          </${tag}>`;
        }).join("");
        return `<section class="h-group">
          <div class="h-ghead">
            <h2>${g.name}<span>${g.items.length}</span></h2>
            <div class="h-gsum">${won(tv)} <span class="${cls(tp)}">${pctS(tp / (tv - tp))}</span></div>
          </div>
          <div class="h-rows">${rows}</div>
        </section>`;
      }).join("") + `<p class="h-foot">${h.asof} 기준 · LV 배지는 웅줍LV(1~1000), 900 이상이 웅줍권</p>`;
      $("h-list").querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openSheet(b.dataset.edit)));
    };
    holdings.render = render;
    render();
    if (bound) return; // 이벤트는 한 번만 연결 (새로고침 때 다시 그려도 중복되지 않게)
    bound = true;
    $("h-sort").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      $("h-sort").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      sort = b.dataset.sort;
      holdings.render();
    });
    setupSheet();
  }

  // ---------- 종목 검색 · 추가 ----------
  let SYM = null, picked = null, editing = null;
  const norm = (t) => (t || "").toLowerCase().replace(/[\s.\-·]/g, "");
  async function symbols() {
    if (!SYM) {
      const d = await fetch("data/ungjup/symbols.json").then((r) => r.json());
      SYM = d.rows.map(([symbol, ko, en, market, etf]) => ({ symbol, ko, en, market, etf, k: norm(ko), e: norm(en), s: norm(symbol) }));
    }
    return SYM;
  }
  function search(q) {
    const n = norm(q);
    if (!n) return [];
    const out = [];
    for (const x of SYM) {
      let sc = -1;
      const code = x.s.replace(/(ks|kq)$/, "");
      if (x.s === n || code === n) sc = 0;
      else if (x.k === n) sc = 0.5;
      else if (x.s.startsWith(n)) sc = 1;
      else if (x.k.startsWith(n)) sc = 2;
      else if (x.e.startsWith(n)) sc = 3;
      else if (x.k.includes(n)) sc = 4;
      else if (n.length >= 3 && x.e.includes(n)) sc = 5;
      if (sc >= 0) out.push([sc + (x.market === "US" && x.ko ? -0.3 : 0) + (x.etf ? 0.1 : 0), x]);
    }
    return out.sort((a, b) => a[0] - b[0] || (a[1].ko || a[1].en).length - (b[1].ko || b[1].en).length).slice(0, 30).map((p) => p[1]);
  }
  const MKT = { US: "미국", KOSPI: "코스피", KOSDAQ: "코스닥" };
  const title = (x) => x.ko || x.en || x.symbol;

  function setupSheet() {
    const dlg = $("add-dlg");
    $("add-btn").addEventListener("click", () => openSheet());
    dlg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => dlg.close()));
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    let t;
    $("q").addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        await symbols();
        const res = search($("q").value);
        $("sym-hint").hidden = res.length > 0;
        if (!res.length && $("q").value.trim()) { $("sym-hint").hidden = false; $("sym-hint").textContent = "검색 결과가 없어요."; }
        $("sym-list").innerHTML = res.map((x, i) => `<li><button type="button" data-i="${i}">
            <span class="sym-nm">${esc(title(x))}${x.etf ? '<em>ETF</em>' : ""}</span>
            <span class="sym-sub">${esc(x.symbol.replace(/\.(KS|KQ)$/, ""))} · ${MKT[x.market]}${x.ko && x.en ? " · " + esc(x.en) : ""}</span></button></li>`).join("");
        $("sym-list").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => pick(res[+b.dataset.i])));
      }, 120);
    });
    $("picked").addEventListener("click", () => showStep("search"));
    $("step-form").addEventListener("submit", (e) => { e.preventDefault(); save(); });
    $("f-del").addEventListener("click", () => {
      writeAdded(readAdded().filter((a) => a.id !== editing));
      location.reload();
    });
    $("f-export").addEventListener("click", async () => {
      const list = readAdded().map(({ id, market, added, ...rest }) => rest);
      const txt = JSON.stringify(list, null, 2);
      try { await navigator.clipboard.writeText(txt); $("f-export").textContent = "복사됨 ✓"; }
      catch (e) { prompt("아래 내용을 복사하세요", txt); }
    });
  }
  function showStep(which) {
    $("step-search").hidden = which !== "search";
    $("step-form").hidden = which !== "form";
    if (which === "search") setTimeout(() => $("q").focus(), 50);
  }
  function pick(x) {
    picked = { symbol: x.symbol, name: title(x), market: x.market === "US" ? "US" : "KR", etf: x.etf };
    $("picked").innerHTML = `<b>${esc(picked.name)}</b><span>${esc(x.symbol)} · ${MKT[x.market]} · 바꾸기</span>`;
    $("f-type").value = x.etf ? "테마·섹터 ETF" : "개별 종목";
    showStep("form");
    setTimeout(() => $("f-qty").focus(), 50);
  }
  function openSheet(id) {
    editing = id || null;
    const dlg = $("add-dlg");
    $("add-title").textContent = editing ? "직접 추가한 종목 수정" : "종목 추가";
    $("f-del").hidden = !editing;
    $("f-export").textContent = "반영용 JSON 복사";
    if (editing) {
      const a = readAdded().find((x) => x.id === editing);
      picked = { symbol: a.symbol, name: a.name, market: a.market };
      $("picked").innerHTML = `<b>${esc(a.name)}</b><span>${esc(a.symbol)} · 바꾸기</span>`;
      $("f-qty").value = a.qty ?? ""; $("f-value").value = a.value; $("f-pnl").value = a.pnl; $("f-type").value = a.type;
      showStep("form");
    } else {
      $("q").value = ""; $("sym-list").innerHTML = "";
      $("sym-hint").hidden = false; $("sym-hint").textContent = "미국·한국 상장 종목과 ETF를 찾을 수 있어요.";
      ["f-qty", "f-value"].forEach((k) => ($(k).value = "")); $("f-pnl").value = 0;
      showStep("search");
      symbols(); // 목록 미리 받기
    }
    dlg.showModal();
  }
  function save() {
    const item = {
      id: editing || "a" + Date.now().toString(36),
      name: picked.name, symbol: picked.symbol, market: picked.market,
      qty: $("f-qty").value === "" ? null : +$("f-qty").value,
      value: Math.round(+$("f-value").value || 0), pnl: Math.round(+$("f-pnl").value || 0),
      type: $("f-type").value, addedAt: new Date().toISOString().slice(0, 10),
    };
    const list = readAdded().filter((a) => a.id !== item.id);
    list.push(item);
    writeAdded(list);
    location.reload();
  }

  // ---------- 자산 ----------
  function wealth({ h }) {
    const all = h.groups.flatMap((g) => g.items);
    const total = all.reduce((s, x) => s + x.value, 0);
    const pnl = all.reduce((s, x) => s + x.pnl, 0);
    const cost = total - pnl;
    $("w-asof").textContent = h.asof + " 기준";

    const stack = (parts) => `<div class="w-stack">${parts.filter((p) => p.v > 0).map((p) =>
      `<i style="flex:${p.v} 1 0;background:var(${p.c})" title="${p.k} ${(p.v / total * 100).toFixed(1)}%"></i>`).join("")}</div>`;
    const legend = (parts, extra) => `<ul class="w-legend">${parts.map((p) => `<li>
        <span class="dot" style="background:var(${p.c})"></span><span class="k">${p.k}</span>
        <span class="p">${(p.v / total * 100).toFixed(1)}%</span><span class="v">${won(p.v)}</span>${extra ? extra(p) : ""}</li>`).join("")}</ul>`;
    const bars = (rows) => `<ul class="w-bars">${rows.map((r) => `<li>
        <div class="w-bar-top"><span class="k">${r.k}</span><span class="v">${won(r.v)}<b>${(r.v / total * 100).toFixed(1)}%</b></span></div>
        <div class="w-bar"><i style="width:${r.v / rows[0].v * 100}%"></i></div>
        ${r.sub ? `<div class="w-bar-sub">${r.sub}</div>` : ""}</li>`).join("")}</ul>`;

    // 시장별
    const byGroup = h.groups.map((g, i) => ({
      k: g.name, c: `--cat-${i + 1}`,
      v: g.items.reduce((s, x) => s + x.value, 0), p: g.items.reduce((s, x) => s + x.pnl, 0),
    }));
    // 유형별
    const types = {};
    all.forEach((x) => { (types[x.type] ||= { k: x.type, v: 0, p: 0, n: 0 }); types[x.type].v += x.value; types[x.type].p += x.pnl; types[x.type].n++; });
    const byType = Object.values(types).sort((a, b) => b.v - a.v)
      .map((t) => ({ ...t, sub: `${t.n}종목 · <span class="${cls(t.p)}">${pctS(t.p / (t.v - t.p))}</span>` }));
    // 웅줍LV 분포 (금액 가중)
    const withLv = all.filter((x) => x.lvi && x.lvi.lv != null);
    const lvW = withLv.reduce((s, x) => s + x.value * x.lvi.lv, 0) / withLv.reduce((s, x) => s + x.value, 0);
    const band = (lo, hi) => withLv.filter((x) => x.lvi.lv >= lo && x.lvi.lv < hi).reduce((s, x) => s + x.value, 0);
    const lvParts = [
      { k: "LV 900 이상", c: "--lv-high", v: band(900, 1001) },
      { k: "LV 400~900", c: "--lv-mid", v: band(400, 900) },
      { k: "LV 400 미만", c: "--lv-low", v: band(0, 400) },
    ];
    // 상위 종목
    const top = [...all].sort((a, b) => b.value - a.value).slice(0, 5)
      .map((x) => ({ k: x.name, v: x.value, sub: `<span class="${cls(x.pnl)}">${pctS(rate(x))}</span>${x.lvi?.lv != null ? ` · LV ${x.lvi.lv}` : ""}` }));
    const top5 = top.reduce((s, x) => s + x.v, 0);

    $("w-root").innerHTML = `
      <section class="w-hero">
        <div class="w-k">총 평가금액</div>
        <div class="w-total">${won(total)}</div>
        <div class="w-pnl ${cls(pnl)}">${signed(pnl)} (${pctS(pnl / cost)})</div>
        <div class="w-cost">투자원금 ${won(cost)}</div>
      </section>

      <div class="w-grid">
        <section class="w-card">
          <h2>시장별 비중</h2>
          ${stack(byGroup)}
          ${legend(byGroup, (p) => `<span class="r ${cls(p.p)}">${pctS(p.p / (p.v - p.p), 1)}</span>`)}
        </section>

        <section class="w-card">
          <h2>포트폴리오 웅줍LV</h2>
          <div class="w-lv"><span class="lv-${lvBand(lvW)}">${Math.round(lvW)}</span><small>금액 가중 평균</small></div>
          ${stack(lvParts)}
          ${legend(lvParts)}
        </section>

        <section class="w-card">
          <h2>유형별 비중</h2>
          ${bars(byType)}
        </section>

        <section class="w-card">
          <h2>상위 5종목 <small>전체의 ${(top5 / total * 100).toFixed(1)}%</small></h2>
          ${bars(top)}
        </section>
      </div>`;
  }

  const show = (d) => {
    if ($("h-list")) { holdings(d); news(); }
    if ($("w-root")) wealth(d);
  };
  load().then(show).catch(() => {
    const el = $("h-list") || $("w-root");
    if (el) el.innerHTML = '<p class="h-foot">데이터를 불러오지 못했습니다.</p>';
  });
  // 오른쪽 아래 새로고침 버튼: 최신 파일로 다시 그림 (정렬·스크롤 위치는 그대로)
  window.addEventListener("datarefresh", (e) => e.detail.tasks.push(load().then(show)));
})();
