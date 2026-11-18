// 웅줍 지표 페이지: 자산 카드 슬라이드 + 캔버스 차트 (외부 라이브러리 없음)
(() => {
  const DATA = "data/ungjup/";
  const $ = (id) => document.getElementById(id);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const state = { assets: [], cache: {}, cur: null, range: 3, log: false, view: null };

  const ZONE_LABEL = ["평상시", "관심 (옅은 음영)", "웅줍 구간 (진한 음영)"];
  const fmtNum = (v, unit) => {
    if (v == null) return "-";
    const d = Math.abs(v) >= 1000 ? 0 : 2;
    const s = v.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
    return unit === "₩" ? s + "원" : (unit || "") + s;
  };
  const pct = (v, d = 1) => (v == null ? "-" : (v > 0 ? "+" : "") + (v * 100).toFixed(d) + "%");
  const LV_MAX = 1000;
  const lvColor = (lv) => (lv >= 800 ? css("--lv-high") : lv >= 400 ? css("--lv-mid") : css("--lv-low"));

  // ---------- 자산 카드 ----------
  function renderCards() {
    const box = $("uj-carousel");
    box.innerHTML = "";
    state.assets.forEach((a) => {
      const L = a.last;
      const b = document.createElement("button");
      b.className = "uj-card";
      b.setAttribute("role", "tab");
      b.dataset.id = a.id;
      b.innerHTML = `
        <div class="nm">${a.name}</div>
        <div class="ds">${a.desc}</div>
        <div class="lv"><small>LV</small>${L.lv ?? "-"}</div>
        <div class="bar"><i style="width:${(L.lv ?? 0) / LV_MAX * 100}%;background:${lvColor(L.lv)}"></i></div>
        <span class="uj-chip z${L.zone}">${ZONE_LABEL[L.zone]}</span>`;
      b.addEventListener("click", () => select(a.id, true));
      box.appendChild(b);
    });
    // 가운데로 스크롤된 카드를 자동 선택 (손가락으로 밀었을 때)
    let t;
    box.addEventListener("scroll", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (!box.dataset.userScroll) return;
        delete box.dataset.userScroll;
        const mid = box.scrollLeft + 24;
        let best = null, bd = Infinity;
        [...box.children].forEach((c) => {
          const d = Math.abs(c.offsetLeft - box.offsetLeft - mid);
          if (d < bd) { bd = d; best = c; }
        });
        if (best && best.dataset.id !== state.cur) select(best.dataset.id, false);
      }, 160);
    }, { passive: true });
    ["touchstart", "wheel", "pointerdown"].forEach((ev) =>
      box.addEventListener(ev, () => (box.dataset.userScroll = "1"), { passive: true }));
  }

  document.querySelectorAll(".uj-arrow").forEach((btn) =>
    btn.addEventListener("click", () => {
      const i = state.assets.findIndex((a) => a.id === state.cur);
      const n = state.assets.length;
      select(state.assets[(i + Number(btn.dataset.dir) + n) % n].id, true);
    }));

  async function select(id, scrollCard) {
    state.cur = id;
    document.querySelectorAll(".uj-card").forEach((c) => {
      const on = c.dataset.id === id;
      c.setAttribute("aria-selected", on);
      if (on && scrollCard) {
        const box = $("uj-carousel");
        box.scrollTo({ left: c.offsetLeft - box.offsetLeft - 2, behavior: "smooth" });
      }
    });
    try { history.replaceState(null, "", "#" + id); } catch (e) {}
    if (!state.cache[id]) {
      const r = await fetch(DATA + id + ".json");
      state.cache[id] = await r.json();
    }
    if (state.cur !== id) return;
    renderSummary();
    renderExplain();
    renderTable();
    draw();
  }

  // ---------- 요약 / 설명 / 표 ----------
  function renderSummary() {
    const { meta } = state.cache[state.cur];
    const L = meta.last, u = meta.unit;
    const items = [
      ["웅줍LV", `<span style="color:${lvColor(L.lv)}">${L.lv ?? "-"}</span>`, ZONE_LABEL[L.zone]],
      ["종가", fmtNum(L.close, u), L.date],
      ["20일선", fmtNum(L.sma20, u), "종가 대비 " + pct(L.close / L.sma20 - 1)],
      ["200일선", fmtNum(L.sma200, u), "이격도 " + pct(L.gap200)],
      ["웅줍라인", fmtNum(L.ujline, u), "종가 대비 " + pct(L.ujline / L.close - 1)],
      ["RSI(14)", L.rsi?.toFixed(1) ?? "-", L.rsi < 33 ? "33 미만" : "33까지 " + (L.rsi - 33).toFixed(1)],
      ["52주 고점 대비", pct(-L.dd52), ""],
    ];
    $("uj-summary").innerHTML = items.map(([k, v, s]) =>
      `<div class="uj-stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join("");
  }

  function renderExplain() {
    const { meta } = state.cache[state.cur];
    const [a, b, c, d] = meta.coef;
    const mp = meta.map || { knee: 90, knee_lv: 900, tau: 25 };
    const sg = (v) => (v < 0 ? " − " : " + ") + Math.abs(v).toFixed(1);
    $("uj-formula").innerHTML =
      `${meta.name}  점수 x = ${a.toFixed(1)}${sg(b)}×√(52주 고점 대비 하락률)${sg(c)}×(200일선 이격도)${sg(d)}×RSI<br>` +
      `웅줍LV = x ≤ ${mp.knee} 이면 1 + (x − 1) × ${((mp.knee_lv - 1) / (mp.knee - 1)).toFixed(2)}  ·  ` +
      `x > ${mp.knee} 이면 ${mp.knee_lv} + ${LV_MAX - mp.knee_lv} × (1 − e^(−(x − ${mp.knee}) / ${mp.tau}))  → 1~${LV_MAX}`;
    $("uj-mdd").textContent = Math.round(meta.min_dd * 100) + "%";
    const st = meta.stats;
    const rows = st.by_level.map((r) =>
      `<tr><td>LV ${r.range}</td><td>${r.days.toLocaleString()}일</td><td>${r.fwd1y_median != null ? pct(r.fwd1y_median, 0) : "-"}</td><td>${r.fwd1y_up != null ? Math.round(r.fwd1y_up * 100) + "%" : "-"}</td></tr>`).join("");
    $("uj-stats").innerHTML =
      `<thead><tr><th>구간</th><th>해당 일수</th><th>1년 뒤 중앙값</th><th>1년 뒤 상승 확률</th></tr></thead><tbody>${rows}</tbody>
       <tfoot><tr><td colspan="4" style="text-align:left;color:var(--color-muted)">과거 하락장 ${st.episodes}개 · 바닥일 웅줍LV 중앙값 ${st.bottom_lv_median} · 바닥일 중 LV900 이상 ${Math.round((st.bottom_lv900_share || 0) * 100)}%</td></tr></tfoot>`;
  }

  function renderTable() {
    const { meta, rows: R } = state.cache[state.cur];
    const n = R.d.length, u = meta.unit;
    let h = "<thead><tr><th>날짜</th><th>종가</th><th>20일선</th><th>200일선</th><th>웅줍라인</th><th>RSI</th><th>웅줍LV</th><th>상태</th></tr></thead><tbody>";
    for (let i = n - 1; i >= Math.max(0, n - 10); i--) {
      h += `<tr><td>${R.d[i]}</td><td>${fmtNum(R.c[i], u)}</td><td>${fmtNum(R.s20[i], u)}</td><td>${fmtNum(R.s200[i], u)}</td><td>${fmtNum(R.uj[i], u)}</td><td>${R.rsi[i] ?? "-"}</td><td>${R.lv[i] ?? "-"}</td><td>${ZONE_LABEL[R.z[i]]}</td></tr>`;
    }
    $("uj-table").innerHTML = h + "</tbody>";
  }

  // ---------- 컨트롤 ----------
  function seg(id, key, parse) {
    $(id).addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      $(id).querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      state[key] = parse(b.dataset[key]);
      if (state.cur && state.cache[state.cur]) draw();
    });
  }
  seg("uj-range", "range", Number);
  $("uj-log").addEventListener("change", (e) => { state.log = e.target.checked; draw(); });

  function renderLegend() {
    $("uj-legend").innerHTML = `
      <li>종가 색 = 웅줍LV:</li>
      <li><span class="sw" style="border-color:${css("--chart-price")}"></span>400 미만</li>
      <li><span class="sw" style="border-color:${css("--lv-mid")}"></span>400~900</li>
      <li><span class="sw" style="border-color:${css("--lv-high")}"></span>900 이상</li>
      <li><span class="sw" style="border-color:${css("--chart-s20")}"></span>20일선</li>
      <li><span class="sw" style="border-color:${css("--chart-s200")}"></span>200일선</li>
      <li><span class="sw dash" style="border-color:${css("--chart-uj")}"></span>웅줍라인</li>
      <li><span class="box" style="background:${css("--chart-zone1")}"></span>관심</li>
      <li><span class="box" style="background:${css("--chart-zone2")}"></span>웅줍 구간</li>
      <li><span class="sw dash" style="border-color:${css("--chart-truth")}"></span>사후 정답 레벨 (아래)</li>`;
  }

  // ---------- 차트 ----------
  const canvas = $("uj-canvas"), overlay = $("uj-overlay"), tip = $("uj-tip"), wrap = $("uj-chart");

  function niceTicks(lo, hi, count) {
    const span = hi - lo;
    const step0 = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) || 10 * mag;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
    return out;
  }

  function draw() {
    const pack = state.cache[state.cur];
    if (!pack) return;
    renderLegend();
    const R = pack.rows, n = R.d.length;
    let start = 0;
    if (state.range > 0) {
      const last = new Date(R.d[n - 1]);
      last.setDate(last.getDate() - Math.round(state.range * 365));
      const cut = last.toISOString().slice(0, 10);
      while (start < n - 1 && R.d[start] < cut) start++;
    }
    const dpr = window.devicePixelRatio || 1;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    [canvas, overlay].forEach((c) => { c.width = W * dpr; c.height = H * dpr; });
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const narrow = W < 520;
    const padL = 8, padR = narrow ? 52 : 64, padT = 8, gap = 26, padB = 24;
    const lowerH = Math.round((H - padT - gap - padB) * 0.36);
    const topH = H - padT - gap - padB - lowerH;
    const x0 = padL, x1 = W - padR;
    const cnt = n - start;
    const xAt = (i) => x0 + ((i - start) / Math.max(1, cnt - 1)) * (x1 - x0);

    // 가격 범위
    let lo = Infinity, hi = -Infinity;
    for (let i = start; i < n; i++) {
      for (const k of ["c", "s20", "s200", "uj"]) {
        const v = R[k][i];
        if (v != null && v > 0) { if (v < lo) lo = v; if (v > hi) hi = v; }
      }
    }
    const useLog = state.log;
    const tf = (v) => (useLog ? Math.log(v) : v);
    let tlo = tf(lo), thi = tf(hi);
    const padv = (thi - tlo) * 0.06; tlo -= padv; thi += padv;
    const yP = (v) => padT + (1 - (tf(v) - tlo) / (thi - tlo)) * topH;
    const ly0 = padT + topH + gap;
    const yL = (v) => ly0 + (1 - v / LV_MAX) * lowerH;

    // 음영 (두 패널 모두)
    const step = (x1 - x0) / Math.max(1, cnt - 1);
    const zc = [null, css("--chart-zone1"), css("--chart-zone2")];
    let runStart = start;
    for (let i = start + 1; i <= n; i++) {
      if (i === n || R.z[i] !== R.z[runStart]) {
        const z = R.z[runStart];
        if (z) {
          ctx.fillStyle = zc[z];
          const xa = xAt(runStart) - step / 2, xb = xAt(i - 1) + step / 2;
          ctx.fillRect(Math.max(x0, xa), padT, Math.min(x1, xb) - Math.max(x0, xa), topH);
        }
        runStart = i;
      }
    }

    // 격자 + 눈금
    ctx.font = `${narrow ? 10 : 11}px system-ui, sans-serif`;
    ctx.fillStyle = css("--chart-axis");
    ctx.strokeStyle = css("--chart-grid");
    ctx.lineWidth = 1;
    let yt;
    if (useLog) {
      yt = [];
      const e0 = Math.floor(Math.log10(lo)), e1 = Math.ceil(Math.log10(hi));
      for (let e = e0; e <= e1; e++) for (const m of [1, 2, 5]) {
        const v = m * Math.pow(10, e);
        if (v >= Math.exp(tlo) && v <= Math.exp(thi)) yt.push(v);
      }
    } else {
      yt = niceTicks(tlo, thi, narrow ? 5 : 6);
    }
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    yt.forEach((v) => {
      const y = yP(v);
      ctx.beginPath(); ctx.moveTo(x0, y + 0.5); ctx.lineTo(x1, y + 0.5); ctx.stroke();
      ctx.fillText(v >= 1000 ? Math.round(v).toLocaleString("ko-KR") : +v.toFixed(2), x1 + 6, y);
    });
    [1, 500, 1000].forEach((v) => {
      const y = yL(v);
      ctx.beginPath(); ctx.moveTo(x0, y + 0.5); ctx.lineTo(x1, y + 0.5); ctx.stroke();
      ctx.fillText(v, x1 + 6, y);
    });

    // x축 날짜
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    const spanDays = (new Date(R.d[n - 1]) - new Date(R.d[start])) / 864e5;
    const byMonth = spanDays < 800;
    const every = spanDays < 400 ? 2 : spanDays < 800 ? 3 : spanDays < 2000 ? 12 : spanDays < 5000 ? 24 : 60;
    let lastX = -Infinity, prevKey = null;
    for (let i = start; i < n; i++) {
      const y = +R.d[i].slice(0, 4), m = +R.d[i].slice(5, 7);
      const key = byMonth ? y * 12 + m : y;
      if (key === prevKey) continue;
      prevKey = key;
      const ok = byMonth ? (m - 1) % every === 0 : (y % (every / 12)) === 0;
      if (!ok || i === start) continue;
      const x = xAt(i);
      if (x - lastX < (narrow ? 44 : 56)) continue;
      lastX = x;
      ctx.strokeStyle = css("--chart-grid");
      ctx.beginPath(); ctx.moveTo(x + 0.5, padT); ctx.lineTo(x + 0.5, ly0 + lowerH); ctx.stroke();
      ctx.fillText(byMonth ? `${String(y).slice(2)}.${String(m).padStart(2, "0")}` : y, x, ly0 + lowerH + 6);
    }

    // 선 그리기
    const line = (arr, yf, color, w, dash) => {
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []);
      ctx.lineJoin = "round"; ctx.beginPath();
      let pen = false;
      for (let i = start; i < n; i++) {
        const v = arr[i];
        if (v == null || (useLog && v <= 0 && yf === yP)) { pen = false; continue; }
        const x = xAt(i), y = yf(v);
        pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        pen = true;
      }
      ctx.stroke(); ctx.setLineDash([]);
    };
    const thin = cnt > 2500;
    line(R.s200, yP, css("--chart-s200"), 2);
    line(R.s20, yP, css("--chart-s20"), 1.2);
    line(R.uj, yP, css("--chart-uj"), 1.4, [5, 3]);
    // 종가: 웅줍LV 구간에 따라 색을 바꿔 그림
    const bucket = (lv) => (lv == null ? 0 : lv >= 900 ? 2 : lv >= 400 ? 1 : 0);
    const pc = [css("--chart-price"), css("--lv-mid"), css("--lv-high")];
    ctx.lineWidth = thin ? 1.1 : 1.7; ctx.lineJoin = "round";
    let segStart = start;
    for (let i = start + 1; i <= n; i++) {
      if (i < n && bucket(R.lv[i]) === bucket(R.lv[segStart])) continue;
      ctx.strokeStyle = pc[bucket(R.lv[segStart])];
      ctx.beginPath();
      // 앞 구간과 이어지도록 한 칸 앞에서 시작
      for (let k = Math.max(start, segStart - 1); k < i; k++) {
        const v = R.c[k];
        if (v == null) continue;
        k === Math.max(start, segStart - 1) ? ctx.moveTo(xAt(k), yP(v)) : ctx.lineTo(xAt(k), yP(v));
      }
      ctx.stroke();
      segStart = i;
    }

    // 웅줍LV: 높이에 따라 색이 변하는 면 + 선
    const grad = (alpha) => {
      const g = ctx.createLinearGradient(0, yL(1), 0, yL(LV_MAX));
      g.addColorStop(0, css("--lv-low")); g.addColorStop(0.5, css("--lv-mid")); g.addColorStop(0.9, css("--lv-high")); g.addColorStop(1, css("--lv-high"));
      return g;
    };
    ctx.save();
    ctx.beginPath();
    let open = false, firstX = 0, lastXp = 0;
    for (let i = start; i < n; i++) {
      const v = R.lv[i];
      if (v == null) continue;
      const x = xAt(i);
      if (!open) { ctx.moveTo(x, yL(1)); firstX = x; open = true; }
      ctx.lineTo(x, yL(v)); lastXp = x;
    }
    if (open) {
      ctx.lineTo(lastXp, yL(1)); ctx.lineTo(firstX, yL(1)); ctx.closePath();
      ctx.globalAlpha = 0.28; ctx.fillStyle = grad(); ctx.fill();
    }
    ctx.restore();
    line(R.tr, yL, css("--chart-truth"), 1.4, [3, 2]);
    line(R.lv, yL, grad(), thin ? 1 : 1.6);
    // 900 기준선 (과거 바닥권)
    ctx.strokeStyle = css("--lv-high"); ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(x0, yL(900) + 0.5); ctx.lineTo(x1, yL(900) + 0.5); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css("--lv-high"); ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("900", x1 + 6, yL(900));

    ctx.fillStyle = css("--chart-axis");
    ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText("웅줍LV (1~1000) · 점선 900 = 과거 바닥권", x0 + 2, ly0 - 4);

    state.view = { start, n, xAt, x0, x1, yP, yL, padT, ly0, lowerH, topH, W, H, dpr };
    overlay.getContext("2d").clearRect(0, 0, overlay.width, overlay.height);
    tip.hidden = true;
  }

  // 크로스헤어 + 툴팁
  function hover(clientX) {
    const v = state.view, pack = state.cache[state.cur];
    if (!v || !pack) return;
    const R = pack.rows, u = pack.meta.unit;
    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left;
    if (x < v.x0 || x > v.x1) { leave(); return; }
    const i = Math.round(v.start + ((x - v.x0) / (v.x1 - v.x0)) * (v.n - 1 - v.start));
    const cx = v.xAt(i);
    const o = overlay.getContext("2d");
    o.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    o.clearRect(0, 0, v.W, v.H);
    o.strokeStyle = css("--chart-axis"); o.lineWidth = 1; o.setLineDash([3, 3]);
    o.beginPath(); o.moveTo(cx + 0.5, v.padT); o.lineTo(cx + 0.5, v.ly0 + v.lowerH); o.stroke();
    o.setLineDash([]);
    const dot = (y, c) => { o.fillStyle = c; o.beginPath(); o.arc(cx, y, 3.5, 0, Math.PI * 2); o.fill(); o.strokeStyle = css("--color-bg"); o.lineWidth = 1.5; o.stroke(); };
    if (R.c[i] != null) dot(v.yP(R.c[i]), css("--chart-price"));
    const lowV = R.lv[i];
    if (lowV != null) dot(v.yL(lowV), css("--chart-price"));

    const row = (k, val) => `<div class="r"><span>${k}</span><span>${val}</span></div>`;
    tip.innerHTML = `<div class="t">${R.d[i]} · ${ZONE_LABEL[R.z[i]]}</div>` +
      row("종가", fmtNum(R.c[i], u)) + row("20일선", fmtNum(R.s20[i], u)) + row("200일선", fmtNum(R.s200[i], u)) +
      row("웅줍라인", fmtNum(R.uj[i], u)) + row("RSI", R.rsi[i] ?? "-") + row("웅줍LV", R.lv[i] ?? "-") +
      (R.tr[i] != null ? row("사후 정답 레벨", R.tr[i]) : "");
    tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = (cx + 14 + tw > v.W ? cx - tw - 14 : cx + 14) + "px";
    tip.style.top = v.padT + 8 + "px";
  }
  function leave() {
    tip.hidden = true;
    const v = state.view;
    if (v) overlay.getContext("2d").clearRect(0, 0, overlay.width, overlay.height);
  }
  wrap.addEventListener("pointermove", (e) => hover(e.clientX));
  wrap.addEventListener("pointerdown", (e) => hover(e.clientX));
  wrap.addEventListener("pointerleave", leave);

  let rt;
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(draw, 80); }).observe(wrap);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { renderCards(); select(state.cur, false); });

  // 키보드: 좌우 화살표로 자산 이동
  $("uj-carousel").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    document.querySelector(`.uj-arrow[data-dir="${e.key === "ArrowRight" ? 1 : -1}"]`).click();
  });

  // ---------- 시작 ----------
  fetch(DATA + "index.json")
    .then((r) => r.json())
    .then((idx) => {
      state.assets = idx.assets.map((m) => ({ ...m, last: m.last }));
      $("uj-updated").textContent = `데이터 갱신: ${idx.updated} · 카드를 좌우로 밀거나 눌러서 자산을 고르세요.`;
      renderCards();
      const want = location.hash.slice(1);
      select(state.assets.some((a) => a.id === want) ? want : state.assets[0].id, true);
    })
    .catch(() => {
      $("uj-updated").textContent = "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    });
})();
