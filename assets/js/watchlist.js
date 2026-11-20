// 관심종목: 목록(행) · 오늘 등락 분포 · 뉴스 피드 · 종목 상세 시트
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (text) => String(text ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const getJSON = (name) => window.MS.getJSON("data/" + name + ".json");
  const KEY = "mrstocks.watchlist.v1";
  const CHART = { QQQ: "qqq", SPY: "spy", GLD: "gld", "069500.KS": "ks200", "BTC-USD": "btc" };
  const MKT = { US: "미국", KOSPI: "코스피", KOSDAQ: "코스닥" };
  const BANDS = [
    { lo: 900, name: "줍줍권", cls: "h" },
    { lo: 700, name: "깊은 조정", cls: "d" },
    { lo: 400, name: "조정", cls: "m" },
    { lo: 1, name: "평온", cls: "l" },
  ];
  const ZONE = ["평상시", "관심", "줍줍 구간"];
  const norm = (text) => (text || "").toLowerCase().replace(/[\s.\-·]/g, "");
  const ticker = (symbol) => symbol.replace(/\.(KS|KQ)$/, "");
  const isKorean = (symbol) => ticker(symbol) !== symbol;
  const title = (item) => item.ko || item.en || item.symbol;
  const band = (lv) => BANDS.find((b) => lv >= b.lo) || BANDS[3];
  const fmt = {
    KRW: new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }),
    USD: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    pct: new Intl.NumberFormat("ko-KR", { style: "percent", signDisplay: "exceptZero", minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    pct1: new Intl.NumberFormat("ko-KR", { style: "percent", signDisplay: "exceptZero", minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    day: new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" }),
  };
  const priceText = (symbol, v) => (isKorean(symbol) ? fmt.KRW.format(v) + "원" : "$" + fmt.USD.format(v));
  const dirOf = (v) => (v > 0 ? "up" : v < 0 ? "down" : "flat");
  const ago = (iso) => {
    const t = new Date(iso);
    if (!Number.isFinite(t.getTime())) return "";
    const m = Math.max(1, Math.round((Date.now() - t) / 60000));
    if (m < 60) return m + "분 전";
    if (m < 1440) return Math.floor(m / 60) + "시간 전";
    if (m < 2880) return "어제";
    return fmt.day.format(t).replace(/\.$/, "");
  };
  // 언론사 이름이 주소로 들어온 경우 도메인만, 제목 끝의 " - 언론사"는 지움
  const sourceName = (s) => (/^https?:\/\//.test(s || "") ? new URL(s).hostname.replace(/^www\./, "") : s || "");
  const cleanTitle = (t, s) => {
    let x = String(t || "");
    if (s && x.endsWith(" - " + s)) x = x.slice(0, -(s.length + 3));
    return x.replace(/\s+-\s+[^-]{1,20}$/, "").trim();
  };
  const tone = (symbol) => Array.from(symbol).reduce((sum, c) => sum + c.charCodeAt(0), 0) % 5 + 1;
  const initials = (item) => {
    if (!isKorean(item.symbol)) return ticker(item.symbol).slice(0, 4);
    const name = item.name.replace(/\s/g, "");
    const latin = /^[A-Za-z]+/.exec(name);
    return latin ? latin[0].slice(0, 2).toUpperCase() : Array.from(name).slice(0, 2).join("");
  };
  const logo = (item, cls = "") =>
    `<span class="tile ${cls}" data-tone="${tone(item.symbol)}" data-len="${initials(item).length}" aria-hidden="true">${esc(initials(item))}</span>`;

  // ---------- 저장 (이 브라우저에만) ----------
  function readList(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  const previous = readList("mrstocks.added.v1", []);
  const initial = (Array.isArray(previous) ? previous : []).flatMap((item) =>
    item?.symbol && item?.name ? [{ symbol: item.symbol, name: item.name }] : []);
  let list = readList(KEY, { added: initial, hidden: [] });
  let groups = [], quotes = {}, news = new Map(), allNews = [], sort = "default", filter = "all", pendingSymbols, openSymbol = null;

  function saveList(next) {
    try { localStorage.setItem(KEY, JSON.stringify(next)); }
    catch {
      $("watch-status").textContent = "이 브라우저에 관심종목을 저장할 수 없어요.";
      return false;
    }
    list = next;
    return true;
  }

  // ---------- 데이터 ----------
  async function load() {
    const [base, levels, charts, headlines] = await Promise.all([
      getJSON("watchlist"),
      getJSON("ungjup/holdings_lv").catch(() => ({ items: {} })),
      getJSON("ungjup/index").catch(() => ({ assets: [] })),
      getJSON("ungjup/news").catch(() => ({ items: [] })),
    ]);
    groups = base.groups;
    quotes = { ...levels.items };
    for (const { symbol, last } of charts.assets) {
      const existing = quotes[symbol];
      if (!existing || last.date > existing.date || (last.date === existing.date && existing.change == null)) {
        quotes[symbol] = last;
      }
    }
    news = new Map();
    allNews = [];
    for (const item of headlines.items) {
      if (!item.symbol || !/^https:\/\//.test(item.link || "")) continue;
      const src = sourceName(item.source);
      const n = { ...item, source: src, title: cleanTitle(item.title, src) };
      if (!news.has(item.symbol)) news.set(item.symbol, []);
      news.get(item.symbol).push(n);
      allNews.push(n);
    }
    allNews.sort((a, b) => (b.time || "").localeCompare(a.time || ""));
    render();
    if (openSymbol && $("detail-dlg").open) renderDetail(openSymbol);
  }

  // 지금 보이는 관심종목 (기본 목록 + 직접 추가 − 숨김), 그룹 정보 포함
  function items() {
    const defaults = new Set(groups.flatMap((g) => g.items.map((i) => i.symbol)));
    const seen = new Set();
    return groups.flatMap((g) => {
      const extra = list.added.filter((i) => !defaults.has(i.symbol) && isKorean(i.symbol) === (g.id === "kr"));
      return [...g.items, ...extra].flatMap((i) => {
        if (list.hidden.includes(i.symbol) || seen.has(i.symbol)) return [];
        seen.add(i.symbol);
        return [{ ...i, group: g.id, groupName: g.name, added: !defaults.has(i.symbol) }];
      });
    });
  }
  const findItem = (symbol) => items().find((i) => i.symbol === symbol);

  // ---------- 목록 ----------
  function row(item) {
    const q = quotes[item.symbol];
    const lv = q?.lv;
    const b = lv != null ? band(lv) : null;
    const chg = q?.change;
    const lvChip = lv != null
      ? `<span class="lv-chip ${b.cls}${q.zone === 2 ? " zone" : ""}" title="줍줍LV ${lv} · ${b.name}${q.short ? " (추정)" : ""}">${q.zone === 2 ? "줍줍 " : ""}LV ${lv}</span>`
      : "";
    const price = Number.isFinite(q?.close)
      ? `<b class="px">${priceText(item.symbol, q.close)}</b><em class="chg ${dirOf(chg)}">${Number.isFinite(chg) ? fmt.pct.format(chg) : "—"}</em>`
      : `<b class="px muted">—</b><em class="chg flat">시세 대기</em>`;
    return `<button type="button" class="wl-row" data-symbol="${esc(item.symbol)}" aria-label="${esc(item.name)} 상세 보기">
      ${logo(item)}
      <span class="wl-id"><b class="nm">${esc(item.name)}</b><small>${esc(ticker(item.symbol))}${lvChip}</small></span>
      <span class="wl-px">${price}</span>
    </button>`;
  }

  function render() {
    const all = items();
    const counts = {
      all: all.length,
      kr: all.filter((i) => i.group === "kr").length,
      us: all.filter((i) => i.group === "us").length,
      deep: all.filter((i) => (quotes[i.symbol]?.lv ?? 0) >= 900).length,
    };
    $("wl-tabs").querySelectorAll("[data-filter]").forEach((t) => {
      const f = t.dataset.filter;
      t.innerHTML = `${{ all: "전체", kr: "국내", us: "해외", deep: "줍줍권" }[f]}<span>${counts[f]}</span>`;
    });
    renderBreadth(all);

    let shown = all.filter((i) => filter === "all" || (filter === "deep" ? (quotes[i.symbol]?.lv ?? 0) >= 900 : i.group === filter));
    if (sort !== "default") {
      shown = [...shown].sort((a, b) => (quotes[b.symbol]?.[sort] ?? -Infinity) - (quotes[a.symbol]?.[sort] ?? -Infinity));
    }
    // 기본순이면 국내/해외로 나눠 보여 주고, 정렬했으면 한 목록으로
    const blocks = sort === "default" && filter === "all"
      ? groups.map((g) => ({ name: g.name, rows: shown.filter((i) => i.group === g.id) })).filter((x) => x.rows.length)
      : [{ name: null, rows: shown }];
    $("h-list").innerHTML = shown.length
      ? blocks.map((blk) => `<div class="wl-block">${blk.name ? `<div class="wl-block-head">${esc(blk.name)}<span>${blk.rows.length}</span></div>` : ""}
          <div class="wl-rows">${blk.rows.map(row).join("")}</div></div>`).join("")
      : `<p class="wl-empty">${filter === "deep" ? "지금 줍줍권(LV 900 이상)인 종목이 없어요." : "관심종목이 비어 있어요. 오른쪽 위 추가 버튼으로 등록해 보세요."}</p>`;

    $("wl-sub").textContent = `${all.length}종목` + (quotes[all[0]?.symbol]?.date ? ` · ${fmt.day.format(new Date(quotes[all[0].symbol].date + "T00:00:00Z")).replace(/\.$/, "")} 종가 기준` : "");
    renderNews(all);
  }

  // 오늘 오른/내린 종목 수
  function renderBreadth(all) {
    const ch = all.map((i) => quotes[i.symbol]?.change).filter(Number.isFinite);
    const box = $("wl-breadth");
    if (!ch.length) { box.hidden = true; return; }
    const up = ch.filter((v) => v > 0).length, down = ch.filter((v) => v < 0).length, flat = ch.length - up - down;
    const avg = ch.reduce((s, v) => s + v, 0) / ch.length;
    box.hidden = false;
    box.innerHTML = `
      <div class="br-top">
        <span class="br-k">오늘 관심종목</span>
        <span class="br-avg ${dirOf(avg)}">평균 ${fmt.pct.format(avg)}</span>
      </div>
      <div class="br-bar" role="img" aria-label="상승 ${up}개, 하락 ${down}개, 보합 ${flat}개">
        ${up ? `<i class="up" style="flex:${up}"></i>` : ""}${flat ? `<i class="flat" style="flex:${flat}"></i>` : ""}${down ? `<i class="down" style="flex:${down}"></i>` : ""}
      </div>
      <div class="br-legend"><span class="up">상승 ${up}</span>${flat ? `<span class="flat">보합 ${flat}</span>` : ""}<span class="down">하락 ${down}</span></div>`;
  }

  // ---------- 뉴스 피드 (종목당 최대 2건, 최신순 12건) ----------
  function renderNews(all) {
    const watching = new Map(all.map((i) => [i.symbol, i]));
    const per = new Map();
    const picks = [];
    for (const n of allNews) {
      if (!watching.has(n.symbol) || picks.length >= 12) continue;
      const c = per.get(n.symbol) || 0;
      if (c >= 2) continue;
      per.set(n.symbol, c + 1);
      picks.push(n);
    }
    $("news-rail").innerHTML = picks.length
      ? picks.map((n) => {
          const it = watching.get(n.symbol);
          return `<a class="news-card" href="${esc(n.link)}" target="_blank" rel="noopener">
            <span class="nc-stock">${logo(it, "sm")}<span>${esc(it.name)}</span></span>
            <span class="nc-title">${esc(n.title)}</span>
            <span class="nc-meta">${esc(n.source)}${n.source ? " · " : ""}${ago(n.time)}</span>
          </a>`;
        }).join("")
      : '<p class="wl-empty">최근 7일 동안 모아 둔 기사가 없어요.</p>';
  }

  // ---------- 종목 상세 시트 ----------
  function renderDetail(symbol) {
    const item = findItem(symbol) || list.added.find((i) => i.symbol === symbol);
    if (!item) { $("detail-dlg").close(); return; }
    const q = quotes[symbol];
    const code = ticker(symbol);
    const lv = q?.lv;
    const b = lv != null ? band(lv) : null;
    const chg = q?.change;
    const marketUrl = isKorean(symbol)
      ? "https://m.stock.naver.com/domestic/stock/" + encodeURIComponent(code) + "/total"
      : "https://finance.yahoo.com/quote/" + encodeURIComponent(symbol) + "/";
    const query = item.news_q || '"' + item.name + '"' + (item.name === item.symbol ? " ETF 증시" : "");
    const newsUrl = "https://news.google.com/search?" + new URLSearchParams({ q: query, hl: "ko", gl: "KR", ceid: "KR:ko" });
    const articles = (news.get(symbol) || []).slice(0, 3);
    const stat = (k, v, cls = "") => `<div class="dt-stat"><span>${k}</span><b class="${cls}">${v}</b></div>`;
    const date = q?.date ? fmt.day.format(new Date(q.date + "T00:00:00Z")).replace(/\.$/, "") : "";

    $("detail-body").innerHTML = `
      <div class="dt-head">
        ${logo(item, "lg")}
        <div class="dt-id"><h2 id="dt-name">${esc(item.name)}</h2><span>${esc(code)} · ${isKorean(symbol) ? (symbol.endsWith(".KQ") ? "코스닥" : "코스피") : "미국"}</span></div>
        <button class="sheet-x" type="button" data-close aria-label="닫기">✕</button>
      </div>

      <div class="dt-price">
        ${Number.isFinite(q?.close)
          ? `<b>${priceText(symbol, q.close)}</b><em class="chg ${dirOf(chg)}">${Number.isFinite(chg) ? fmt.pct.format(chg) : "—"}</em><span>${date} 종가</span>`
          : `<b class="muted">시세 준비 중</b><span>다음 데이터 갱신 때 계산돼요</span>`}
      </div>

      ${lv != null ? `
      <div class="dt-lv">
        <div class="dt-lv-top">
          <span>줍줍LV</span>
          <b class="lv-${b.cls}">${lv}</b>
          <span class="lv-chip ${b.cls}">${b.name}${q.short ? " · 추정" : ""}</span>
        </div>
        <div class="gauge" role="img" aria-label="줍줍LV ${lv} / 1000">
          <i class="gauge-pin" style="left:${(lv - 1) / 9.99}%"></i>
        </div>
        <div class="gauge-ticks"><span>평온</span><span>조정</span><span>깊은 조정</span><span>줍줍권</span></div>
      </div>
      <div class="dt-stats">
        ${stat("상태", ZONE[q.zone] ?? "—", q.zone === 2 ? "zone" : "")}
        ${stat("RSI(14)", Number.isFinite(q.rsi) ? q.rsi.toFixed(1) : "—", q.rsi < 33 ? "down" : "")}
        ${stat("52주 고점 대비", Number.isFinite(q.dd52) ? fmt.pct1.format(-q.dd52) : "—")}
        ${stat("200일선 대비", Number.isFinite(q.gap200) ? fmt.pct1.format(q.gap200) : "—", dirOf(q.gap200))}
      </div>` : ""}

      <div class="dt-news">
        <div class="wl-sec-head"><h3>뉴스</h3><a href="${esc(newsUrl)}" target="_blank" rel="noopener">더 보기 ↗</a></div>
        ${articles.length
          ? `<ul>${articles.map((n) => `<li><a href="${esc(n.link)}" target="_blank" rel="noopener"><span class="t">${esc(n.title)}</span><span class="m">${esc(n.source)}${n.source ? " · " : ""}${ago(n.time)}</span></a></li>`).join("")}</ul>`
          : `<p class="wl-empty">최근 7일 동안 모아 둔 기사가 없어요.</p>`}
      </div>

      <div class="dt-actions">
        ${CHART[symbol] ? `<a class="btn-soft" href="ungjup.html#${CHART[symbol]}">차트 보기</a>` : ""}
        <a class="btn-soft" href="${esc(marketUrl)}" target="_blank" rel="noopener">시세 자세히 ↗</a>
        <button type="button" class="btn-danger" data-remove="${esc(symbol)}">관심종목에서 삭제</button>
      </div>`;
  }

  function openDetail(symbol) {
    openSymbol = symbol;
    renderDetail(symbol);
    const dlg = $("detail-dlg");
    if (!dlg.open) dlg.showModal();
    $("detail-body").scrollTop = 0;
  }

  function remove(symbol) {
    const isDefault = groups.some((g) => g.items.some((i) => i.symbol === symbol));
    const hidden = isDefault ? [...new Set([...list.hidden, symbol])] : list.hidden;
    if (!saveList({ added: list.added.filter((i) => i.symbol !== symbol), hidden })) return;
    $("detail-dlg").close();
    render();
    $("watch-status").textContent = "관심종목에서 삭제됨";
  }

  // ---------- 종목 검색 · 추가 ----------
  async function symbols() {
    pendingSymbols ??= getJSON("ungjup/symbols").then((data) => data.rows.map(([symbol, ko, en, market, etf]) =>
      ({ symbol, ko, en, market, etf, k: norm(ko), e: norm(en), s: norm(symbol), code: norm(ticker(symbol)) })),
    ).catch((error) => { pendingSymbols = null; throw error; });
    return pendingSymbols;
  }

  function search(catalog, query) {
    const n = norm(query);
    return catalog.flatMap((item) => {
      let rank;
      if (item.s === n || item.code === n) rank = 0;
      else if (item.k === n) rank = 1;
      else if (item.s.startsWith(n)) rank = 2;
      else if (item.k.startsWith(n)) rank = 3;
      else if (item.e.startsWith(n)) rank = 4;
      else if (item.k.includes(n) || (n.length >= 3 && item.e.includes(n))) rank = 5;
      return rank === undefined ? [] : [{ rank, item }];
    }).sort((a, b) => a.rank - b.rank || title(a.item).length - title(b.item).length)
      .slice(0, 30).map(({ item }) => item);
  }

  function setup() {
    const dialog = $("add-dlg");
    const field = $("q");
    const matches = $("sym-list");
    const hint = $("sym-hint");
    $("add-btn").addEventListener("click", () => {
      field.value = "";
      matches.replaceChildren();
      hint.textContent = "미국·한국 상장 종목과 ETF를 찾을 수 있어요.";
      hint.hidden = false;
      dialog.showModal();
      field.focus();
      symbols().catch(() => {}); // 목록 미리 받기
    });
    dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });

    let request = 0;
    field.addEventListener("input", async () => {
      const id = ++request;
      const query = field.value.trim();
      matches.replaceChildren();
      hint.hidden = false;
      if (!norm(query)) {
        hint.textContent = "종목명 또는 티커를 입력해 주세요.";
        return;
      }
      hint.textContent = "종목을 찾는 중…";
      try {
        const catalog = await symbols();
        if (id !== request || !dialog.open || field.value.trim() !== query) return;
        const results = search(catalog, query);
        const watching = new Set(items().map((i) => i.symbol));
        hint.hidden = results.length > 0;
        hint.textContent = "검색 결과가 없어요.";
        matches.innerHTML = results.map((item, i) => `<li><button type="button" data-index="${i}">
          <span class="sym-nm">${esc(title(item))}${item.etf ? "<em>ETF</em>" : ""}</span>
          <span class="sym-sub">${esc(ticker(item.symbol))} · ${MKT[item.market]}${watching.has(item.symbol) ? " · 이미 관심종목" : ""}</span>
        </button></li>`).join("");
        matches.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
          const item = results[Number(button.dataset.index)];
          const known = groups.some((group) => group.items.some((entry) => entry.symbol === item.symbol));
          const added = known || list.added.some((entry) => entry.symbol === item.symbol) ? list.added :
            [...list.added, { symbol: item.symbol, name: title(item) }];
          if (!saveList({ added, hidden: list.hidden.filter((symbol) => symbol !== item.symbol) })) {
            hint.hidden = false;
            hint.textContent = "종목을 저장하지 못했어요.";
            return;
          }
          dialog.close();
          render();
          $("watch-status").textContent = title(item) + " 관심종목에 등록됨";
        }));
      } catch {
        if (id === request) hint.textContent = "종목 목록을 불러오지 못했어요.";
      }
    });

    $("wl-tabs").addEventListener("click", (event) => {
      const tab = event.target.closest("[data-filter]");
      if (!tab) return;
      filter = tab.dataset.filter;
      $("wl-tabs").querySelectorAll("[data-filter]").forEach((t) => t.setAttribute("aria-selected", t === tab));
      render();
    });
    $("h-sort").addEventListener("change", (event) => { sort = event.target.value; render(); });
    $("h-list").addEventListener("click", (event) => {
      const r = event.target.closest(".wl-row");
      if (r) openDetail(r.dataset.symbol);
    });

    const detail = $("detail-dlg");
    detail.addEventListener("click", (event) => {
      if (event.target === detail || event.target.closest("[data-close]")) { detail.close(); return; }
      const del = event.target.closest("[data-remove]");
      if (del) remove(del.dataset.remove);
    });
    detail.addEventListener("close", () => { openSymbol = null; });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setup();
    load().catch(() => {
      $("h-list").innerHTML = '<p class="wl-empty" role="status">관심종목을 불러오지 못했어요. 오른쪽 아래 새로고침을 눌러 주세요.</p>';
    });
  });
  window.addEventListener("datarefresh", (event) => event.detail.tasks.push(load()));
})();
