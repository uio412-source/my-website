import {mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import react from '@vitejs/plugin-react';
import {defineConfig, type Plugin} from 'vite';
import {buildCardFiles} from './scripts/card-list.mjs';
import {buildPageData} from './scripts/page-data';
import {bestPicking} from './lib/catalog-model';
import {applyVerifiedCardRules, readVerifiedCardRules} from './scripts/verified-card-rules.mjs';

const base = '/my-website/paymorevent/';

// Serves (dev) and emits (build) card-list.json and card-search.json, derived
// from public/catalog-snapshot.json. See scripts/card-list.mjs.
function cardListFiles(): Plugin {
  const readJSON = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const build = () => {
    const snapshot = readJSON('./public/catalog-snapshot.json');
    const cards = applyVerifiedCardRules(snapshot.cards, readVerifiedCardRules(), {summary: true});
    const files = buildCardFiles({...snapshot, cards}, readJSON('./data/card-images.json'));
    return {...files, catalog: {...snapshot, cards, stats: {...snapshot.stats, pickingCount: cards.filter(bestPicking).length}}};
  };
  const initial = build();
  return {
    name: 'mr-cards-card-list',
    config: () => ({define: {__CARD_DATA_VERSION__: JSON.stringify(initial.version)}}),
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? '').split('?')[0];
        const file = path.startsWith(base) ? path.slice(base.length) : path.replace(/^\//, '');
        if (!Object.hasOwn(initial.files, file)) return next();
        // Rebuilt per request so snapshot edits show up without restarting the dev server.
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(build().files[file as keyof typeof initial.files]);
      });
    },
    generateBundle() {
      for (const [fileName, source] of Object.entries(initial.files)) this.emitFile({type: 'asset', fileName, source});
      this.emitFile({type: 'asset', fileName: 'catalog-snapshot.json', source: JSON.stringify(initial.catalog)});
    },
  };
}

// Serves (dev) and writes (build) the per-page data files derived from
// data/events.json, data/cards.json.gz and the card snapshot. See scripts/page-data.ts.
function pageData(): Plugin {
  const source = ['./data/events.json', './public/catalog-snapshot.json', './data/cards.json.gz', './data/home-cards.json', './data/card-images.json', './data/verified-card-rules.json.gz'].map(path => new URL(path, import.meta.url));
  const readJSON = (url: URL) => JSON.parse(readFileSync(url, 'utf8'));
  let cache: {stamp: string; data: ReturnType<typeof buildPageData>} | undefined;
  // 원본 파일이 바뀌었을 때만 다시 만듦 (개발 서버에서 데이터를 고치면 새로고침만 하면 됨)
  const build = () => {
    const stamp = source.map(url => statSync(url).mtimeMs).join();
    if (cache?.stamp !== stamp) {
      const [events, snapshot, details, home, images] = source;
      // card-list.json(요약 카드)과 card-data(상세)에 적용하는 검증 보정을 똑같이 적용 (scripts/verified-card-rules.mjs)
      const rules = readVerifiedCardRules();
      cache = {stamp, data: buildPageData({
        events: readJSON(events),
        snapshotCards: applyVerifiedCardRules(readJSON(snapshot).cards, rules, {summary: true}),
        detailCards: applyVerifiedCardRules(JSON.parse(gunzipSync(readFileSync(details)).toString('utf8')), rules),
        homeCards: readJSON(home), cachedImages: readJSON(images),
      })};
    }
    return cache.data;
  };
  return {
    name: 'mr-cards-page-data',
    config: () => ({define: {__PAGE_DATA_VERSION__: JSON.stringify(build().version)}}),
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? '').split('?')[0];
        const file = path.startsWith(base) ? path.slice(base.length) : path.replace(/^\//, '');
        const content = build().files.get(file);
        if (content === undefined) {
          // 없는 이벤트·카드(호텔 이벤트 등)는 배포 사이트처럼 404 (개발 서버가 index.html을 대신 주지 않게)
          if (/^(event-data|card-family)\//.test(file)) { response.statusCode = 404; response.end(); return; }
          return next();
        }
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(content);
      });
    },
    // 파일이 2,500개쯤이라 빌드 기록이 길어지지 않게 묶음 밖에서 바로 씀
    writeBundle(options) {
      const dir = options.dir ?? 'dist';
      for (const [file, content] of build().files) {
        mkdirSync(dirname(join(dir, file)), {recursive: true});
        writeFileSync(join(dir, file), content);
      }
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), cardListFiles(), pageData()],
  resolve: {
    alias: [
      {find: '@', replacement: fileURLToPath(new URL('.', import.meta.url))},
      {find: /^lucide-react$/, replacement: fileURLToPath(new URL('./lib/icons.ts', import.meta.url))},
    ],
  },
});
