<script setup>
import { ref, onMounted, onUnmounted } from 'vue' 
import { usePosStore } from '../stores/pos'
import { onBeforeRouteLeave, useRouter } from 'vue-router'

const store = usePosStore()
const router = useRouter()

const isMobileMenuOpen = useState('mobileMenuOpen', () => false)
let radarInterval = null

onMounted(() => {
  store.initializeSession()
  
  if (!store.user) {
    router.push('/login')
  } else {
    //  DISPARAMOS EL RADAR AL ENTRAR Y LUEGO CADA 15 SEGUNDOS
    store.checkGlobalAlerts()
    radarInterval = setInterval(() => {
      store.checkGlobalAlerts()
    }, 15000)
  }
})

onUnmounted(() => {
  if (radarInterval) clearInterval(radarInterval)
})
</script>

<template>
  <div class="flex flex-col lg:flex-row h-screen bg-gray-50 text-slate-800 font-sans">
    
    <header class="lg:hidden bg-white border-b border-gray-200 p-4 flex justify-between items-center z-40 shrink-0 shadow-sm">
      <div class="flex items-center gap-2">
        <div class="bg-orange-500 p-1.5 rounded-lg text-white font-black text-xs italic">K</div>
        <span class="font-black text-slate-800 tracking-tight">Kausa<span class="text-orange-500">App</span></span>
      </div>
      <button @click="isMobileMenuOpen = !isMobileMenuOpen" class="relative text-slate-500 p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition">
        <span v-if="store.globalAlerts.kitchenCount > 0 || store.globalAlerts.hasPendingPayments" class="absolute -top-1 -right-1 flex h-3 w-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
        </span>
        <svg v-if="!isMobileMenuOpen" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </header>

    <aside 
      class="w-64 bg-white border-r border-gray-200 flex-col shadow-sm z-50 absolute lg:relative inset-y-0 left-0 transform transition-transform duration-300 lg:translate-x-0"
      :class="isMobileMenuOpen ? 'translate-x-0 flex' : '-translate-x-full hidden lg:flex'"
    >
      <div class="p-6 border-b border-gray-100 flex items-center gap-3">
        <div class="bg-orange-100 text-orange-500 p-2 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-slate-800">Kausa<span class="text-orange-500">App</span></h1>
      </div>

      <nav class="flex-1 p-4 space-y-2 overflow-y-auto">
        
        <NuxtLink v-if="['admin', 'glorianora'].includes(store.user?.role)" to="/" @click="isMobileMenuOpen = false" class="flex items-center justify-between p-3 rounded-xl text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition-all duration-200 group font-medium" active-class="bg-orange-50 text-orange-600 font-bold shadow-sm ring-1 ring-orange-200">
          <div class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 group-hover:scale-110 transition"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg> 
            Dashboard
          </div>
        </NuxtLink>

        <NuxtLink v-if="['admin', 'glorianora', 'mesero'].includes(store.user?.role)" to="/pos" @click="isMobileMenuOpen = false" class="flex items-center justify-between p-3 rounded-xl text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition-all duration-200 group font-medium" active-class="bg-orange-50 text-orange-600 font-bold shadow-sm ring-1 ring-orange-200">
          <div class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 group-hover:scale-110 transition"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg> 
            Punto de Venta
          </div>
        </NuxtLink>

        <NuxtLink v-if="['admin', 'glorianora'].includes(store.user?.role)" to="/inventory" @click="isMobileMenuOpen = false" class="flex items-center justify-between p-3 rounded-xl text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition-all duration-200 group font-medium" active-class="bg-orange-50 text-orange-600 font-bold shadow-sm ring-1 ring-orange-200">
          <div class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 group-hover:scale-110 transition"><path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg> 
            Inventario
          </div>
        </NuxtLink>

        <NuxtLink v-if="['admin', 'glorianora'].includes(store.user?.role)" to="/reports" @click="isMobileMenuOpen = false" class="flex items-center justify-between p-3 rounded-xl text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition-all duration-200 group font-medium" active-class="bg-orange-50 text-orange-600 font-bold shadow-sm ring-1 ring-orange-200">
          <div class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 group-hover:scale-110 transition"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg> 
            Reportes
          </div>
          <span v-if="store.globalAlerts.hasPendingPayments" class="relative flex h-2.5 w-2.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
        </NuxtLink>

        <NuxtLink v-if="['admin', 'glorianora', 'cocina'].includes(store.user?.role)" to="/kitchen" @click="isMobileMenuOpen = false" class="flex items-center justify-between p-3 rounded-xl text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition-all duration-200 group font-medium" active-class="bg-orange-50 text-orange-600 font-bold shadow-sm ring-1 ring-orange-200">
          <div class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 group-hover:scale-110 transition"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" /></svg> 
            Cocina
          </div>
          <span v-if="store.globalAlerts.kitchenCount > 0" class="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-black text-white bg-red-500 rounded-full shadow-sm animate-bounce">
            {{ store.globalAlerts.kitchenCount }}
          </span>
        </NuxtLink>

        <NuxtLink v-if="['admin', 'glorianora'].includes(store.user?.role)" to="/settings" @click="isMobileMenuOpen = false" class="flex items-center justify-between p-3 rounded-xl text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition-all duration-200 group font-medium mt-auto" active-class="bg-orange-150 text-orange-600 font-bold shadow-sm ring-1 ring-orange-200">
          <div class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 group-hover:rotate-90 transition duration-300"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg> 
            Ajustes
          </div>
        </NuxtLink>

        <NuxtLink v-if="['admin', 'glorianora'].includes(store.user?.role)" to="/today-menu" @click="isMobileMenuOpen = false" class="relative mt-2 flex items-center justify-between p-3 rounded-xl text-white font-bold transition-all duration-300 group overflow-hidden bg-gradient-to-r from-orange-500 to-red-500 shadow-lg shadow-orange-500/40 hover:scale-[1.02] hover:shadow-orange-500/60" active-class="ring-4 ring-orange-200">
          <div class="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
          <div class="flex items-center gap-3 relative z-10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6 animate-bounce"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg> 
            <span class="tracking-wide">Menú de Hoy</span>
          </div>
        </NuxtLink>

      </nav>

      <div class="p-4 border-t border-gray-100 flex flex-col gap-3">
        <div v-if="store.user" class="flex items-center gap-2 px-2">
          <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm border border-slate-200">{{ store.user.icon || '👤' }}</div>
          <div class="overflow-hidden">
            <p class="text-xs font-bold text-slate-700 truncate">{{ store.user.name }}</p>
            <p class="text-[10px] text-slate-400 uppercase tracking-wider">{{ store.user.role }}</p>
          </div>
        </div>
        <button @click="store.logout()" class="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 hover:text-red-600 transition border border-transparent hover:border-red-100">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" /></svg> Cerrar Sesión
        </button>
      </div>
    </aside>

    <div v-if="isMobileMenuOpen" @click="isMobileMenuOpen = false" class="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 transition-opacity"></div>

    <main class="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-8">
      <slot /> 
    </main>
  </div>
</template>