// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2026-01-10',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
  ],
  
  runtimeConfig: {
    // 1. Claves privadas (Solo visibles en el servidor/backend)
    groqApiKey: process.env.GROQ_API_KEY,

    // 2. Claves PÚBLICAS (Visibles en el navegador/frontend)
    // Es vital que estén dentro de "public" para que el composable las lea
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY,
    }
  }
})