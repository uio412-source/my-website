// 보유종목 · 자산 페이지 공용 스크립트
(() => {
  const $ = (id) => document.getElementById(id);
  const won = (v) => Math.round(v).toLocaleString("ko-KR") + "원";
  const signed = (v) => (v > 0 ? "+" : v < 0 ? "-" : "") + Math.abs(Math.round(v)).toLocaleString("ko-KR") + "원";
  const pctS = (v, d = 2) => (v > 0 ? "+" : v < 0 ? "-" : "") + Math.abs(v * 100).toFixed(d) + "%";
  const cls = (v) => (v > 0 ? "up" : v < 0 ? "down" : "");
  const qtyS = (q) => q == null ? "" : (+q.toFixed(6)).toLocaleString("ko-KR", { maximumFractionDigits: 6 }) + "주";
  const lvBand = (lv) => (lv == null ? "" : lv >= 900 ? "h" : lv >= 400 ? "m" : "l");
  const rate = (it) => it.pnl / (it.value - it.pnl);
  // 차트 페이지에 있는 지수와 연결
  const CHART = { QLD: "qld", SPY: "spy", GLD: "gld", "^NDX": "ndx", "BTC-USD": "btc" };

  async function load() {
    const [h, lv] = await Promise.all([
      fetch("data/holdings.json").then((r) => r.json()),
      fetch("data/ungjup/holdings_lv.json").then((r) => r.json()).catch(() => ({ items: {} })),
    ]);
    h.groups.forEach((g) => g.items.forEach((it, i) => {
      it.order = i;
      it.group = g.id;
      it.lvi = lv.items[it.symbol] || null;
    }));
    return { h, lvUpdated: lv.updated };
  }

  function lvChip(it) {
    const L = it.lvi;
    if (!L || L.lv == null) return "";
    const zone = L.zone === 2 ? '<span class="tag-zone">웅줍</span>' : "";
    return `<span class="tag-lv lv-${lvBand(L.lv)}" title="웅줍LV${L.short ? " (상장 이력이 짧아 추정)" : ""}">LV ${L.lv}${L.short ? " · 추정" : ""}</span>${zone}`;
  }

  // ---------- 보유종목 ----------
  function holdings({ h }) {
    let sort = "default";
    const render = () => {
      const sorter = {
        default: (a, b) => a.order - b.order,
        value: (a, b) => b.value - a.value,
        pnl: (a, b) => rate(b) - rate(a),
        lv: (a, b) => (b.lvi?.lv ?? -1) - (a.lvi?.lv ?? -1),
      }[sort];
      $("h-list").innerHTML = h.groups.map((g) => {
        const tv = g.items.reduce((s, x) => s + x.value, 0);
        const tp = g.items.reduce((s, x) => s + x.pnl, 0);
        const rows = [...g.items].sort(sorter).map((it) => {
          const r = rate(it);
          const href = CHART[it.symbol] ? `ungjup.html#${CHART[it.symbol]}` : null;
          const tag = href ? "a" : "div";
          const sub = [it.sub, qtyS(it.qty)].filter(Boolean).join(" · ");
          return `<${tag} class="h-row"${href ? ` href="${href}"` : ""}>
            <div class="h-left">
              <div class="h-name">${it.name}</div>
              <div class="h-meta"><span class="h-qty">${sub}</span>${lvChip(it)}</div>
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
      }).join("") + `<p class="h-foot">${h.asof} 기준 · 웅줍LV는 매일 갱신</p>`;
    };
    $("h-sort").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      $("h-sort").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      sort = b.dataset.sort;
      render();
    });
    render();
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

  load().then((d) => {
    if ($("h-list")) holdings(d);
    if ($("w-root")) wealth(d);
  }).catch(() => {
    const el = $("h-list") || $("w-root");
    if (el) el.innerHTML = '<p class="h-foot">데이터를 불러오지 못했습니다.</p>';
  });
})();
