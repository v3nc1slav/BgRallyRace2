import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    proxy: {
      '/wp-json': {
        target: 'http://bg-race.local', //
        changeOrigin: true,
      },
    },
  },
  build: {
  outDir: 'C:/Users/Admin/Local Sites/bg-race/app/public/wp-content/plugins/car-racer-backend/game',
  emptyOutDir: true,
  rollupOptions: {
    output: {
      entryFileNames: 'game.js',
      chunkFileNames: 'game-[name].js',
      assetFileNames: (a) => (a.name?.endsWith('.css') ? 'game.css' : 'assets/[name][extname]'),
    },
  },
},
});

