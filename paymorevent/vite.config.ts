import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import react from '@vitejs/plugin-react';
import {defineConfig, type Plugin} from 'vite';
import {buildCardFiles} from './scripts/card-list.mjs';
import {dbProgress, kstToday} from './scripts/db-progress.mjs';
import {applyVerifiedCardRules, readVerifiedCardRules} from './scripts/verified-card-rules.mjs';

const base = '/my-website/paymorevent/';

// Serves (dev) and emits (build) card-list.json and card-search.json, derived
// from data/catalog-snapshot.json. See scripts/card-list.mjs.
function cardListFiles(): Plugin {
  const readJSON = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const build = () => {
    const snapshot = readJSON('./data/catalog-snapshot.json');
    const cards = applyVerifiedCardRules(snapshot.cards, readVerifiedCardRules(), {summary: true});
    // 카드 목록·검색만 앱이 읽습니다. catalog-snapshot.json은 빌드·검증용이라 dist에 내보내지 않습니다(12.5MB 절감).
    return buildCardFiles({...snapshot, cards}, readJSON('./data/card-images.json'));
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
    },
  };
}

// 푸터 'DB 작업' 진행률: 저장소의 data/collect-queue.json을 빌드 때 몇 숫자로 줄여 넣습니다(못 읽으면 숨김).
function dbProgressDefine(): Plugin {
  let progress = null;
  try {
    progress = dbProgress(JSON.parse(readFileSync(new URL('../data/collect-queue.json', import.meta.url), 'utf8')), kstToday());
  } catch { /* 대기열이 없거나 깨져도 빌드는 계속 */ }
  return {name: 'mr-cards-db-progress', config: () => ({define: {__DB_PROGRESS__: JSON.stringify(progress)}})};
}

export default defineConfig({
  base,
  plugins: [react(), cardListFiles(), dbProgressDefine()],
  resolve: {
    alias: [
      {find: '@', replacement: fileURLToPath(new URL('.', import.meta.url))},
      {find: /^lucide-react$/, replacement: fileURLToPath(new URL('./lib/icons.ts', import.meta.url))},
    ],
  },
});
