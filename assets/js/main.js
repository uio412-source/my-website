// ---------- 공통: 데이터 불러오기 ----------
// 평소에는 브라우저 캐시를 쓰고, 새로고침 버튼을 누른 뒤에는 캐시를 건너뛰고 서버의 최신 파일을 받음
window.MS = window.MS || {};
MS.bust = 0;
MS.getJSON = (url) => {
  const u = MS.bust ? url + (url.includes("?") ? "&" : "?") + "v=" + MS.bust : url;
  return fetch(u, MS.bust ? { cache: "no-store" } : {}).then((r) => {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  });
};

(() => {
// Mr. Hotels·Mr. Travel·Mr. Pay 같은 하위 사이트는 <html data-site="hotels|travel|pay">이고 폴더 한 단계 아래에 있음
const subSite = document.documentElement.dataset.site || "";
const isHotels = subSite !== ""; // 종목 데이터 배지·새로고침 버튼은 Mr. Stocks에서만
const siteRoot = subSite ? "../" : "";

// ---------- 공통: 다크/라이트 모드 전환 (선택은 이 브라우저에만 저장) ----------
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

// ---------- 공통: 사이트 전환 (Stocks·Hotels·Travel·Pay). Mr. Cards 메뉴는 paymorevent/components/customer-shell.tsx ----------
document.addEventListener("DOMContentLoaded", () => {
  const logo = document.querySelector(".site-header .logo");
  if (!logo) return;
  const box = document.createElement("div");
  box.className = "site-switch";
  logo.replaceWith(box);
  box.innerHTML =
    '<button type="button" class="site-switch-btn" aria-label="다른 사이트로 이동" aria-expanded="false" aria-haspopup="true">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>' +
    '<div class="site-switch-menu" hidden>' +
    `<a href="${siteRoot}ungjup.html"${subSite ? "" : ' aria-current="true"'}><b>Mr. <span>Stocks</span></b><small>마켓뷰 · 관심종목 &amp; 뉴스 · 분배금 · AI</small></a>` +
    `<a href="${siteRoot}paymorevent/"><b>Mr. <span>Cards</span></b><small>카드상품 · 이벤트 · 내 혜택</small></a>` +
    `<a href="${siteRoot}hotels/"${subSite === "hotels" ? ' aria-current="true"' : ""}><b>Mr. <span>Hotels</span></b><small>호텔 지도 · 등급표 · 이벤트 · 발레파킹</small></a>` +
    `<a href="${siteRoot}travel/"${subSite === "travel" ? ' aria-current="true"' : ""}><b>Mr. <span>Travel</span></b><small>해외여행 혜택 · 여행지 · 여행준비</small></a>` +
    `<a href="${siteRoot}pay/"${subSite === "pay" ? ' aria-current="true"' : ""}><b>Mr. <span>Pay</span></b><small>온누리 · 토스페이 · 네이버페이 가맹점</small></a>` +
    "</div>";
  box.prepend(logo);
  const btn = box.querySelector(".site-switch-btn");
  const menu = box.querySelector(".site-switch-menu");
  const set = (open) => { menu.hidden = !open; btn.setAttribute("aria-expanded", String(open)); };
  btn.addEventListener("click", () => set(menu.hidden));
  document.addEventListener("pointerdown", (e) => { if (!box.contains(e.target)) set(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
});

// ---------- 공통: 시간 표시 도우미 ----------
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const p2 = (n) => String(n).padStart(2, "0");
const kst = (d) => new Date(d.getTime() + 9 * 3600e3); // getUTC*로 한국시간 읽기
const fmtUpd = (d) => {
  const k = kst(d);
  return `${p2(k.getUTCMonth() + 1)}.${p2(k.getUTCDate())} ${p2(k.getUTCHours())}:${p2(k.getUTCMinutes())}`;
};
const agoStr = (d) => {
  const min = Math.max(0, Math.round((Date.now() - d) / 60000));
  if (min < 60) return `${min}분 전`;
  if (min < 1440) return `${Math.floor(min / 60)}시간 전`;
  return `${Math.floor(min / 1440)}일 전`;
};
const parseUpd = (s) => {
  const m = /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(s || "");
  return m ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5])) : null;
};
// 다음 자동 갱신 (매일 한국시간 06:40, 16:40)
const nextAuto = () => {
  const k = kst(new Date());
  const now = k.getUTCHours() * 60 + k.getUTCMinutes();
  const slot = [400, 1000].find((t) => t > now);
  return slot ? `오늘 ${p2(Math.floor(slot / 60))}:${p2(slot % 60)}` : "내일 06:40";
};

// ---------- 공통: 오른쪽 위 자료기준일·갱신 시각 배지 ----------
// - 갱신: data/ungjup/index.json의 updated(UTC) → 한국시간
// - 기준일: 차트 = 지수 데이터 마지막 거래일, 관심종목 = 종목 시세의 마지막 거래일
let stampTimer = null;
let lastUpdated = null; // index.json의 updated 문자열 (새로고침 전후 비교용)
async function buildStamp() {
  if (isHotels) return;
  const right = document.querySelector(".head-right");
  if (!right) return;
  const get = (u) => MS.getJSON(u).catch(() => null);
  const isWatchlist = /\/(holdings|dividend)\.html$/.test(location.pathname);
  const data = await get(isWatchlist ? "data/ungjup/holdings_lv.json" : "data/ungjup/index.json");
  if (!data) throw new Error("데이터 없음");
  lastUpdated = data.updated;

  const rows = isWatchlist ? Object.values(data.items) : data.assets.map((asset) => asset.last);
  const asof = rows.map((row) => row?.date).filter(Boolean).sort().pop();
  const upd = parseUpd(data.updated);
  if (!asof && !upd) return;
  const fmtAsof = (s) => {
    const d = new Date(s + "T00:00:00Z");
    return `${p2(d.getUTCMonth() + 1)}.${p2(d.getUTCDate())} (${DAYS[d.getUTCDay()]})`;
  };

  let el = right.querySelector(".data-stamp");
  if (!el) {
    el = document.createElement("div");
    el.className = "data-stamp";
    el.setAttribute("role", "status");
    right.insertBefore(el, right.querySelector(".theme-btn"));
  }
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
      `\n데이터 갱신 ${k.getUTCFullYear()}-${p2(k.getUTCMonth() + 1)}-${p2(k.getUTCDate())} ${p2(k.getUTCHours())}:${p2(k.getUTCMinutes())} (${agoStr(upd)})` +
      `\n매일 06:40 · 16:40 자동 갱신`;
    el.setAttribute("aria-label", el.title.replace(/\n/g, ", "));
  };
  paint();
  clearInterval(stampTimer);
  stampTimer = setInterval(paint, 60000);
}
document.addEventListener("DOMContentLoaded", () => { buildStamp().catch(() => {}); });

// ---------- 공통: 새 배포 감지 → 브라우저에 남은 옛 페이지를 자동으로 새로 불러옴 ----------
// 배포 때 tools/stamp_version.py가 <meta name="mrs-build">와 version.json에 같은 버전을 적어 둠.
// 지금 보고 있는 페이지의 버전이 서버의 최신 버전과 다르면(= 캐시된 옛 HTML) 한 번 새로고침.
const BUILD = (document.querySelector('meta[name="mrs-build"]') || {}).content || "dev";
async function reloadIfStale() {
  if (BUILD === "dev") return false; // 로컬 미리보기
  let v = null;
  try {
    const r = await fetch(siteRoot + "version.json?t=" + Date.now(), { cache: "no-store" });
    if (r.ok) v = (await r.json()).v;
  } catch (e) { return false; }
  if (!v || v === BUILD) return false;
  const key = "mrs-reloaded-" + v; // 같은 버전으로는 한 번만 (서버가 아직 옛 페이지를 주는 경우 무한 반복 방지)
  try { if (sessionStorage.getItem(key)) return false; sessionStorage.setItem(key, "1"); } catch (e) { return false; }
  try { await fetch(location.href, { cache: "reload" }); } catch (e) {}
  location.reload();
  return true;
}
document.addEventListener("DOMContentLoaded", () => { reloadIfStale(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reloadIfStale(); });
window.addEventListener("pageshow", (e) => { if (e.persisted) reloadIfStale(); }); // 뒤로 가기 캐시로 돌아온 경우

// ---------- 공통: 머리줄 새로고침 버튼 (데이터 최신화) ----------
// 예전엔 오른쪽 아래 떠 있는 버튼이었으나 목록 숫자를 가려서 테마 버튼 옆으로 옮김.
// 누르면 캐시를 건너뛰고 서버의 최신 데이터 파일을 다시 받아 지금 화면을 그대로 다시 그림.
// 각 페이지는 "datarefresh" 이벤트를 받아 detail.tasks에 자기 작업(Promise)을 넣음.
const RUN_URL = "https://github.com/uio412-source/my-website/actions/workflows/deploy.yml";
document.addEventListener("DOMContentLoaded", () => {
  if (isHotels || !document.querySelector(".site-header")) return;
  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "theme-btn head-refresh";
  fab.setAttribute("aria-label", "데이터 최신화");
  fab.title = "데이터 최신화";
  fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';
  const toast = document.createElement("div");
  toast.className = "ms-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  const right = document.querySelector(".site-header .head-right");
  const themeBtn = right && right.querySelector(".theme-btn");
  if (themeBtn) right.insertBefore(fab, themeBtn); else document.body.append(fab);
  document.body.append(toast);

  let hideT;
  const show = (html, kind) => {
    toast.innerHTML = html;
    toast.dataset.kind = kind;
    toast.classList.add("on");
    clearTimeout(hideT);
    hideT = setTimeout(() => toast.classList.remove("on"), 6000);
  };
  toast.addEventListener("mouseenter", () => clearTimeout(hideT));
  toast.addEventListener("mouseleave", () => { hideT = setTimeout(() => toast.classList.remove("on"), 2500); });

  let busy = false;
  fab.addEventListener("click", async () => {
    if (busy) return;
    if (await reloadIfStale()) return; // 사이트가 새로 배포됐으면 페이지째 새로 불러옴
    busy = true;
    fab.classList.add("spin");
    fab.setAttribute("aria-busy", "true");
    const before = lastUpdated;
    const started = Date.now();

    MS.bust = Date.now();
    const tasks = [buildStamp()];
    window.dispatchEvent(new CustomEvent("datarefresh", { detail: { tasks } }));
    const res = await Promise.allSettled(tasks);
    // 너무 빨리 끝나도 돌아가는 모습이 잠깐은 보이게
    await new Promise((r) => setTimeout(r, Math.max(0, 700 - (Date.now() - started))));

    fab.classList.remove("spin");
    fab.removeAttribute("aria-busy");
    busy = false;

    const upd = parseUpd(lastUpdated);
    const when = upd ? `${fmtUpd(upd)} (${agoStr(upd)})` : "—";
    const runLink = `<a href="${RUN_URL}" target="_blank" rel="noopener">서버에서 지금 다시 계산 ↗</a>`;
    if (res.some((r) => r.status === "rejected")) {
      show(`<b>데이터를 불러오지 못했어요</b><span>잠시 후 다시 눌러 주세요.</span>`, "err");
    } else if (before && lastUpdated && lastUpdated !== before) {
      show(`<b>새 데이터로 바꿨어요</b><span>${when} 갱신</span>`, "new");
    } else {
      show(`<b>이미 최신 데이터예요</b><span>${when} 갱신 · 다음 자동 갱신 ${nextAuto()}</span>${runLink}`, "same");
    }
  });
});
})();
