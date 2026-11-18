// 공통: 다크/라이트 모드 전환 (선택은 이 브라우저에만 저장)
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("theme-btn");
  if (!btn) return;
  const root = document.documentElement;
  const sysDark = window.matchMedia("(prefers-color-scheme: dark)");
  const current = () => root.dataset.theme || (sysDark.matches ? "dark" : "light");
  const label = () => btn.setAttribute("aria-label", current() === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환");
  label();
  btn.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) {}
    label();
    window.dispatchEvent(new Event("themechange"));
  });
  sysDark.addEventListener("change", () => { label(); window.dispatchEvent(new Event("themechange")); });
});

// 공통: 오른쪽 위 자료기준일·갱신 시각 배지
// - 갱신: data/ungjup/index.json의 updated(UTC) → 한국시간
// - 기준일: 차트 = 지수 데이터 마지막 거래일, 보유종목·자산 = data/holdings.json의 asof
document.addEventListener("DOMContentLoaded", async () => {
  const right = document.querySelector(".head-right");
  if (!right) return;
  const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
  const p2 = (n) => String(n).padStart(2, "0");
  const get = (u) => fetch(u, { cache: "no-cache" }).then((r) => r.json()).catch(() => null);
  const isPortfolio = /holdings|wealth/.test(location.pathname);

  const [idx, hold] = await Promise.all([
    get("data/ungjup/index.json"),
    isPortfolio ? get("data/holdings.json") : null,
  ]);

  // 기준일 (YYYY-MM-DD)
  let asof = isPortfolio ? hold && hold.asof : null;
  if (!isPortfolio && idx && idx.assets) {
    asof = idx.assets.map((a) => a.last && a.last.date).filter(Boolean).sort().pop();
  }
  // 갱신 시각 ("YYYY-MM-DD HH:MM UTC")
  let upd = null;
  const m = idx && /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(idx.updated || "");
  if (m) upd = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]));
  if (!asof && !upd) return;

  const kst = (d) => new Date(d.getTime() + 9 * 3600e3); // getUTC*로 한국시간 읽기
  const fmtAsof = (s) => {
    const d = new Date(s + "T00:00:00Z");
    return `${p2(d.getUTCMonth() + 1)}.${p2(d.getUTCDate())} (${DAYS[d.getUTCDay()]})`;
  };
  const fmtUpd = (d) => {
    const k = kst(d);
    return `${p2(k.getUTCMonth() + 1)}.${p2(k.getUTCDate())} ${p2(k.getUTCHours())}:${p2(k.getUTCMinutes())}`;
  };
  const ago = (d) => {
    const min = Math.max(0, Math.round((Date.now() - d) / 60000));
    if (min < 60) return `${min}분 전`;
    if (min < 1440) return `${Math.floor(min / 60)}시간 전`;
    return `${Math.floor(min / 1440)}일 전`;
  };

  const el = document.createElement("div");
  el.className = "data-stamp";
  el.setAttribute("role", "status");
  el.innerHTML =
    `<i class="ds-ico" aria-hidden="true"></i><span class="ds-k">기준</span><b>${asof ? fmtAsof(asof) : "—"}</b>` +
    `<i class="ds-dot" aria-hidden="true"></i><span class="ds-k">갱신</span><b>${upd ? fmtUpd(upd) : "—"}</b>`;

  const paint = () => {
    if (!upd) return;
    const h = (Date.now() - upd) / 3600e3;
    // 하루 두 번(06:40·16:40) 갱신 → 16시간 이내 최신(크론 지연 감안), 36시간 이내 지연, 그 이상 오래됨
    el.dataset.fresh = h <= 16 ? "ok" : h <= 36 ? "late" : "old";
    const k = kst(upd);
    el.title =
      `자료기준일 ${asof || "—"}` +
      `\n데이터 갱신 ${k.getUTCFullYear()}-${p2(k.getUTCMonth() + 1)}-${p2(k.getUTCDate())} ${p2(k.getUTCHours())}:${p2(k.getUTCMinutes())} (${ago(upd)})` +
      `\n매일 06:40 · 16:40 자동 갱신`;
    el.setAttribute("aria-label", el.title.replace(/\n/g, ", "));
  };
  paint();
  setInterval(paint, 60000);

  right.insertBefore(el, right.querySelector(".theme-btn"));
});
