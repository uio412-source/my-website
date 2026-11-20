// 줍줍 지표 페이지: 자산 카드 슬라이드 + 캔버스 차트 (외부 라이브러리 없음)
(() => {
  const DATA = "data/ungjup/";
  const $ = (id) => document.getElementById(id);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // 새로고침 버튼(main.js)을 누른 뒤에는 캐시를 건너뛰고 받음
  const getData = (file) => window.MS.getJSON(DATA + file + "?schema=2");
  const state = { assets: [], cache: {}, cur: null, range: 3, log: false, view: null, crashBase: "trough" };

  const ZONE_LABEL = ["평상시", "관심 (옅은 음영)", "줍줍 구간 (진한 음영)"];
  const ZONE_SHORT = ["평상시", "관심", "줍줍"];
  const fmtNum = (v, unit, d = Math.abs(v) >= 1000 ? 0 : 2) => {
    if (v == null) return "-";
    const s = v.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
    return unit === "₩" ? s + "원" : (unit || "") + s;
  };
  const pct = (v, d = 1) => (v == null ? "-" : (v > 0 ? "+" : "") + (v * 100).toFixed(d) + "%");
  const fmtPrice = (v, unit) => fmtNum(v, unit, unit === "$" ? 2 : 0);
  const changeLabel = (change) => {
    const trend = change > 0 ? " up" : change < 0 ? " down" : "";
    return `<span class="uj-change${trend}">${pct(change, 2)}</span>`;
  };
  const LV_MAX = 1000;
  const lvColor = (lv) => (lv >= 900 ? css("--lv-high") : lv >= 400 ? css("--lv-mid") : css("--lv-low"));

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
        <div class="nm">${a.name}<span class="uj-chip z${L.zone}">${ZONE_SHORT[L.zone]}</span></div>
        <div class="lv"><small>LV</small>${L.lv ?? "-"}</div>
        <div class="bar"><i style="width:${(L.lv ?? 0) / LV_MAX * 100}%;background:${lvColor(L.lv)}"></i></div>
        <div class="uj-quote" title="${a.desc} · 전일 대비"><span>${fmtPrice(L.close, a.unit)}</span>${changeLabel(L.change)}</div>`;
      b.addEventListener("click", () => select(a.id, true));
      box.appendChild(b);
    });
    if (box.dataset.bound) return; // 이벤트는 한 번만 연결
    box.dataset.bound = "1";
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

  const step = (dir) => {
    const i = state.assets.findIndex((a) => a.id === state.cur);
    const n = state.assets.length;
    select(state.assets[(i + dir + n) % n].id, true);
  };

  async function select(id, scrollCard) {
    state.cur = id;
    document.querySelectorAll(".uj-card").forEach((c) => {
      const on = c.dataset.id === id;
      c.setAttribute("aria-selected", on);
      if (on && scrollCard) {
        const box = $("uj-carousel");
        // 카드로 자동 이동할 때는 스크롤로 종목을 다시 선택하지 않는다.
        delete box.dataset.userScroll;
        box.scrollTo({ left: c.offsetLeft - box.offsetLeft - 2, behavior: "smooth" });
      }
    });
    try { history.replaceState(null, "", "#" + id); } catch (e) {}
    if (!state.cache[id]) {
      state.cache[id] = await getData(id + ".json");
    }
    if (state.cur !== id) return;
    renderSummary();
    renderRef();
    draw();
  }

  // ---------- 요약 ----------
  function renderSummary() {
    const { meta } = state.cache[state.cur];
    const L = meta.last, u = meta.unit;
    const items = [
      ["줍줍LV", `<span style="color:${lvColor(L.lv)}">${L.lv ?? "-"}</span>`, ZONE_SHORT[L.zone]],
      ["현재가", fmtPrice(L.close, u), `전일 대비 ${changeLabel(L.change)} · ${L.date.slice(5).replace("-", ".")}`],
      ["RSI", L.rsi?.toFixed(1) ?? "-", ""],
      ["200일선", pct(L.gap200), ""],
    ];
    $("uj-summary").innerHTML = items.map(([k, v, s]) =>
      `<div class="uj-stat"><div class="k">${k}</div><div class="v">${v}${s ? `<small>${s}</small>` : ""}</div></div>`).join("");
  }

  // ---------- 참고자료 ----------
  const BANDS = [
    { lo: 1, hi: 400, name: "평온", cls: "b0" },
    { lo: 400, hi: 700, name: "조정", cls: "b1" },
    { lo: 700, hi: 900, name: "깊은 조정", cls: "b2" },
    { lo: 900, hi: 1001, name: "줍줍권", cls: "b3" },
  ];
  const bandOf = (lv) => BANDS.find((b) => lv >= b.lo && lv < b.hi) || BANDS[0];

  // 1) 그라데이션 막대 위에 지수 핀을 꽂아 현재 위치를 한눈에
  function renderSpectrum() {
    const box = $("ref-spec");
    const list = state.assets.filter((a) => a.last.lv != null).sort((a, b) => a.last.lv - b.last.lv);
    box.innerHTML = `
      <div class="spec-pins"></div>
      <div class="spec-track"></div>
      <div class="spec-ticks">${[1, 400, 700, 900, 1000].map((v) => `<span style="left:${(v - 1) / 9.99}%">${v}</span>`).join("")}</div>
      <div class="spec-bands">${BANDS.map((b) => `<span class="${b.cls}" style="left:${(b.lo - 1) / 9.99}%;width:${(Math.min(b.hi, 1000) - b.lo) / 9.99}%">${b.name}</span>`).join("")}</div>`;
    const pins = box.querySelector(".spec-pins");
    const W = pins.clientWidth;
    const chips = list.map((a) => {
      const el = document.createElement("button");
      el.className = "spec-pin " + bandOf(a.last.lv).cls + (a.id === state.cur ? " on" : "");
      el.innerHTML = `${a.name}<b>${a.last.lv}</b>`;
      el.addEventListener("click", () => select(a.id, true));
      pins.appendChild(el);
      return { a, el, x: ((a.last.lv - 1) / 999) * W, w: el.offsetWidth };
    });
    // 겹치지 않게 줄 배정 (가까운 핀은 위 줄로)
    const rowEnd = [];
    const ROW = 30;
    chips.forEach((c) => {
      let left = Math.min(Math.max(0, c.x - c.w / 2), W - c.w);
      let row = rowEnd.findIndex((end) => left > end + 6);
      if (row < 0) { row = rowEnd.length; rowEnd.push(0); }
      rowEnd[row] = left + c.w;
      c.left = left; c.row = row;
    });
    const rows = Math.max(1, rowEnd.length);
    pins.style.height = rows * ROW + 10 + "px";
    chips.forEach((c) => {
      c.el.style.left = c.left + "px";
      c.el.style.bottom = c.row * ROW + 10 + "px";
      const stem = document.createElement("i");
      stem.className = "spec-stem " + bandOf(c.a.last.lv).cls + (c.a.id === state.cur ? " on" : "");
      stem.style.left = c.x + "px";
      stem.style.height = c.row * ROW + 10 + "px";
      pins.appendChild(stem);
    });
  }

  // 2) 선택한 지수의 구간별 1년 뒤 성과 카드
  function renderRef() {
    const { meta } = state.cache[state.cur];
    $("ref-asset").textContent = meta.name;
    const now = meta.last.lv;
    const rows = meta.stats.by_level;
    $("ref-bands").innerHTML = BANDS.map((b, k) => {
      const r = rows[k] || {};
      const up = r.fwd1y_up != null ? Math.round(r.fwd1y_up * 100) : null;
      const here = now != null && now >= b.lo && now < b.hi;
      return `<div class="band-card ${b.cls}${here ? " here" : ""}">
        <div class="band-top"><span class="band-name">${b.name}</span>${here ? '<span class="band-here">지금 여기</span>' : ""}</div>
        <div class="band-range">LV ${b.lo}~${Math.min(b.hi, 1000)}</div>
        <div class="band-big">${up != null ? up + "<small>%</small>" : "-"}</div>
        <div class="band-k">1년 뒤 오른 확률</div>
        <div class="band-bar"><i style="width:${up ?? 0}%"></i></div>
        <div class="band-foot"><span>중앙 수익률 <b class="${(r.fwd1y_median ?? 0) >= 0 ? "up" : "down"}">${r.fwd1y_median != null ? pct(r.fwd1y_median, 0) : "-"}</b></span><span>${r.days ? r.days.toLocaleString() + "일" : ""}</span></div>
      </div>`;
    }).join("");
    renderSpectrum();
    renderCrash();
  }

  // 3) 주요 하락장: 세로 = 고점→저점 낙폭, 가로 = 이후 1·3·6·12개월 수익률
  // [이름, 사건일, 고점을 찾기 시작하는 날, 저점을 찾는 마지막 날] — 계산은 선택한 자산의 종가로 함
  const CRASHES = [
    ["아시아 외환위기", "1997-10-27", "1997-10-01", "1998-01-31"],
    ["러시아 디폴트·LTCM", "1998-08-17", "1998-07-01", "1998-10-31"],
    ["닷컴버블 붕괴", "2000-03-10", "2000-01-01", "2002-12-31"],
    ["9·11 테러", "2001-09-11", "2001-08-01", "2001-10-31"],
    ["리먼 브라더스 파산", "2008-09-15", "2007-07-01", "2009-06-30"],
    ["유럽 재정위기", "2010-05-06", "2010-04-01", "2010-08-31"],
    ["미국 신용등급 강등", "2011-08-05", "2011-04-01", "2011-12-31"],
    ["차이나 쇼크", "2015-08-11", "2015-05-01", "2016-02-29"],
    ["미중 무역전쟁", "2018-10-10", "2018-09-01", "2018-12-31"],
    ["코로나19 팬데믹", "2020-02-24", "2020-01-01", "2020-04-30"],
    ["연준 긴축 쇼크", "2022-01-05", "2021-11-01", "2022-12-31"],
    ["SVB 파산", "2023-03-10", "2023-02-01", "2023-03-31"],
    ["엔캐리 청산", "2024-08-05", "2024-07-01", "2024-08-31"],
    ["트럼프 관세 쇼크", "2025-04-02", "2025-02-01", "2025-05-31"],
  ];
  const HORIZONS = [1, 3, 6, 12];
  const lowerBound = (a, v) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; a[m] < v ? (lo = m + 1) : (hi = m); } return lo; };
  const upperBound = (a, v) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; a[m] <= v ? (lo = m + 1) : (hi = m); } return lo; };
  const addMonths = (s, m) => {
    const [y, mo, d] = s.split("-").map(Number);
    const t = new Date(Date.UTC(y, mo - 1 + m, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    t.setUTCDate(Math.min(d, last));
    return t.toISOString().slice(0, 10);
  };

  function crashStats(R) {
    const D = R.d, C = R.c, n = D.length;
    const fwd = (i) => HORIZONS.map((m) => {
      const j = lowerBound(D, addMonths(D[i], m));
      return j < n && C[j] != null && C[i] ? C[j] / C[i] - 1 : null;
    });
    const list = [];
    let skipped = 0;
    CRASHES.forEach(([name, d, from, to]) => {
      const base = lowerBound(D, d) - 1; // 사건 직전 거래일
      if (D[0] > from || base < 0 || D[n - 1] < d) { skipped++; return; }
      const end = upperBound(D, to);
      let t = -1, p = -1;
      for (let i = base; i < end; i++) if (C[i] != null && (t < 0 || C[i] < C[t])) t = i;
      for (let i = lowerBound(D, from); i <= t; i++) if (C[i] != null && (p < 0 || C[i] > C[p])) p = i;
      if (t < 0 || p < 0) { skipped++; return; }
      list.push({ name, d, peak: D[p], trough: D[t], dd: C[t] / C[p] - 1, trough_f: fwd(t), event_f: fwd(base) });
    });
    return { list, skipped };
  }

  const depthBand = (x) => (x < 0.15 ? "b0" : x < 0.25 ? "b1" : x < 0.4 ? "b2" : "b3");
  const ymd = (s) => s.slice(2).replace(/-/g, ".");
  const fmtRet = (v) => {
    if (v == null) return "–";
    const a = Math.abs(v) * 100;
    return (v > 0.0005 ? "+" : v < -0.0005 ? "−" : "") + (a < 10 ? a.toFixed(1) : Math.round(a));
  };
  const retBg = (v) => {
    if (v == null || Math.abs(v) < 0.005) return "var(--color-bg-alt)";
    const a = Math.round(10 + Math.min(1, Math.abs(v) / 0.6) * 48);
    return `color-mix(in srgb, var(${v > 0 ? "--color-up" : "--color-down"}) ${a}%, var(--color-bg))`;
  };
  const span = (a, b) => {
    const days = (new Date(b) - new Date(a)) / 864e5;
    return days < 60 ? Math.max(1, Math.round(days)) + "일" : Math.round(days / 30.44) + "개월";
  };

  function renderCrash() {
    const pack = state.cache[state.cur];
    if (!pack) return;
    const { meta } = pack;
    const box = $("crash");
    const st = pack.crash || (pack.crash = crashStats(pack.rows));
    const fromEvent = state.crashBase === "event";
    const key = fromEvent ? "event_f" : "trough_f";
    const curD = meta.last.dd52 != null ? Math.abs(meta.last.dd52) : null;
    $("crash-asset").textContent = meta.name;

    const items = st.list.map((e) => ({ ...e, x: Math.abs(e.dd) }));
    if (curD != null) items.push({ now: true, x: curD });
    items.sort((a, b) => a.x - b.x || (a.now ? -1 : 1));
    if (!st.list.length) {
      box.innerHTML = `<p class="crash-empty">이 자산은 데이터 기간 안에 표시할 사건이 없어요.</p>`;
      $("crash-note").textContent = "";
      return;
    }

    // 세로축(낙폭) — 행은 낙폭 순서대로 고르게 놓고, 실제 깊이는 왼쪽 눈금에 점과 선으로 이어 줌
    const cs = getComputedStyle(box);
    const RW = parseFloat(cs.getPropertyValue("--rw")) || 90;
    const RH = parseFloat(cs.getPropertyValue("--rh")) || 50;
    const H = items.length * RH;
    const maxX = Math.max(0.2, Math.ceil(Math.max(...items.map((i) => i.x)) * 10) / 10);
    const yTop = 6, yBot = H - 6;
    const yAt = (x) => yTop + (x / maxX) * (yBot - yTop);
    const tx = Math.round(RW * 0.44), tw = 6, lx = tx + tw;
    const stepT = maxX > 0.6 ? 0.2 : 0.1;
    let svg = `<defs><linearGradient id="crash-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--lv-low)"/><stop offset="${Math.min(1, 0.25 / maxX)}" style="stop-color:var(--lv-mid)"/>
      <stop offset="${Math.min(1, 0.45 / maxX)}" style="stop-color:var(--lv-high)"/><stop offset="1" style="stop-color:var(--lv-high)"/></linearGradient></defs>
      <rect x="${tx}" y="${yTop}" width="${tw}" height="${yBot - yTop}" rx="3" fill="url(#crash-grad)" opacity=".85"/>`;
    for (let v = 0; v <= maxX + 1e-9; v += stepT) {
      const y = yAt(v);
      svg += `<line class="crash-tick" x1="${tx - 4}" x2="${tx}" y1="${y}" y2="${y}"/>
        <text class="crash-tickt" x="${tx - 6}" y="${y}">${v ? "−" + Math.round(v * 100) : "0"}</text>`;
    }
    items.forEach((it, k) => {
      const y = yAt(it.x), ry = k * RH + RH / 2, c = it.now ? "now" : depthBand(it.x);
      const mx = (lx + RW) / 2;
      svg += `<path class="crash-lead ${c}" d="M${lx} ${y} C${mx} ${y} ${mx} ${ry} ${RW} ${ry}"/>`;
      svg += it.now
        ? `<line class="crash-nowline" x1="${tx - 4}" x2="${lx + 3}" y1="${y}" y2="${y}"/><circle class="crash-dot now" cx="${tx + tw / 2}" cy="${y}" r="5.5"/>`
        : `<circle class="crash-dot ${c}" cx="${tx + tw / 2}" cy="${y}" r="3.8"/>`;
    });

    const rows = items.map((it) => {
      if (it.now) {
        return `<div class="crash-row now">
          <div class="ev"><div class="ev-n">지금</div><div class="ev-s"><b>−${(it.x * 100).toFixed(1)}%</b><span class="wide"> · 52주 고점 대비 · ${ymd(meta.last.date)}</span></div></div>
          ${HORIZONS.map(() => `<div class="cell q">?</div>`).join("")}</div>`;
      }
      const near = curD != null && Math.abs(it.x - curD) <= 0.05;
      const f = it[key];
      return `<div class="crash-row ${depthBand(it.x)}${near ? " near" : ""}" title="${it.name} · 사건 ${it.d} · 고점 ${it.peak} → 저점 ${it.trough}">
        <div class="ev"><div class="ev-n">${it.name}${near ? '<span class="crash-tag">비슷</span>' : ""}</div>
          <div class="ev-s"><b>−${(it.x * 100).toFixed(1)}%</b><span class="slim"> · ’${it.d.slice(2, 4)}</span><span class="wide"> · ${ymd(it.d)} · 저점 ${ymd(it.trough)} (고점부터 ${span(it.peak, it.trough)})</span></div></div>
        ${f.map((v) => `<div class="cell${v == null ? " na" : ""}" style="background:${retBg(v)}">${fmtRet(v)}</div>`).join("")}</div>`;
    }).join("");

    // 아래 요약: 중앙값 · 오른 확률
    const cols = HORIZONS.map((_, h) => st.list.map((e) => e[key][h]).filter((v) => v != null).sort((a, b) => a - b));
    const med = (a) => (a.length ? (a.length % 2 ? a[a.length >> 1] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null);
    const upRate = (a) => (a.length ? a.filter((v) => v > 0).length / a.length : null);

    box.innerHTML = `
      <div class="crash-cap"><span>낙폭 %</span><span>${fromEvent ? "사건 직전 종가" : "저점"}에서 샀다면 · 수익률 %</span></div>
      <div class="crash-hd"><span>사건 <small>(낙폭 작은 순)</small></span>${HORIZONS.map((m) => `<span>${m}개월</span>`).join("")}</div>
      <div class="crash-body">
        <svg class="crash-axis" width="${RW}" height="${H}" viewBox="0 0 ${RW} ${H}" aria-hidden="true">${svg}</svg>
        <div class="crash-rows">${rows}</div>
      </div>
      <div class="crash-ft">
        <div><span class="lab">중앙값</span>${cols.map((a) => { const v = med(a); return `<span class="cell" style="background:${retBg(v)}">${fmtRet(v)}</span>`; }).join("")}</div>
        <div><span class="lab">오른 확률</span>${cols.map((a) => { const r = upRate(a); return `<span class="rate"><b>${r == null ? "–" : Math.round(r * 100) + "%"}</b><i><em style="width:${(r ?? 0) * 100}%"></em></i></span>`; }).join("")}</div>
      </div>`;

    const notes = [
      "낙폭은 사건 전후 고점 → 저점(종가 기준), 지금은 52주 고점 대비입니다.",
      fromEvent ? "사건 직전 거래일 종가에 샀을 때의 수익률이에요." : "저점은 지나고 나서야 알 수 있으니 '최선의 경우'로 보세요.",
    ];
    if (st.skipped) notes.push(`${meta.name} 데이터는 ${ymd(pack.rows.d[0])}부터라 그 전 사건 ${st.skipped}개는 빠졌어요.`);
    $("crash-note").textContent = notes.join(" ");
  }

  $("crash-base").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    $("crash-base").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    state.crashBase = b.dataset.base;
    renderCrash();
  });

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

  function renderLegend() {
    $("uj-legend").innerHTML = `
      <li>종가 LV</li>
      <li><span class="sw" style="border-color:${css("--chart-price")}"></span>400 미만</li>
      <li><span class="sw" style="border-color:${css("--lv-mid")}"></span>400~900</li>
      <li><span class="sw" style="border-color:${css("--lv-high")}"></span>900 이상</li>
      <li><span class="sw" style="border-color:${css("--chart-s20")}"></span>20일선</li>
      <li><span class="sw" style="border-color:${css("--chart-s200")}"></span>200일선</li>
      <li><span class="sw dash" style="border-color:${css("--chart-uj")}"></span>줍줍라인</li>
      <li><span class="box" style="background:${css("--chart-zone1")}"></span>관심</li>
      <li><span class="box" style="background:${css("--chart-zone2")}"></span>줍줍 구간</li>
`;
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
    const useLog = false;
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
          // 줍줍 구간은 가격 차트 아래쪽에 진한 띠도 그려서 멀리서도 보이게
          if (z === 2) {
            ctx.fillStyle = css("--chart-zone-strip");
            ctx.fillRect(Math.max(x0, xa), padT + topH - 5, Math.max(1.5, Math.min(x1, xb) - Math.max(x0, xa)), 5);
          }
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
    // 종가: 줍줍LV 구간에 따라 색을 바꿔 그림
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

    // 줍줍LV: 높이에 따라 색이 변하는 면 + 선
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
    line(R.lv, yL, grad(), thin ? 1 : 1.6);
    // 900 기준선 (과거 바닥권)
    ctx.strokeStyle = css("--lv-high"); ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(x0, yL(900) + 0.5); ctx.lineTo(x1, yL(900) + 0.5); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css("--lv-high"); ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("900", x1 + 6, yL(900));
    ctx.fillStyle = css("--chart-axis"); ctx.textAlign = "right";
    ctx.fillText("상위 10%", x1 - 4, yL(900) - 7);

    ctx.fillStyle = css("--chart-axis");
    ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText("줍줍LV", x0 + 2, ly0 - 4);

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
      row("줍줍라인", fmtNum(R.uj[i], u)) + row("RSI", R.rsi[i] ?? "-") + row("줍줍LV", R.lv[i] ?? "-");
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
  window.addEventListener("themechange", () => { renderCards(); select(state.cur, false); });
  let sw;
  window.addEventListener("resize", () => { clearTimeout(sw); sw = setTimeout(() => { if (state.cur && state.cache[state.cur]) { renderSpectrum(); renderCrash(); } }, 120); });

  // 키보드: 좌우 화살표로 자산 이동
  $("uj-carousel").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    step(e.key === "ArrowRight" ? 1 : -1);
  });

  async function loadAssets(scrollCard) {
    const idx = await getData("index.json");
    // 이전 배포 데이터가 캐시에 남아 있더라도 교체된 종목은 표시하지 않는다.
    const assets = idx.assets.filter((asset) => asset.id !== "ndx" && asset.id !== "qld");
    if (!assets.length) throw new Error("차트 데이터 없음");
    const requested = state.cur || location.hash.slice(1);
    const preferred = requested === "ndx" ? "qqq" : requested;
    const id = assets.find((asset) => asset.id === preferred)?.id ?? assets[0].id;

    state.assets = assets;
    state.cache = {};
    renderCards();
    await select(id, scrollCard);
    $("uj-error").hidden = true;
  }

  loadAssets(true).catch(() => { $("uj-error").hidden = false; });

  // 오른쪽 아래 새로고침 버튼: 지수 목록과 지금 보는 지수 데이터를 최신 파일로 다시 그림
  window.addEventListener("datarefresh", (e) => e.detail.tasks.push(loadAssets(false)));
})();
