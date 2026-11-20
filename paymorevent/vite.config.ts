import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/my-website/paymorevent/',
  plugins: [react()],
  resolve: {
    alias: [
      {find: '@', replacement: fileURLToPath(new URL('.', import.meta.url))},
      {find: /^lucide-react$/, replacement: fileURLToPath(new URL('./lib/icons.ts', import.meta.url))},
    ],
  },
});
