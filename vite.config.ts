import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { cloudflare } from "@cloudflare/vite-plugin";

/**
 * In development, /api goes straight to the deployed warehouse, standing in
 * for the service binding the production Worker uses. If .dev.vars holds
 * WAREHOUSE_TOKEN, signing in with the token "dev" uses it, so the real one
 * never has to be pasted into a browser.
 */
function devToken(): string | null {
  try {
    return /^WAREHOUSE_TOKEN=(.+)$/m.exec(readFileSync('.dev.vars', 'utf8'))?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    proxy: {
      '/api': {
        target: process.env.WAREHOUSE_URL ?? 'https://warehouse.example',
        changeOrigin: true,
        configure(proxy) {
          const token = devToken();
          proxy.on('proxyReq', (request) => {
            if (token && request.getHeader('authorization') === 'Bearer dev') request.setHeader('authorization', `Bearer ${token}`);
          });
        },
      },
    },
  },
});