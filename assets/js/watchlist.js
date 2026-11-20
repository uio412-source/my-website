// 관심종목, 시세와 종목별 뉴스
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const getJSON = (name) => window.MS.getJSON("data/" + name + ".json");
  const KEY = "mrstocks.watchlist.v1";
  const CHART = { QQQ: "qqq", SPY: "spy", GLD: "gld", "069500.KS": "ks200", "BTC-USD": "btc" };
  const MKT = { US: "미국", KOSPI: "코스피", KOSDAQ: "코스닥" };
  const norm = (text) => text.toLowerCase().replace(/[\s.\-·]/g, "");
  const ticker = (symbol) => symbol.replace(/\.(KS|KQ)$/, "");
  const isKorean = (symbol) => ticker(symbol) !== symbol;
  const title = (item) => item.ko || item.en || item.symbol;
  const price = {
    KRW: new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }),
    USD: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  };
  const percent = new Intl.NumberFormat("ko-KR", {
    style: "percent", signDisplay: "exceptZero", minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const day = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" });

  function readList(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  const previous = readList("mrstocks.added.v1", []);
  const initial = (Array.isArray(previous) ? previous : []).flatMap((item) =>
    item?.symbol && item?.name ? [{ symbol: item.symbol, name: item.name }] : []);
  let list = readList(KEY, { added: initial, hidden: [] });
  let groups = [], quotes = {}, news = new Map(), sort = "default", pendingSymbols;

  function saveList(next) {
    try { localStorage.setItem(KEY, JSON.stringify(next)); }
    catch {
      $("watch-status").textContent = "이 브라우저에 관심종목을 저장할 수 없어요.";
      return false;
    }
    list = next;
    return true;
  }

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
    for (const item of headlines.items) {
      if (!item.symbol || !/^https:\/\//.test(item.link || "")) continue;
      if (!news.has(item.symbol)) news.set(item.symbol, []);
      news.get(item.symbol).push(item);
    }
    render();
  }

  function newsMarkup(item, expanded) {
    const articles = (news.get(item.symbol) || []).slice(0, 3);
    const query = item.news_q || '"' + item.name + '"' + (item.name === item.symbol ? " ETF 증시" : "");
    const url = "https://news.google.com/search?" + new URLSearchParams({ q: query, hl: "ko", gl: "KR", ceid: "KR:ko" });
    const links = articles.map((article) => {
      const date = new Date(article.time);
      const meta = [article.source, Number.isFinite(date.getTime()) ? day.format(date) : ""].filter(Boolean).join(" · ");
      return `<li><a href="${esc(article.link)}" target="_blank" rel="noopener">${esc(article.title)}</a><small>${esc(meta)}</small></li>`;
    }).join("");
    return `<details class="stock-news" data-news="${esc(item.symbol)}"${expanded ? " open" : ""}>
      <summary aria-label="${esc(item.name)} 뉴스">뉴스${articles.length ? "<span>" + articles.length + "</span>" : ""}</summary>
      <div class="stock-news-body">
        ${links ? '<ul>' + links + '</ul>' : '<p>모아둔 기사가 없어요.</p>'}
        <a href="${esc(url)}" target="_blank" rel="noopener">관련 뉴스 더 보기</a>
      </div>
    </details>`;
  }

  function card(item, expanded) {
    const symbol = item.symbol;
    const code = ticker(symbol);
    const quote = quotes[symbol];
    const level = quote?.lv;
    const band = level >= 900 ? "high" : level >= 700 ? "deep" : level >= 400 ? "mid" : "low";
    const change = quote?.change;
    const direction = change > 0 ? "up" : change < 0 ? "down" : "";
    const amount = Number.isFinite(quote?.close) ?
      (isKorean(symbol) ? price.KRW.format(quote.close) + "원" : "$" + price.USD.format(quote.close)) : null;
    const date = quote?.date ? new Date(quote.date + "T00:00:00Z") : null;
    const initials = isKorean(symbol) ? Array.from(item.name.replace(/\s/g, "")).slice(0, 2).join("") : code.slice(0, 4);
    const icon = Array.from(symbol).reduce((sum, c) => sum + c.charCodeAt(0), 0) % 4;
    const chart = CHART[symbol];
    const marketUrl = (isKorean(symbol) ? "https://m.stock.naver.com/domestic/stock/" + encodeURIComponent(code) + "/total" :
      "https://finance.yahoo.com/quote/" + encodeURIComponent(symbol) + "/");
    return `<article class="stock-card" data-symbol="${esc(symbol)}">
      <div class="stock-heading">
        <span class="stock-icon" data-tone="${icon}" aria-hidden="true">${esc(initials)}</span>
        <div class="stock-identity">
          <h3>${chart ? `<a href="ungjup.html#${chart}">${esc(item.name)}</a>` : esc(item.name)}</h3>
          <span>${esc(code)}</span>
        </div>
        <span class="stock-level" data-band="${band}" ${quote?.short ? 'title="상장 이력이 짧아 추정한 웅줍LV"' : ""}>
          웅줍LV ${level ?? "—"}${level != null && quote.short ? ' <small>추정</small>' : ""}
        </span>
      </div>
      <div class="stock-quote">
        ${amount ? `<strong>${amount}</strong>` : `<a href="${marketUrl}" target="_blank" rel="noopener">시세 보기</a>`}
        ${amount ? `<span class="${direction}">${Number.isFinite(change) ? "전일 " + percent.format(change) : "전일 —"}</span>` : ""}
        ${date && Number.isFinite(date.getTime()) ? `<time datetime="${esc(quote.date)}">${day.format(date)} 기준</time>` : ""}
      </div>
      <div class="stock-footer">
        ${newsMarkup(item, expanded)}
        <button type="button" class="stock-remove" data-remove="${esc(symbol)}" aria-label="${esc(item.name)} 관심종목에서 삭제">삭제</button>
      </div>
    </article>`;
  }

  function render() {
    const expanded = new Set(Array.from($("h-list").querySelectorAll("details[open]"), (el) => el.dataset.news));
    const defaults = new Set(groups.flatMap((group) => group.items.map((item) => item.symbol)));
    const visible = new Set();
    const compare = sort === "default" ? undefined : (a, b) =>
      (quotes[b.symbol]?.[sort] ?? -Infinity) - (quotes[a.symbol]?.[sort] ?? -Infinity);

    $("h-list").innerHTML = groups.map((group) => {
      const extra = list.added.filter((item) => !defaults.has(item.symbol) && isKorean(item.symbol) === (group.id === "kr"));
      const items = [...group.items, ...extra].filter((item) => {
        if (list.hidden.includes(item.symbol) || visible.has(item.symbol)) return false;
        visible.add(item.symbol);
        return true;
      });
      if (compare) items.sort(compare);
      return items.length ? `<section class="stock-group"><h2>${esc(group.name)}</h2><div class="stock-grid">
        ${items.map((item) => card(item, expanded.has(item.symbol))).join("")}
      </div></section>` : "";
    }).join("") || '<p class="sheet-hint">관심종목이 비어 있어요. 종목 추가에서 등록해 보세요.</p>';
  }

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
        hint.hidden = results.length > 0;
        hint.textContent = "검색 결과가 없어요.";
        matches.innerHTML = results.map((item, i) => `<li><button type="button" data-index="${i}">
          <span class="sym-nm">${esc(title(item))}${item.etf ? '<em>ETF</em>' : ""}</span>
          <span class="sym-sub">${esc(ticker(item.symbol))} · ${MKT[item.market]}</span>
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

    $("h-sort").addEventListener("click", (event) => {
      const button = event.target.closest("[data-sort]");
      if (!button) return;
      sort = button.dataset.sort;
      $("h-sort").querySelectorAll("button").forEach((other) => other.setAttribute("aria-pressed", other === button));
      render();
    });
    $("h-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove]");
      if (!button) return;
      const symbol = button.dataset.remove;
      const hidden = groups.some((group) => group.items.some((item) => item.symbol === symbol)) ?
        [...list.hidden, symbol] : list.hidden;
      if (!saveList({ added: list.added.filter((item) => item.symbol !== symbol), hidden })) return;
      render();
      $("add-btn").focus();
      $("watch-status").textContent = "관심종목에서 삭제됨";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setup();
    load().catch(() => {
      $("h-list").innerHTML = '<p class="sheet-hint" role="status">관심종목을 불러오지 못했어요. 새로고침해 주세요.</p>';
    });
  });
  window.addEventListener("datarefresh", (event) => event.detail.tasks.push(load()));
})();
