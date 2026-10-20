import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [vue()],
  server: {
    proxy: {
      '/wp-json': {
        target: 'http://bg-race.local', //
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: mode === 'app' ? 'dist-app' : 'C:/Users/Admin/Local Sites/bg-race/app/public/wp-content/plugins/car-racer-backend/game',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'game.js',
        chunkFileNames: 'game-[name].js',
        assetFileNames: (a) => (a.name?.endsWith('.css') ? 'game.css' : 'assets/[name][extname]'),
      },
    },
  },
}));
