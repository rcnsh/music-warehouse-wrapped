import { defineConfig } from 'cf/config';

export default defineConfig({
  worker: {
    name: 'music-warehouse-wrapped',
    compatibilityDate: '2026-10-01',
    observability: { enabled: true },
    // Only the custom domain. The workers.dev and preview URLs are off, so
    // there is one public address to reason about.
    domains: ['wrapped.rcn.sh'],
    workersDev: false,
    previewUrls: false,
    // Static only. The browser calls whichever warehouse its reader names, so
    // this Worker holds no binding, credential or address for any of them.
    assets: { notFoundHandling: 'single-page-application' },
  },
});
