import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Tipamos la variable para que TypeScript sepa exactamente qué es
let supabaseInstance: SupabaseClient | null = null

export const useDatabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    // Leemos el entorno de Nuxt
    const config = useRuntimeConfig()
    
    // Le decimos a TypeScript que estamos seguros de que esto es un texto (string)
    const url = config.public.supabaseUrl as string
    const key = config.public.supabaseKey as string
    
    supabaseInstance = createClient(url, key)
  }
  
  return supabaseInstance
}