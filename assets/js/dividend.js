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
    renderFt();
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

  // ---------- 금융소득종합과세 한도 계산기 (2026년 지급분, 국내 세법) ----------
  // 금융소득 = 이자 + 배당(분배금 과세분). 개인별 1년 2,000만원 이하면 14%(지방세 포함 15.4%) 원천징수로 끝,
  // 넘으면 전체가 다른 소득과 합산돼 비교과세(종합과세 방식과 14% 방식 중 큰 세액).
  const FT_KEY = "mrstocks.dividend.fintax";
  const LIMIT = 2e7;          // 금융소득종합과세 기준금액
  const WH = 0.14;            // 이자·배당 원천징수세율(국세)
  const GROSS = 0.10;         // 배당가산율(Gross-up): 2024~2026년 지급분 10%, 2027년 지급분부터 11%
  const US_WH = 0.15;         // 미국 배당 원천징수
  const KR_DIV_YIELD = 0.02;  // 국내 커버드콜 과세 비중 추정에 쓰는 기초지수 배당수익률(연)
  // 종합소득 기본세율 [과세표준 상한, 세율, 누진공제]
  const BRACKETS = [[14e6, 0.06, 0], [50e6, 0.15, 126e4], [88e6, 0.24, 576e4], [150e6, 0.35, 1544e4],
    [300e6, 0.38, 1994e4], [500e6, 0.40, 2594e4], [1e9, 0.42, 3594e4], [Infinity, 0.45, 6594e4]];
  const basicTax = (x) => { if (!(x > 0)) return 0; const [, r, d] = BRACKETS.find(([hi]) => x <= hi); return x * r - d; };
  // 고배당기업 배당 분리과세(조특법 §104의27): 2천만 14% · 3억 20% · 50억 25% · 초과 30% 누진
  const SEP = [[2e7, 0.14], [3e8, 0.20], [5e9, 0.25], [Infinity, 0.30]];
  const sepTax = (x) => { let t = 0, lo = 0; for (const [hi, r] of SEP) { if (x > lo) t += (Math.min(x, hi) - lo) * r; lo = hi; } return t; };

  const KINDS = {
    stock: "국내 주식",
    reit: "리츠·인프라",
    krcc: "국내 커버드콜 ETF",
    etf: "국내상장 ETF(전액 과세)",
    foreign: "해외 주식·ETF",
  };
  const ETF_BRAND = /^(KODEX|TIGER|RISE|KBSTAR|ACE|SOL|PLUS|HANARO|KOSEF|ARIRANG|KIWOOM|TIMEFOLIO|WON|1Q|BNK|UNICORN|FOCUS|TRUSTON|HK|KoAct|VITA|TIME|IBK|TREX|ITF|KCGI|SMART|DAISHIN343|마이티|에셋플러스|히어로즈|파워|마이다스|흥국|대신343)(\s|$|\d)/i;
  // 해외 지수·자산을 담은 커버드콜은 해외 옵션이라 비과세가 아님
  const FOREIGN_RX = /미국|나스닥|S&P|글로벌|차이나|중국|홍콩|항셍|일본|니케이|인도|베트남|유럽|대만|빅테크|테크100|월드|국채|채권|원유|골드|금현물|달러/i;
  let ft = read(FT_KEY, {});
  if (!ft || typeof ft !== "object") ft = {};
  ft.per = ft.per && typeof ft.per === "object" ? ft.per : {};
  const saveFt = () => { try { localStorage.setItem(FT_KEY, JSON.stringify(ft)); } catch {} };
  const man = (v) => (Math.abs(v) >= 1e4 ? nf0.format(Math.round(v / 1e4)) + "만원" : won(v));
  const manIn = (id) => { const v = Number($(id).value); return Number.isFinite(v) && v > 0 ? v * 1e4 : 0; };

  function autoKind(h) {
    if (!isKR(h.symbol)) return "foreign";
    const n = h.name || "";
    if (ETF_BRAND.test(n)) return /커버드콜/.test(n) && !FOREIGN_RX.test(n) ? "krcc" : "etf";
    return /리츠|REIT|인프라/i.test(n) ? "reit" : "stock";
  }
  // 국내 커버드콜 과세 비중 추정: 분배금 중 기초지수 주식 배당(연 2% 가정)만 과세, 나머지 옵션 이익은 비과세
  function autoTaxPct(c) {
    const px = c.price || c.cost;
    if (!(c.dps > 0) || !(px > 0)) return 100;
    return Math.min(100, Math.round((KR_DIV_YIELD * px / c.dps) * 100));
  }

  function ftItems() {
    return holdings.map((h) => {
      const c = calc(h);
      const p = ft.per[h.id] || {};
      const kind = KINDS[p.kind] ? p.kind : autoKind(h);
      const amt = Number.isFinite(c.dps) && c.rate ? h.qty * c.dps * c.rate : 0; // 세전 연 배당금(원)
      const taxPct = kind === "krcc" ? (Number.isFinite(p.tax) ? p.tax : autoTaxPct(c)) : 100;
      const isa = p.acct === "isa";
      const sep = kind === "stock" && !!p.sep;
      const counted = isa || sep ? 0 : amt * taxPct / 100;
      return { h, c, kind, amt, taxPct, isa, sep, counted, free: isa ? 0 : amt - amt * taxPct / 100, autoTax: kind === "krcc" && !Number.isFinite(p.tax) };
    });
  }

  function ftCompute(items) {
    const sum = (f) => items.reduce((s, x) => s + (f(x) || 0), 0);
    const I = manIn("ft-interest"), gain = manIn("ft-gain"), other = manIn("ft-other");
    const Dg = sum((x) => x.kind === "stock" ? x.counted : 0);                      // 배당가산 대상(국내 상장주식)
    const reit = sum((x) => x.kind === "reit" ? x.counted : 0);
    const etf = sum((x) => x.kind === "etf" ? x.counted : 0);
    const krccTax = sum((x) => x.kind === "krcc" ? x.counted : 0);
    const krccFree = sum((x) => x.kind === "krcc" ? x.free : 0);
    const Df = sum((x) => x.kind === "foreign" ? x.counted : 0);
    const sepAmt = sum((x) => x.sep ? x.amt : 0);
    const isaAmt = sum((x) => x.isa ? x.amt : 0);
    const Dn = reit + etf + krccTax + gain;                                             // 배당가산 없는 배당
    const F = I + Dg + Dn + Df;
    const r = { I, gain, other, Dg, reit, etf, krccTax, krccFree, Df, sepAmt, isaAmt, Dn, F, over: F > LIMIT };
    // 고배당 분리과세 신청분: 원천징수 14% 뒤 신고 때 누진 분리과세 차액
    r.sepExtra = Math.max(0, sepTax(sepAmt) - WH * sepAmt);
    if (!r.over) return r;
    // 2천만원은 이자 → 가산 없는 배당 → 가산 대상 배당 순서로 채우고, 넘는 가산 대상 배당에만 Gross-up
    const excess = F - LIMIT;
    r.G = GROSS * Math.min(Dg, excess);
    r.gen = basicTax(other + excess + r.G) + LIMIT * WH;   // 종합과세 방식
    r.cmp = basicTax(other) + F * WH;                      // 비교과세(분리과세) 방식
    r.calcTax = Math.max(r.gen, r.cmp);
    r.divCredit = r.gen > r.cmp ? Math.min(r.G, r.gen - r.cmp) : 0;
    r.ftc = Df > 0 ? Math.min(US_WH * Df, r.calcTax * Df / (other + F + r.G)) : 0; // 외국납부세액공제(추정)
    r.prepaid = basicTax(other) + WH * (I + Dg + Dn);      // 다른 소득 세금 + 국내 원천징수
    r.extra = Math.max(0, r.calcTax - r.divCredit - r.ftc - r.prepaid);
    return r;
  }

  function renderFt(rebuildItems = true) {
    const box = $("ft");
    box.hidden = false;
    const items = ftItems();
    const r = ftCompute(items);
    const ratio = Math.min(1, r.F / LIMIT);
    $("ft-total").textContent = won(r.F);
    $("ft-left").innerHTML = r.over
      ? `<b class="over">${man(r.F - LIMIT)} 초과</b><small>종합과세 대상</small>`
      : `<b>${man(LIMIT - r.F)}</b><small>남은 한도</small>`;
    const bar = $("ft-bar");
    bar.classList.toggle("over", r.over);
    bar.firstElementChild.style.width = (ratio * 100).toFixed(1) + "%";
    bar.setAttribute("aria-label", `2,000만원 중 ${Math.round(ratio * 100)}%`);

    const row = (label, v, cls, sub) => (v > 0 ? `<li class="${cls}"><span>${label}${sub ? `<small>${sub}</small>` : ""}</span><b>${won(v)}</b></li>` : "");
    const inRows = [
      row("예금·채권 이자", r.I, "in"),
      row("국내 주식 배당", r.Dg, "in", "배당가산 대상"),
      row("리츠·인프라 배당", r.reit, "in"),
      row("국내상장 ETF 분배금", r.etf, "in", "해외지수·기타 ETF는 전액"),
      row("국내 커버드콜 분배금 중 과세분", r.krccTax, "in", "주식 배당 등"),
      row("해외 주식·ETF 배당", r.Df, "in", "ROC 포함, 세전"),
      row("국내상장 해외·기타 ETF 매도 차익", r.gain, "in"),
    ].join("");
    const outRows = [
      row("국내 커버드콜 옵션 이익", r.krccFree, "out", "비과세"),
      row("고배당기업 배당(분리과세 신청)", r.sepAmt, "out", "14~30% 따로"),
      row("ISA·연금 계좌", r.isaAmt, "out", "계좌 안에서 따로 과세"),
    ].join("");
    $("ft-rows").innerHTML = (inRows || `<li class="empty">아직 금융소득이 없어요. 보유 종목을 추가하거나 이자를 넣어 보세요.</li>`) +
      (outRows ? `<li class="sep">2,000만원 판정에 안 들어가요</li>${outRows}` : "");

    // 추가 세금(추정)
    const t = [];
    if (!r.over) {
      t.push(`<p class="ft-ok">2,000만원 이하라 받을 때 뗀 15.4%로 끝나요.${r.F > 0 ? ` <b>${man(LIMIT - r.F)}</b> 더 받아도 종합과세가 아니에요.` : ""}</p>`);
    } else {
      const line = (k, v, sign = "") => `<div class="ft-l"><span>${k}</span><b>${sign}${won(v)}</b></div>`;
      t.push(`<div class="ft-calc">
        ${line(`종합과세 방식 <small>2천만원×14% + (초과분${r.G ? "+배당가산" : ""}+다른 소득)×기본세율</small>`, r.gen)}
        ${line(`비교과세 방식 <small>금융소득 전체×14% + 다른 소득×기본세율</small>`, r.cmp)}
        <div class="ft-l pick"><span>산출세액 <small>둘 중 큰 금액</small></span><b>${won(r.calcTax)}</b></div>
        ${r.divCredit ? line("배당세액공제", r.divCredit, "−") : ""}
        ${r.ftc ? line("외국납부세액공제 <small>미국 15% 원천징수분, 추정</small>", r.ftc, "−") : ""}
        ${line("이미 낸 세금 <small>다른 소득 세금 + 국내 원천징수 14%</small>", r.prepaid, "−")}
        <div class="ft-l total"><span>5월에 더 낼 세금(추정) <small>지방소득세 10% 포함</small></span><b>${won(r.extra * 1.1)}</b></div>
      </div>`);
      if (!(r.other > 0)) t.push(`<p class="ft-hint">다른 소득 과세표준을 넣으면 실제와 더 가까워져요. 근로소득이 있으면 대부분 더 늘어나요.</p>`);
    }
    if (r.sepAmt > 0) t.push(`<p class="ft-hint">고배당기업 분리과세 신청분 ${won(r.sepAmt)}: 신고 때 ${r.sepExtra > 0 ? `약 <b>${won(r.sepExtra * 1.1)}</b> 더 내요(2,000만원 넘는 부분 20%부터)` : "14%로 끝나요"}.</p>`);
    $("ft-tax").innerHTML = t.join("");

    if (rebuildItems) renderFtItems(items);
    renderFtNotes();
  }

  function renderFtItems(items) {
    const box = $("ft-items");
    if (!items.length) { box.innerHTML = `<p class="ft-hint">보유 종목이 없어요.</p>`; return; }
    const opts = (cur) => Object.entries(KINDS).map(([k, v]) => `<option value="${k}"${k === cur ? " selected" : ""}>${v}</option>`).join("");
    box.innerHTML = items.slice().sort((a, b) => b.amt - a.amt).map((x) => `
      <div class="ft-it" data-id="${esc(x.h.id)}">
        <div class="ft-it-h"><b>${esc(x.h.name)}</b><span>연 ${won(x.amt)} → <em class="${x.counted > 0 ? "" : "zero"}">${x.counted > 0 ? won(x.counted) + " 반영" : "반영 안 됨"}</em></span></div>
        <div class="ft-it-c">
          <select data-f="kind" aria-label="${esc(x.h.name)} 분류">${opts(x.kind)}</select>
          <select data-f="acct" aria-label="${esc(x.h.name)} 계좌"><option value="">일반 계좌</option><option value="isa"${x.isa ? " selected" : ""}>ISA·연금 계좌</option></select>
          ${x.kind === "krcc" ? `<label class="ft-pct">과세 비중<input data-f="tax" type="number" inputmode="numeric" min="0" max="100" step="1" value="${x.taxPct}">%${x.autoTax ? "<small>추정</small>" : ""}</label>` : ""}
          ${x.kind === "stock" ? `<label class="ft-chk"><input data-f="sep" type="checkbox"${x.sep ? " checked" : ""}>고배당기업 분리과세 신청</label>` : ""}
        </div>
      </div>`).join("");
  }

  function renderFtNotes() {
    if ($("ft-notes").childElementCount) return;
    const n = [
      "금융소득은 개인별로 1년(1~12월에 받은 날 기준) 이자와 배당을 합친 금액이에요. 2,000만원까지는 원천징수(14%, 지방세 포함 15.4%)로 끝나고, 넘으면 전체가 근로·사업소득과 합산돼 종합과세 방식과 14% 방식 중 큰 세액을 내요.",
      "<b>국내 주식형 커버드콜</b>: 코스피200 옵션 같은 국내 장내 파생상품 이익은 비과세라 금융소득에 안 들어가요. 분배금은 주식 배당 같은 과세 재원부터 나간 것으로 봐서 달마다 과세 비중이 달라요(배당이 많은 달은 커져요). 증권사 분배금 내역의 '과세표준'으로 과세 비중을 고치면 정확해져요.",
      "<b>해외 지수 커버드콜</b>(미국·나스닥 등을 담은 국내상장 커버드콜)은 해외 옵션이라 분배금 전액 과세예요.",
      "<b>국내상장 해외·기타 ETF</b>는 팔 때 차익(매매차익과 과표 증가분 중 적은 금액)도 배당소득이라 금융소득에 들어가요. 국내 주식형 ETF의 매매차익은 비과세예요.",
      "<b>미국 상장 ETF</b> 분배금은 원금 반환(ROC)까지 지금은 배당소득으로 원천징수돼요. 2026년 11월 한 세무서가 ROC 환급 경정청구를 받아들였지만 국세청 최종 판단 전이라 여기서는 전액 넣었어요. 매도 차익은 양도소득(분리과세)이라 들어가지 않아요.",
      "<b>고배당기업 분리과세</b>: 2026년 이후 받은 고배당기업(KIND 공시로 확인) 배당은 종합소득세 신고 때 신청하면 2,000만원 판정에서 빠지고 14·20·25·30% 누진으로 따로 과세돼요. 신청하지 않으면 일반 배당처럼 합산되고, ETF는 대상이 아니에요.",
      `배당가산(Gross-up)은 2,000만원을 넘는 국내 법인 배당에만 ${Math.round(GROSS * 100)}%를 더하고 같은 금액만큼 배당세액공제해요(2027년 지급분부터 11%). ETF 분배금·리츠·해외 배당에는 붙지 않아요.`,
      "ISA·연금계좌 안의 소득은 금융소득종합과세와 따로 과세돼요. 해외 계좌에서 직접 받아 국내 원천징수가 안 된 이자·배당은 금액과 관계없이 종합과세예요.",
      "건강보험료는 기준이 따로 있어요(금융소득 1,000만원부터 영향).",
      "배당금은 최근 12개월 지급액으로 본 올해 예상치이고, 세금은 소득공제·다른 세액공제를 뺀 단순 추정이에요. 실제 신고 전 세무 전문가나 홈택스로 확인하세요.",
    ];
    $("ft-notes").innerHTML = n.map((t) => `<li>${t}</li>`).join("");
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

  function setupFt() {
    const ids = { "ft-interest": "interest", "ft-gain": "gain", "ft-other": "other" };
    for (const [id, k] of Object.entries(ids)) {
      if (Number.isFinite(ft[k]) && ft[k] > 0) $(id).value = ft[k];
      $(id).addEventListener("input", () => {
        const v = Number($(id).value);
        ft[k] = Number.isFinite(v) && v > 0 ? v : null;
        saveFt();
        renderFt(false);
      });
    }
    const items = $("ft-items");
    const apply = (e, rebuild) => {
      const el = e.target.closest("[data-f]");
      const it = e.target.closest(".ft-it");
      if (!el || !it) return;
      const p = (ft.per[it.dataset.id] ||= {});
      const f = el.dataset.f;
      if (f === "kind") { p.kind = el.value; delete p.tax; delete p.sep; }
      else if (f === "acct") { if (el.value) p.acct = el.value; else delete p.acct; }
      else if (f === "sep") { if (el.checked) p.sep = true; else delete p.sep; }
      else if (f === "tax") {
        if (el.value === "") delete p.tax;
        else p.tax = Math.max(0, Math.min(100, Math.round(Number(el.value)) || 0));
      }
      saveFt();
      renderFt(rebuild);
    };
    items.addEventListener("change", (e) => apply(e, true));
    // 과세 비중은 입력하는 동안 칸을 다시 그리지 않음(포커스 유지)
    items.addEventListener("input", (e) => { if (e.target.dataset.f === "tax") apply(e, false); });
  }

  function setup() {
    setupFt();
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
