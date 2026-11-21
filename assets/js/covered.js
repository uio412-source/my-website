// 차트 페이지 하단: 커버드콜 ETF vs 본주 기간별 총수익(분배금 재투자) 비교
// 데이터는 tools/ungjup/covered.py가 배포 때 만드는 data/ungjup/covered.json
(() => {
  const $ = (id) => document.getElementById(id);
  const root = $("cc");
  if (!root) return;

  const PERIODS = [
    { k: "1m", label: "1개월", m: 1 },
    { k: "3m", label: "3개월", m: 3 },
    { k: "6m", label: "6개월", m: 6 },
    { k: "ytd", label: "올해", table: false },
    { k: "1y", label: "1년", m: 12 },
    { k: "3y", label: "3년", m: 36 },
    { k: "all", label: "상장후" },
  ];
  const COLORS = ["--chart-price", "--chart-uj", "--cat-3", "--cat-4"];
  const KEY = "mrstocks.cc";
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  const state = { data: null, group: saved.group || null, period: saved.period || "1y", follow: !saved.group, asset: null };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ group: state.follow ? null : state.group, period: state.period })); } catch (e) {} };

  const pct = (v, d = 1) => (v == null ? "–" : (v > 0.00005 ? "+" : v < -0.00005 ? "−" : "") + Math.abs(v * 100).toFixed(d) + "%");
  const pp = (v) => (v == null ? "–" : (v > 0.00005 ? "+" : v < -0.00005 ? "−" : "") + Math.abs(v * 100).toFixed(1) + "%p");
  const tone = (v) => (v > 0.00005 ? "up" : v < -0.00005 ? "down" : "");
  const ymd = (s) => s.slice(2).replace(/-/g, ".");
  const retBg = (v) => {
    if (v == null || Math.abs(v) < 0.005) return "var(--color-bg-alt)";
    const a = Math.round(10 + Math.min(1, Math.abs(v) / 0.5) * 45);
    return `color-mix(in srgb, var(${v > 0 ? "--color-up" : "--color-down"}) ${a}%, var(--color-bg))`;
  };
  const addMonths = (s, m) => {
    const [y, mo, d] = s.split("-").map(Number);
    const t = new Date(Date.UTC(y, mo - 1 + m, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    t.setUTCDate(Math.min(d, last));
    return t.toISOString().slice(0, 10);
  };
  // 정렬된 날짜 배열에서 target 이하인 마지막 위치
  const atOrBefore = (a, v) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; a[m] <= v ? (lo = m + 1) : (hi = m); } return lo - 1; };

  // ---------- 계산 ----------
  function prep(g) {
    if (g._ready) return g;
    g.items.forEach((it) => {
      const div = new Float64Array(g.d.length);
      it.dv.forEach(([i, a]) => (div[i] += a));
      const tr = new Float64Array(g.d.length);
      tr[0] = 1;
      for (let i = 1; i < g.d.length; i++) tr[i] = tr[i - 1] * (it.c[i] + div[i]) / it.c[i - 1];
      it.div = div;
      it.tr = tr;
    });
    g.last = g.d.length - 1;
    g._ready = true;
    return g;
  }

  function startIndex(g, p) {
    const end = g.d[g.last];
    if (p.k === "all") return 0;
    const target = p.k === "ytd" ? `${+end.slice(0, 4) - 1}-12-31` : addMonths(end, -p.m);
    if (target < g.d[0]) return -1; // 그 기간만큼 함께 거래된 이력이 없음
    return Math.max(0, atOrBefore(g.d, target));
  }

  function stats(g, it, s) {
    const e = g.last;
    const total = it.tr[e] / it.tr[s] - 1;
    const price = it.c[e] / it.c[s] - 1;
    let paid = 0;
    for (let i = s + 1; i <= e; i++) paid += it.div[i];
    let peak = it.tr[s], mdd = 0;
    for (let i = s; i <= e; i++) {
      if (it.tr[i] > peak) peak = it.tr[i];
      mdd = Math.min(mdd, it.tr[i] / peak - 1);
    }
    const days = (new Date(g.d[e]) - new Date(g.d[s])) / 864e5;
    const cagr = days > 400 ? Math.pow(1 + total, 365.25 / days) - 1 : null;
    return { total, price, divPart: total - price, yieldSimple: paid / it.c[s], mdd, cagr };
  }

  const group = () => state.data.groups.find((g) => g.id === state.group) || state.data.groups[0];
  const period = () => PERIODS.find((p) => p.k === state.period) || PERIODS[4];

  // ---------- 그리기 ----------
  function renderGroups() {
    $("cc-group").innerHTML = state.data.groups.map((g) =>
      `<button data-g="${g.id}" class="${g.id === group().id ? "on" : ""}">${g.name}</button>`).join("");
  }

  function renderPeriods(g, cur) {
    $("cc-period").innerHTML = PERIODS.map((p) => {
      const ok = startIndex(g, p) >= 0;
      return `<button data-p="${p.k}" class="${p.k === cur ? "on" : ""}"${ok ? "" : " disabled title=\"함께 거래된 기간이 짧아요\""}>${p.label}</button>`;
    }).join("");
  }

  function renderChart(g, s) {
    const box = $("cc-chart"), svg = $("cc-svg");
    const W = Math.max(280, box.clientWidth), H = box.clientHeight || 200;
    const pad = { l: 40, r: 8, t: 10, b: 22 };
    const e = g.last, n = e - s;
    const series = g.items.map((it) => Array.from({ length: n + 1 }, (_, k) => it.tr[s + k] / it.tr[s] - 1));
    let lo = Math.min(0, ...series.flat()), hi = Math.max(0, ...series.flat());
    const span = hi - lo || 0.02;
    lo -= span * 0.06; hi += span * 0.06;
    const x = (k) => pad.l + (n ? (k / n) : 0) * (W - pad.l - pad.r);
    const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
    // 눈금: 보기 좋은 간격
    const raw = (hi - lo) / 4, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const stepV = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => m >= raw);
    let out = "";
    for (let v = Math.ceil(lo / stepV) * stepV; v <= hi + 1e-12; v += stepV) {
      const yy = y(v).toFixed(1);
      out += `<line class="cc-grid${Math.abs(v) < 1e-9 ? " zero" : ""}" x1="${pad.l}" x2="${W - pad.r}" y1="${yy}" y2="${yy}"/>
        <text class="cc-ax" x="${pad.l - 6}" y="${yy}" text-anchor="end" dominant-baseline="middle">${Math.round(v * 1000) / 10}%</text>`;
    }
    out += `<text class="cc-ax" x="${pad.l}" y="${H - 6}">${ymd(g.d[s])}</text>
      <text class="cc-ax" x="${W - pad.r}" y="${H - 6}" text-anchor="end">${ymd(g.d[e])}</text>`;
    // 본주를 마지막에 그려 위로 오게
    const order = g.items.map((_, i) => i).sort((a, b) => (g.items[a].base ? 1 : 0) - (g.items[b].base ? 1 : 0));
    const stepK = Math.max(1, Math.floor(n / (W - pad.l - pad.r)));
    order.forEach((i) => {
      const pts = [];
      for (let k = 0; k <= n; k += stepK) pts.push(`${x(k).toFixed(1)},${y(series[i][k]).toFixed(1)}`);
      if ((n % stepK) !== 0) pts.push(`${x(n).toFixed(1)},${y(series[i][n]).toFixed(1)}`);
      out += `<polyline class="cc-line${g.items[i].base ? " base" : ""}" style="stroke:var(${COLORS[i]})" points="${pts.join(" ")}"/>`;
    });
    out += `<line id="cc-cross" class="cc-cross" y1="${pad.t}" y2="${H - pad.b}" visibility="hidden"/>`;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.innerHTML = out;
    state.view = { g, s, n, W, pad, x, series };
  }

  function hover(clientX) {
    const v = state.view;
    if (!v || !v.n) return;
    const r = $("cc-chart").getBoundingClientRect();
    const px = clientX - r.left;
    const k = Math.max(0, Math.min(v.n, Math.round((px - v.pad.l) / (v.W - v.pad.l - v.pad.r) * v.n)));
    const cx = v.x(k);
    const cross = $("cc-cross");
    cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("visibility", "visible");
    const tip = $("cc-tip");
    tip.innerHTML = `<div class="t">${v.g.d[v.s + k]}</div>` + v.g.items.map((it, i) =>
      `<div class="r"><span><i class="cc-dot" style="background:var(${COLORS[i]})"></i>${it.short}</span><b class="${tone(v.series[i][k])}">${pct(v.series[i][k])}</b></div>`).join("");
    tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = (cx + 12 + tw > v.W ? cx - tw - 12 : cx + 12) + "px";
    tip.style.top = "6px";
  }
  function leave() {
    $("cc-tip").hidden = true;
    const c = $("cc-cross");
    if (c) c.setAttribute("visibility", "hidden");
  }

  function renderList(g, s) {
    const rows = g.items.map((it, i) => ({ it, i, st: stats(g, it, s) }));
    const base = rows.find((r) => r.it.base);
    $("cc-list").innerHTML = rows.map(({ it, i, st }) => {
      const diff = base && !it.base ? st.total - base.st.total : null;
      return `<div class="cc-row${it.base ? " base" : ""}">
        <div class="cc-nm" title="${it.name} · ${it.symbol}"><i class="cc-dot" style="background:var(${COLORS[i]})"></i><span>${it.short}</span>${it.base ? "<small>본주</small>" : ""}</div>
        <div class="cc-tot"><b class="${tone(st.total)}">${pct(st.total)}</b>${st.cagr != null ? `<small>연 ${pct(st.cagr)}</small>` : ""}</div>
        <div class="cc-diff">${diff == null ? `<span class="muted">기준</span>` : `<b class="${tone(diff)}">${pp(diff)}</b>`}</div>
        <div class="cc-parts"><span>주가 <b class="${tone(st.price)}">${pct(st.price)}</b></span><span>분배금 <b>${pct(st.divPart)}</b></span><span>최대낙폭 <b>${pct(st.mdd)}</b></span></div>
      </div>`;
    }).join("");
  }

  function renderTable(g, cur) {
    const cols = PERIODS.filter((p) => p.table !== false);
    const starts = cols.map((p) => startIndex(g, p));
    const vals = g.items.map((it) => starts.map((s) => (s >= 0 ? stats(g, it, s).total : null)));
    const best = cols.map((_, c) => Math.max(...vals.map((r) => r[c] ?? -Infinity)));
    $("cc-table").style.setProperty("--cc-cols", cols.length);
    $("cc-table").innerHTML =
      `<div class="cc-tr cc-th"><span></span>${cols.map((p, c) =>
        `<button data-p="${p.k}" class="${p.k === cur ? "on" : ""}"${starts[c] < 0 ? " disabled" : ""}>${p.label}</button>`).join("")}</div>` +
      g.items.map((it, i) => `<div class="cc-tr${it.base ? " base" : ""}">
        <span class="cc-nm"><i class="cc-dot" style="background:var(${COLORS[i]})"></i><span>${it.short}</span></span>
        ${vals[i].map((v, c) => `<span class="cell${v == null ? " na" : ""}${cols[c].k === cur ? " on" : ""}${v != null && v === best[c] ? " best" : ""}" style="background:${retBg(v)}">${v == null ? "–" : pct(v, Math.abs(v) >= 0.1 ? 0 : 1)}</span>`).join("")}
      </div>`).join("");
    const cc = g.items.filter((it) => !it.base);
    const youngest = cc.reduce((a, b) => (b.listed > a.listed ? b : a), cc[0] || g.items[0]);
    $("cc-note").textContent = [
      "총수익은 분배금을 배당락일 종가에 다시 산다고 본 세전 수익률이고, 분배금 몫 = 총수익 − 주가 수익률이에요.",
      g.unit === "$" ? "미국 ETF는 달러 기준(환율 변동 제외)이에요." : "",
      `상장후 = ${youngest.short} 상장일(${g.start})부터, 모두 같은 날을 기준으로 비교해요.`,
      `${g.d[g.last]} 종가까지.`,
    ].filter(Boolean).join(" ");
  }

  function render() {
    if (!state.data) return;
    const g = prep(group());
    let p = period();
    if (startIndex(g, p) < 0) { // 이 묶음에서 안 되는 기간이면 가능한 가장 긴 기간으로
      p = [...PERIODS].reverse().find((q) => q.k !== "all" && startIndex(g, q) >= 0) || PERIODS[PERIODS.length - 1];
    }
    const s = startIndex(g, p);
    renderGroups();
    renderPeriods(g, p.k);
    renderChart(g, s);
    renderList(g, s);
    renderTable(g, p.k);
  }

  // ---------- 이벤트 ----------
  $("cc-group").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    state.group = b.dataset.g;
    state.follow = state.data.groups.find((g) => g.asset === state.asset)?.id === state.group;
    save();
    leave();
    render();
  });
  const pickPeriod = (e) => {
    const b = e.target.closest("button[data-p]");
    if (!b || b.disabled) return;
    state.period = b.dataset.p;
    save();
    leave();
    render();
  };
  $("cc-period").addEventListener("click", pickPeriod);
  $("cc-table").addEventListener("click", pickPeriod);

  const chart = $("cc-chart");
  chart.addEventListener("pointermove", (e) => hover(e.clientX));
  chart.addEventListener("pointerdown", (e) => hover(e.clientX));
  chart.addEventListener("pointerleave", leave);

  // 위 지수 카드를 바꾸면 같은 지수 묶음으로 (직접 다른 묶음을 고른 뒤에는 따라가지 않음)
  window.addEventListener("ujasset", (e) => {
    state.asset = e.detail.id;
    if (!state.data || !state.follow) return;
    const g = state.data.groups.find((x) => x.asset === state.asset);
    if (g && g.id !== state.group) { state.group = g.id; leave(); render(); }
  });

  let rt;
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (state.data) { leave(); render(); } }, 100); }).observe(chart);

  async function load() {
    const data = await window.MS.getJSON("data/ungjup/covered.json");
    if (!data?.groups?.length) throw new Error("커버드콜 데이터 없음");
    state.data = data;
    const ids = data.groups.map((g) => g.id);
    if (state.follow || !ids.includes(state.group)) {
      const asset = state.asset || location.hash.slice(1);
      state.group = data.groups.find((g) => g.asset === asset)?.id || ids[0];
    }
    root.hidden = false;
    render();
  }
  load().catch(() => { root.hidden = true; });
  window.addEventListener("datarefresh", (e) => e.detail.tasks.push(load().catch(() => {})));
})();
