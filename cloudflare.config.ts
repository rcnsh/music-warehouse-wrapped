import { bindings, defineConfig } from 'cf/config';

export default defineConfig({
  worker: {
    name: 'music-warehouse-wrapped',
    compatibilityDate: '2026-10-01',
    entrypoint: './worker/index.ts',
    observability: { enabled: true },
    assets: {
      notFoundHandling: 'single-page-application',
      // The API proxy lives in the Worker; everything else is the static app.
      runWorkerFirst: ['/api/*'],
    },
    env: {
      ASSETS: bindings.assets(),
      // Straight to the warehouse Worker, without leaving Cloudflare or meeting
      // the WAF rule on its public hostname.
      WAREHOUSE: bindings.worker({ worker: 'music-warehouse' }),
    },
  },
});
