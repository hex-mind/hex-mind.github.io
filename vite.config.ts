import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const gitRevision = 'local';

export default defineConfig({
  base: './',
  root: 'app',
  plugins: [vue()],
  worker: {
    format: 'es',
  },
  define: {
    __GIT_REVISION__: JSON.stringify(gitRevision),
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
