import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Main bundle includes Pixi.js (~509 kB minified); acceptable for this game.
    chunkSizeWarningLimit: 600,
  },
});
