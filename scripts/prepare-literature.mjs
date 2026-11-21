import {fileURLToPath} from 'node:url';
import react from '@vitejs/plugin-react';
import {build} from 'vite';

const fromRoot = name => fileURLToPath(new URL('../' + name, import.meta.url));
await build({
  configFile: false,
  root: fromRoot('app/literature'),
  publicDir: false,
  base: '/literature-app/',
  plugins: [react()],
  resolve: {alias: {'@': fromRoot('')}},
  css: {postcss: fromRoot('')},
  build: {outDir: fromRoot('public/literature-app'), emptyOutDir: true},
});
