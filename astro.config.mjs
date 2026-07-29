// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

import { SITE_URL } from './src/lib/site-url.mjs';

export default defineConfig({
  site: SITE_URL,

  // Every marketing/policy route opts into `export const prerender = true`.
  // Only the API endpoints, /checkout/[product] and /thank-you run on the Worker.
  output: 'server',

  adapter: cloudflare({
    // `compile` keeps image transforms at build time. The marketing images are all
    // known at build, so we never pay for a runtime transform — and prerendered
    // pages stay fully static.
    imageService: 'compile',
  }),

  integrations: [
    react(),
    mdx(),
    sitemap({
      // Per-transaction pages with no standalone value in an index.
      filter: (page) => !page.includes('/thank-you') && !page.includes('/checkout/'),
      changefreq: 'monthly',
      priority: 0.7,
    }),
  ],

  image: {
    // Only local assets are used; no remote image domains are allowed.
    domains: [],
    remotePatterns: [],
  },

  vite: {
    plugins: [tailwindcss()],
  },

  security: {
    checkOrigin: true,
  },
});
