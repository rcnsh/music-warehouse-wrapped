import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The Cloudflare plugin runs worker/index.ts in dev too, so /api reaches the
// deployed warehouse through the same service binding as production.
export default defineConfig({
  plugins: [react(), cloudflare()],
});
