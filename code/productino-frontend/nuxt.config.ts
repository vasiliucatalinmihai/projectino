export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss'],
  tailwindcss: { cssPath: '~/assets/css/main.css' },

  app: {
    head: {
      title: 'productino',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/mark.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap',
        },
      ],
    },
  },

  devServer: {
    host: '0.0.0.0',
    port: 3000,
  },

  // The dev server sits behind the nginx proxy, so requests arrive with
  // Host: dev.production.io — allow it through Vite's host check.
  vite: {
    server: {
      allowedHosts: ['dev.production.io'],
    },
  },

  runtimeConfig: {
    // Server-side only: used during SSR to reach the backend over the docker network.
    apiBaseInternal: process.env.NUXT_API_BASE_INTERNAL || 'http://backend:8080',
    public: {
      // Exposed to the browser: the backend via the nginx proxy.
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://dev-api.production.io',
    },
  },
});
