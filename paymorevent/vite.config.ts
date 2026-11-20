import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import react from '@vitejs/plugin-react';
import {defineConfig, type Plugin} from 'vite';
import {buildCardFiles} from './scripts/card-list.mjs';
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

export default defineConfig({
  base,
  plugins: [react(), cardListFiles()],
  resolve: {
    alias: [
      {find: '@', replacement: fileURLToPath(new URL('.', import.meta.url))},
      {find: /^lucide-react$/, replacement: fileURLToPath(new URL('./lib/icons.ts', import.meta.url))},
    ],
  },
});
