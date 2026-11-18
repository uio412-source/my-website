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
