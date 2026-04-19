<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePosStore } from '../stores/pos'

definePageMeta({
  layout: false
})

const router = useRouter()
const store = usePosStore()

const pinInput = ref('')
const isError = ref(false)
const isChecking = ref(false)

// Agrega un número al PIN
const addDigit = (num) => {
  if (pinInput.value.length < 4) {
    pinInput.value += num
    isError.value = false
  }
}

// Borra el último número
const removeDigit = () => {
  pinInput.value = pinInput.value.slice(0, -1)
  isError.value = false
}

// Cuando el PIN llega a 4 dígitos, validamos automáticamente
watch(pinInput, async (newVal) => {
  if (newVal.length === 4) {
    await checkPin()
  }
})

const checkPin = async () => {
  isChecking.value = true
  try {
    // Le preguntamos al backend cuál es el PIN verdadero de este turno
    const data = await $fetch('/api/settings/active-pin')
    
    if (pinInput.value === data.pin) {
      // ¡PIN CORRECTO! Guardamos la "huella" en el celular del mesero
      const devicePinCookie = useCookie('kausa_device_pin', { maxAge: 60 * 60 * 24 }) // Dura máximo 24h
      devicePinCookie.value = data.pin
      
      // Lo mandamos a su área de trabajo según su rol
      if (store.user?.role === 'cocina') {
        router.push('/kitchen')
      } else {
        router.push('/pos')
      }
    } else {
      // ¡PIN INCORRECTO!
      isError.value = true
      setTimeout(() => { pinInput.value = '' }, 500) // Limpiamos después de medio segundo
    }
  } catch (error) {
    console.error('Error al validar PIN:', error)
    alert('Error de conexión. Intente de nuevo.')
    pinInput.value = ''
  } finally {
    isChecking.value = false
  }
}

const handleLogout = async () => {
  await store.logout()
}
</script>

<template>
  <div class="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
    <div class="absolute top-[-10%] left-[-10%] w-96 h-96 bg-orange-500/20 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

    <div class="w-full max-w-sm bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-3xl shadow-2xl relative z-10 flex flex-col items-center">
      
      <div class="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/10" :class="{ 'animate-bounce text-red-400': isError, 'text-orange-400': !isError }">
        <svg v-if="!isError" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" />
        </svg>
      </div>

      <h1 class="text-2xl font-black text-white mb-2 tracking-wide">KausaApp Segura</h1>
      <p class="text-slate-300 text-sm text-center mb-8 font-medium">
        El turno ha cambiado o tu sesión expiró.<br>Ingresa el PIN del turno actual.
      </p>

      <div class="flex gap-4 mb-10 h-6">
        <div v-for="i in 4" :key="i" 
             class="w-5 h-5 rounded-full transition-all duration-300"
             :class="[
               pinInput.length >= i ? 'bg-orange-500 scale-110 shadow-[0_0_15px_rgba(249,115,22,0.5)]' : 'bg-white/20',
               isError ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : ''
             ]">
        </div>
      </div>

      <div class="grid grid-cols-3 gap-4 w-full px-2">
        <button v-for="num in 9" :key="num" @click="addDigit(num.toString())" :disabled="isChecking"
          class="h-16 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-white text-2xl font-black active:scale-95 transition-all flex items-center justify-center">
          {{ num }}
        </button>
        
        <button @click="handleLogout" class="h-16 rounded-2xl bg-white/5 hover:bg-red-500/20 border border-white/5 text-red-300 text-xs font-bold uppercase tracking-wider active:scale-95 transition-all flex flex-col items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 mb-1">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
          </svg>
          Salir
        </button>

        <button @click="addDigit('0')" :disabled="isChecking" class="h-16 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-white text-2xl font-black active:scale-95 transition-all flex items-center justify-center">
          0
        </button>

        <button @click="removeDigit" :disabled="pinInput.length === 0 || isChecking" class="h-16 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 text-2xl font-black active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 disabled:active:scale-100">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-7 h-7">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12l2.25-2.25M14.25 12 12 14.25m-2.58 4.92-6.375-6.375a1.125 1.125 0 0 1 0-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33Z" />
          </svg>
        </button>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Animación de error (temblor) opcional pero se ve bien */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
.animate-bounce {
  animation: shake 0.4s ease-in-out;
}
</style>