// pages/login.vue
<script setup>
import { ref } from 'vue'
import { usePosStore } from '../stores/pos'
const store = usePosStore()

// 🚀 TUS IDs ORIGINALES INTACTOS (Para que Supabase no reclame)
// Solo agregamos "sysRole" para que el Middleware sepa cómo tratarlos
const users = [
  { id: 'GloriaNora', name: 'Gloria Nora', role: 'Gerencia General', sysRole: 'glorianora', email: 'gerencia@kausa.pe' },
  { id: 'admin', name: 'Administrador', role: 'Soporte TI', sysRole: 'admin', email: 'admin@kausa.pe' },
  { id: 'Usuarios', name: 'Salón', role: 'Meseros', sysRole: 'mesero', email: 'salon@kausa.pe' },
  { id: 'Chef', name: 'Cocina', role: 'Chef', sysRole: 'cocina', email: 'cocina@kausa.pe' }
]

const selectedUser = ref(null)
const password = ref('')
const errorMsg = ref('')
const isLoading = ref(false)

function selectUser(user) {
  selectedUser.value = user
  password.value = ''
  errorMsg.value = ''
}

function cancelLogin() {
  selectedUser.value = null
  password.value = ''
  errorMsg.value = ''
}

async function login() {
  if (!password.value) return
  
  isLoading.value = true
  errorMsg.value = ''

  try {
    const data = await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        email: selectedUser.value.email,
        password: password.value
      }
    })

    // 🚀 Usamos el sysRole para la seguridad de Nuxt
    store.setUser({
      id: data.user?.id || selectedUser.value.id,
      name: selectedUser.value.name,
      role: selectedUser.value.sysRole, // El guachimán lee esto ('mesero', 'cocina')
      icon: '' 
    })
    
    navigateTo('/')

  } catch (error) {
    console.error("🔥 Error de Autenticación:", error)
    const message = error.response?._data?.statusMessage || error.response?._data?.message || 'Contraseña incorrecta. Intenta de nuevo.'
    errorMsg.value = message
    password.value = ''
  } finally {
    isLoading.value = false
  }
}
definePageMeta({ layout: false })
</script>

<template>
  <div class="min-h-screen bg-orange-50 flex items-center justify-center p-4">
    
    <div class="bg-white p-8 rounded-2xl w-full max-w-md text-center border border-orange-100 shadow-xl transition-all duration-300">
      
      <div class="text-orange-500 mb-4 bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-10 h-10"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" /></svg>
      </div>
      <h1 class="text-3xl font-bold text-slate-800 mb-1">Kausa<span class="text-orange-500">App</span></h1>
      <p class="text-slate-500 mb-8 text-sm">Punto de Venta & Inventario</p>
      
      <div v-if="!selectedUser" class="grid grid-cols-2 gap-4">
        <button 
          v-for="user in users" 
          :key="user.id"
          @click="selectUser(user)"
          class="flex flex-col items-center p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 hover:shadow-md transition group text-slate-500"
        >
          <div class="mb-2 group-hover:scale-110 transition duration-300">
            <svg v-if="user.id === 'GloriaNora'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
            <svg v-else-if="user.id === 'admin'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>
            <svg v-else-if="user.id === 'Usuarios'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" /></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" /></svg>
          </div>
          <span class="font-bold text-slate-800 text-sm group-hover:text-orange-600 transition">{{ user.name }}</span>
          <span class="text-xs">{{ user.role }}</span>
        </button>
      </div>

      <div v-else class="animate-in fade-in zoom-in duration-200">
        <div class="flex items-center justify-center gap-3 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div class="text-left">
            <p class="text-sm text-slate-500 leading-tight">Ingresando como:</p>
            <p class="font-bold text-slate-800 text-lg leading-tight">{{ selectedUser.name }}</p>
          </div>
        </div>

        <form @submit.prevent="login" class="space-y-4">
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
            </div>
            <input 
              v-model="password" 
              type="password" 
              placeholder="••••••••" 
              class="w-full bg-white border-2 border-gray-200 rounded-xl py-4 pl-12 pr-4 text-center text-2xl tracking-widest text-slate-800 focus:border-orange-500 focus:outline-none transition shadow-inner disabled:bg-gray-50"
              required
              autofocus
              :disabled="isLoading"
            >
            <p v-if="errorMsg" class="text-red-500 text-sm font-bold mt-2 animate-bounce">{{ errorMsg }}</p>
          </div>

          <button 
            type="submit"
            :disabled="isLoading"
            class="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/30 transition text-lg disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            <span v-if="isLoading" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ isLoading ? 'Verificando...' : 'Entrar al Sistema' }}
          </button>
          
          <button 
            type="button"
            @click="cancelLogin"
            :disabled="isLoading"
            class="w-full bg-white text-slate-500 hover:text-slate-800 font-bold py-3 rounded-xl transition text-sm border border-gray-200 disabled:opacity-50"
          >
            ← Cambiar de usuario
          </button>
        </form>
      </div>
      
    </div>
  </div>
</template>