// 혜택 표 한 줄(mc-text.ts의 benefitRow)을 실제 화면과 똑같이 만들어 보고,
// 깨진 라벨("당 …"으로 시작)·문장이 그대로 남은 적용처·추상 문구·`?`로 남은 판정을 찾습니다.
//
//   cd paymorevent && node scripts/label-audit.mjs [--card samsung-aap1452] [--all]
//
// mc-text.ts는 TypeScript라 vite의 라이브러리 빌드로 잠깐 묶어서 불러옵니다(임시 폴더는 지웁니다).
// 결과에 문제가 있으면 코드 1로 끝나므로 CI·수집 PR 전 검사에 쓸 수 있습니다.
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'vite';

const args = process.argv.slice(2);
const cardArg = args.includes('--card') ? args[args.indexOf('--card') + 1] : null;
const all = args.includes('--all'); // 문제 줄을 모두 보여 줌(기본 20줄)

const out = await mkdtemp(join(tmpdir(), 'mc-label-'));
await build({
  configFile: false,
  logLevel: 'silent',
  publicDir: false,
  build: {
    lib: {entry: new URL('../lib/mc-text.ts', import.meta.url).pathname, formats: ['es'], fileName: 'mc-text'},
    outDir: out,
    emptyOutDir: true,
    minify: false,
    write: true,
  },
});
const lib = await import(pathToFileURL(join(out, 'mc-text.js')).href);
await rm(out, {recursive: true, force: true});

const {benefitRow, cleanBenefits} = lib;
const snapshot = JSON.parse(await readFile(new URL('../data/catalog-snapshot.json', import.meta.url), 'utf8'));
const cards = cardArg ? snapshot.cards.filter(c => c.id === cardArg) : snapshot.cards;
if (cardArg && !cards.length) throw new Error(`카드 없음: ${cardArg}`);

// 혜택 칸에만 있어야 할 추상 문구(대상 업종·가맹점을 적지 않은 줄)
const ABSTRACT_ONLY = /^(?:선택\s*)?(?:옵션\s*)?(?:대상\s*)?(?:업종|가맹점)(?:\s*(?:및|·|\/)\s*(?:업종|가맹점))?\s*(?:안내|제공)?$/;
const SEE_MORE = /(?:자세히|상세)\s*보기$/;
const abstractOnly = (text) => {
  const raw = String(text ?? '').trim();
  if (!raw) return false;
  const t = raw.replace(SEE_MORE, '').trim();
  if (!t) return true;
  if (ABSTRACT_ONLY.test(t)) return true;
  return SEE_MORE.test(raw) && t.length <= 25 && !/[,·/]/.test(t);
};
const broken = [], longPlace = [], abstract = [];

for (const card of cards) {
  const rows = cleanBenefits(card).filter(b => !b.voucher || b.rate || b.lines.length);
  for (const b of rows) {
    const r = benefitRow(b);
    const where = `[${card.id}] ${card.name}`;
    // 라벨: "당 스카이패스", "당 캐쉬백"처럼 단위 앞부분이 잘려 나간 경우
    if (!r.label || !r.label.trim() || /^당(?:\s|$)/.test(r.label) || /^[.\s·,]+$/.test(r.label))
      broken.push(`${where} · 라벨 "${r.label}" ← "${b.title}"`);
    // 적용처: 원문 문장이 통째로 들어가 혜택·라벨과 같은 말을 되풀이하는 경우
    if (r.place && (r.place.length > 44 || (/(?:적립|할인|캐시백|제공)\s*$/.test(r.place) && r.place.length > 30)))
      longPlace.push(`${where} · 적용처 "${r.place}"`);
    if (abstractOnly(b.title) || abstractOnly(r.place ?? '') || abstractOnly((b.lines[0] ?? '').split(' / ')[0]))
      abstract.push(`${where} · "${b.title}" · 적용처 "${r.place}"`);
  }
}

const spendUnknown = [];
for (const card of cards) {
  const rows = Object.entries(card.paymentEligibility ?? {}).filter(([, v]) => v?.benefit === 'allowed' && v?.spend === 'unknown');
  if (rows.length) spendUnknown.push(`[${card.id}] ${card.name} · ${rows.map(([k]) => k).join('·')}`);
}

const show = (list) => (all ? list : list.slice(0, 20)).map(t => `  - ${t}`).join('\n');
console.log(`카드 ${cards.length}장 · 라벨 깨짐 ${broken.length} · 적용처가 문장 ${longPlace.length} · 추상 문구 ${abstract.length} · 혜택 가능+실적 ? ${spendUnknown.length}`);
for (const [title, list] of [['라벨 깨짐', broken], ['적용처가 문장', longPlace], ['추상 문구', abstract], ['혜택 가능+실적 ?', spendUnknown]]) {
  if (list.length) console.log(`\n${title} (${list.length})\n${show(list)}`);
}
process.exitCode = broken.length || abstract.length ? 1 : 0;
