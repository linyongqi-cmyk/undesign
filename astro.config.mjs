import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { localAdminIntegration } from './scripts/local-admin-integration.mjs';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

// GitHub Pages supplies BASE_PATH in its build workflow. Locally, the site lives at /.
export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || 'https://linyongqi.studio.site',
  base: process.env.BASE_PATH || '/',
  devToolbar: { enabled: false },
  server: { host: '127.0.0.1' },
  // The integration adds its Vite middleware only during `astro dev`.
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.includes('/admin') && !page.includes('/preview'),
    }),
    localAdminIntegration(projectRoot),
  ],
});
