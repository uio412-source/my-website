// Mr. Travel 세계지도(travel/world.json) 생성기 — 지도 모양을 바꿀 때만 한 번 실행하고 결과를 커밋합니다.
//   cd tools/travel && npm i --no-save world-atlas@2 d3-geo@3 topojson-client@3 topojson-simplify@3 && node world.mjs
// Natural Earth 1:50m(공개 데이터)을 태평양 중심(경도 150°)으로 투영해 해안선·국경선·여행지 나라 모양을 path로 저장합니다.
// 핀 위치는 travel.js가 같은 투영식(k·tx·ty·l0)으로 계산하므로, 여기서 투영을 바꾸면 travel.js의 project()도 맞춰 주세요.
import fs from 'node:fs';
import {geoNaturalEarth1, geoPath} from 'd3-geo';
import {feature, mesh} from 'topojson-client';
import {presimplify, simplify, quantile} from 'topojson-simplify';
const topo = JSON.parse(fs.readFileSync(new URL('./node_modules/world-atlas/countries-50m.json', import.meta.url)));
const ps = presimplify(topo);
const t = simplify(ps, quantile(ps, 0.07));
// 남극 제외
t.objects.countries.geometries = t.objects.countries.geometries.filter(g => g.id !== '010');
const land = mesh(t, t.objects.countries, (a, b) => a === b); // 해안선만
const borders = mesh(t, t.objects.countries, (a, b) => a !== b); // 국경선
const W = 1000, H = 470, L0 = 150;
const proj = geoNaturalEarth1().rotate([-L0, 0]);
// 남극 빼고 위도 -58~84를 꽉 채우게
proj.fitExtent([[6, 6], [W - 6, H - 6]], {type: 'MultiPoint', coordinates: [[L0 - 179.9, 0], [L0 + 179.9, 0], [L0, 84], [L0, -56]]});
const path = geoPath(proj);
const r = (d) => d.replace(/(\d+\.\d)\d+/g, '$1');
const k = proj.scale(), [tx, ty] = proj.translate();
// 나라 모양(선택 표시용): 여행지 나라만
const want = {JP:'392',CN:'156',TW:'158',MN:'496',VN:'704',TH:'764',PH:'608',SG:'702',MY:'458',ID:'360',LA:'418',AU:'036',NZ:'554',US:'840',CA:'124',FR:'250',IT:'380',ES:'724',GB:'826',CH:'756',TR:'792',AE:'784',GU:'316',HK:'344',MO:'446'};
const shapes = {};
const fc = feature(t, t.objects.countries).features;
for (const [code, id] of Object.entries(want)) {
  const f = fc.find(x => x.id === id);
  if (f) shapes[code] = r(path(f));
}
const out = {w: W, h: H, k: +k.toFixed(4), tx: +tx.toFixed(3), ty: +ty.toFixed(3), l0: L0, land: r(path(land)), borders: r(path(borders)), shapes};
fs.writeFileSync(new URL('../../travel/world.json', import.meta.url), JSON.stringify(out));
console.log('bytes', JSON.stringify(out).length, 'land', out.land.length, 'borders', out.borders.length, 'shapes', Object.keys(shapes).length, Object.keys(want).filter(c=>!shapes[c]));
