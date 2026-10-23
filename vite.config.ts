import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

const clientLocales = (): Plugin => ({
  name: 'client-locales',
  enforce: 'pre',
  transform(code, id) {
    if (!/[\\/]locales[\\/][a-z]{2}\.json$/.test(id)) {
      return null;
    }
    const { server: _server, ...client } = JSON.parse(code);
    return { code: JSON.stringify(client), map: null };
  },
});

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [clientLocales(), vue()],
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
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
    manifest: true,
    rollupOptions: {
      output: {
        entryFileNames: 'game-[hash].js',
        chunkFileNames: 'game-[name]-[hash].js',
        assetFileNames: (a) => (a.name?.endsWith('.css') ? 'game-[hash].css' : 'assets/[name][extname]'),
      },
    },
  },
}));
