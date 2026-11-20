// Mr. Cards 다크 모드 생성기 — `npm run theme` (CSS를 고친 뒤 다시 실행하세요. 여러 번 실행해도 결과는 같습니다)
//
// 1) app/*.css 의 선언 값에 직접 적힌 색(#fff, #1c2330, white …)을
//    var(--d-<색>, <원래 색>) 으로 감쌉니다. 라이트 모드는 원래 색 그대로라 화면이 바뀌지 않습니다.
// 2) 쓰인 색마다 다크 모드 짝을 계산해 app/mr-cards-dark.css 를 만듭니다.
//    OKLab 밝기를 뒤집고(흰 배경 → 어두운 배경, 진한 글자 → 밝은 글자) 색상(hue)은 유지합니다.
//    반투명 검정(그림자)은 그대로 둡니다.
// 3) 다크 모드는 Mr. Stocks와 같은 규칙으로 켜집니다: <html data-theme="dark"> 또는 시스템 설정.
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const SKIP = new Set(['mr-cards.css', 'mr-cards-dark.css']);
const files = readdirSync(APP).filter(f => f.endsWith('.css') && !SKIP.has(f));

// ---------- 1) 색을 변수로 감싸기 ----------
const norm = hex => {
  let h = hex.toLowerCase();
  if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
  return h;
};
function wrapValue(value) {
  // 이미 감싼 것과 url(...) 안은 건드리지 않음
  const keep = [];
  const masked = value.replace(/url\([^)]*\)|var\(--d-[0-9a-f]{6,8},#[0-9a-fA-F]{3,8}\)/g, m => `\u0000${keep.push(m) - 1}\u0000`);
  const out = masked
    .replace(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g, (m, h) => `var(--d-${norm(h)},${m})`)
    .replace(/\bwhite\b/g, 'var(--d-ffffff,#fff)');
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[+i]);
}
// 블록 구조를 따라가며 규칙 본문의 선언 값만 바꿈 (@media 안쪽도 처리)
function transform(css) {
  let out = '', i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) { out += css.slice(i); break; }
    let prelude = css.slice(i, open);
    const semi = prelude.lastIndexOf(';'); // 앞에 붙은 @import·@custom-variant 같은 한 줄 규칙은 그대로 둠
    if (semi >= 0) { out += prelude.slice(0, semi + 1); prelude = prelude.slice(semi + 1); }
    let depth = 1, k = open + 1;
    while (k < css.length && depth) { if (css[k] === '{') depth++; else if (css[k] === '}') depth--; k++; }
    const body = css.slice(open + 1, k - 1);
    const p = prelude.trim();
    if (/^@(media|supports|container|layer)\b/.test(p)) out += prelude + '{' + transform(body) + '}';
    else if (/^@(keyframes|-webkit-keyframes)\b/.test(p)) out += prelude + '{' + transform(body) + '}';
    else if (p.startsWith('@')) out += prelude + '{' + body + '}';
    else out += prelude + '{' + body.replace(/(:)([^;{}]*)/g, (m, c, v) => c + wrapValue(v)) + '}';
    i = k;
  }
  return out;
}
const used = new Set();
for (const f of files) {
  const path = join(APP, f);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after !== before) writeFileSync(path, after);
  for (const m of after.matchAll(/var\(--d-([0-9a-f]{6,8}),/g)) used.add(m[1]);
}

// ---------- 2) 다크 짝 계산 (OKLab) ----------
const toLin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function hexToOklab(h) {
  const [r, g, b] = [0, 2, 4].map(i => toLin(parseInt(h.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklabToRgb([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const inGamut = rgb => rgb.every(c => c >= -1e-4 && c <= 1 + 1e-4);
// Mr. Stocks(assets/css/style.css) 다크 색과 똑같이 맞출 색
const ANCHORS = {ffffff: '#11151c', f5f7fa: '#181e27', e3e7ee: '#2a3240', '1c2330': '#e8ecf2', '5b6575': '#9aa4b4', '2456e8': '#5b85ff', '1a3fb0': '#87a6ff'};
function dark(hex) {
  if (ANCHORS[hex.slice(0, 6)]) return ANCHORS[hex.slice(0, 6)] + hex.slice(6);
  const alpha = hex.length === 8 ? hex.slice(6) : '';
  const a = alpha ? parseInt(alpha, 16) / 255 : 1;
  const [L, A, B] = hexToOklab(hex.slice(0, 6));
  if (a < 1 && L < 0.3) return '#' + hex; // 반투명 검정 = 그림자
  const L2 = Math.min(0.94, 0.185 + (1 - L) ** 0.85); // 흰색→0.185(Mr. Stocks 다크 배경), 진한 글자→밝은 글자
  // 회색 계열은 Mr. Stocks 다크 배경처럼 살짝 푸른빛을 섞음
  const tint = Math.hypot(A, B) < 0.04 ? [-0.003, -0.014] : [0, 0];
  let k = 1, rgb = oklabToRgb([L2, A + tint[0], B + tint[1]]);
  while (!inGamut(rgb) && k > 0) { k -= 0.05; rgb = oklabToRgb([L2, (A + tint[0]) * k, (B + tint[1]) * k]); }
  const out = rgb.map(c => Math.round(Math.min(1, Math.max(0, toSrgb(Math.min(1, Math.max(0, c))))) * 255).toString(16).padStart(2, '0')).join('');
  return '#' + out + alpha;
}

// ---------- 3) 다크 스타일 파일 ----------
const vars = [...used].sort().map(h => `--d-${h}:${dark(h)};`).join('');
const tokens = `--mc-bg:#11151c;--mc-bg-alt:#181e27;--mc-text:#e8ecf2;--mc-muted:#9aa4b4;--mc-primary:#5b85ff;--mc-primary-dark:#87a6ff;--mc-border:#2a3240;color-scheme:dark;`;
const css = `/* 자동 생성 파일 — 직접 고치지 말고 \`npm run theme\`을 실행하세요. (scripts/dark-theme.mjs) */
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${tokens}${vars}}}
:root[data-theme="dark"]{${tokens}${vars}}
/* 카드사·결제 브랜드 로고는 검은 글자가 많아 다크 모드에서 흰 바탕을 깔아 줌 */
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) :is(img[src*="/issuers/"],img[src*="/brands/"]){background:#fff;border-radius:4px;box-shadow:0 0 0 3px #fff}}
:root[data-theme="dark"] :is(img[src*="/issuers/"],img[src*="/brands/"]){background:#fff;border-radius:4px;box-shadow:0 0 0 3px #fff}
`;
writeFileSync(join(APP, 'mr-cards-dark.css'), css);
console.log(`다크 모드: 색 ${used.size}개 · 파일 ${files.length}개 처리 → app/mr-cards-dark.css`);
