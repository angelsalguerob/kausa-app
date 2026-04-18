// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2026-01-10',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    // Eliminamos el módulo de supabase porque ya no lo necesitamos
    
  ],
  
  runtimeConfig: {
    // Esto hace que la clave solo exista en el backend
    groqApiKey: process.env.GROQ_API_KEY,
    //geminiApiKey: process.env.GEMINI_API_KEY,
  }
})