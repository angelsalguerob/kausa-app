<script setup>
import { ref, computed } from 'vue'

// Propiedades que recibirá desde tu Dashboard (lo que el sistema espera)
const props = defineProps({
  isOpen: Boolean,
  expectedCash: { type: Number, default: 0 },
  expectedYape: { type: Number, default: 0 },
  expectedPorCobrar: { type: Number, default: 0 } // Reemplazamos Plin por Por Cobrar
})

const emit = defineEmits(['close', 'confirm'])

// Entradas del usuario (Empiezan en null para obligar a que cuenten físicamente)
const actualCash = ref(null)
const actualYape = ref(null)
const actualPorCobrar = ref(null) // Nuevo input para los fiados que se pagan a última hora

// Cálculos de diferencias por método
const diffCash = computed(() => (actualCash.value || 0) - props.expectedCash)
const diffYape = computed(() => (actualYape.value || 0) - props.expectedYape)
const diffPorCobrar = computed(() => (actualPorCobrar.value || 0) - props.expectedPorCobrar)

// Totales Globales
const totalExpected = computed(() => props.expectedCash + props.expectedYape + props.expectedPorCobrar)
const totalActual = computed(() => (actualCash.value || 0) + (actualYape.value || 0) + (actualPorCobrar.value || 0))
const globalDiff = computed(() => totalActual.value - totalExpected.value)

const cerrarModal = () => {
  emit('close')
}

const confirmarCierre = () => {
  // Aquí le avisas al Dashboard que ya se cerró la caja
  emit('confirm', {
    totalExpected: totalExpected.value,
    totalActual: totalActual.value,
    globalDiff: globalDiff.value
  })
  // Limpiamos los campos
  actualCash.value = null
  actualYape.value = null
  actualPorCobrar.value = null
}
</script>

<template>
  <div v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">

    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">

      <div class="bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="bg-orange-500/20 p-2 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
              class="w-6 h-6 text-orange-400">
              <path fill-rule="evenodd"
                d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z"
                clip-rule="evenodd" />
            </svg>
          </div>
          <h2 class="text-xl font-black text-white italic tracking-tight">Cierre de Caja</h2>
        </div>
        <button @click="cerrarModal"
          class="text-slate-400 hover:text-white transition-colors bg-white/5 p-1.5 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor"
            class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="p-6 bg-slate-50 flex-1 space-y-4">

        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div class="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <span class="font-black text-xl">S/</span>
          </div>
          <div class="flex-1">
            <p class="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Efectivo</p>
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-slate-500">Sistema: {{ expectedCash.toFixed(2) }}</span>
              <span class="text-xs font-bold"
                :class="diffCash < 0 ? 'text-red-500' : (diffCash > 0 ? 'text-orange-500' : 'text-emerald-500')">
                {{ diffCash > 0 ? '+' : '' }}{{ diffCash.toFixed(2) }}
              </span>
            </div>
          </div>
          <div class="w-32">
            <input v-model="actualCash" type="number" placeholder="0.00"
              class="w-full bg-slate-50 border border-slate-200 text-slate-800 text-right font-black text-lg py-2 px-3 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none transition-all" />
          </div>
        </div>

        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div class="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
            <span class="font-black text-lg">Y</span>
          </div>
          <div class="flex-1">
            <p class="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Yape/Plin/Tarjeta</p>
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-slate-500">Sistema: {{ expectedYape.toFixed(2) }}</span>
              <span class="text-xs font-bold"
                :class="diffYape < 0 ? 'text-red-500' : (diffYape > 0 ? 'text-orange-500' : 'text-emerald-500')">
                {{ diffYape > 0 ? '+' : '' }}{{ diffYape.toFixed(2) }}
              </span>
            </div>
          </div>
          <div class="w-32">
            <input v-model="actualYape" type="number" placeholder="0.00"
              class="w-full bg-slate-50 border border-slate-200 text-slate-800 text-right font-black text-lg py-2 px-3 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none transition-all" />
          </div>
        </div>

        <div class="bg-amber-50 p-4 rounded-2xl border border-amber-200 shadow-sm flex items-center gap-4">
          <div class="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <span class="font-black text-xl">S/</span>
          </div>
          <div class="flex-1">
            <p class="text-[11px] font-black uppercase tracking-widest text-amber-700 mb-1">Pendientes / Fiados</p>
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-amber-800">Sistema: {{ expectedPorCobrar.toFixed(2) }}</span>
              <span class="text-xs font-bold"
                :class="diffPorCobrar < 0 ? 'text-red-500' : (diffPorCobrar > 0 ? 'text-amber-600' : 'text-emerald-500')">
                {{ diffPorCobrar > 0 ? '+' : '' }}{{ diffPorCobrar.toFixed(2) }}
              </span>
            </div>
          </div>
          <div class="w-32">
            <input v-model="actualPorCobrar" type="number" placeholder="0.00"
              class="w-full bg-white border border-amber-200 text-slate-800 text-right font-black text-lg py-2 px-3 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none transition-all shadow-inner" />
          </div>
        </div>

      </div>

      <div class="bg-white p-6 border-t border-slate-100">
        <div class="flex justify-between items-end mb-6">
          <div>
            <p class="text-sm font-bold text-slate-500">Total Físico / Real</p>
            <p class="text-3xl font-black text-slate-900">S/. {{ totalActual.toFixed(2) }}</p>
          </div>
          <div class="text-right">
            <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Resultado</p>
            <div v-if="globalDiff === 0"
              class="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg font-black text-sm border border-emerald-200">
              ✓ Cuadre Perfecto
            </div>
            <div v-else-if="globalDiff < 0"
              class="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-black text-sm border border-red-200">
              Faltan S/. {{ Math.abs(globalDiff).toFixed(2) }}
            </div>
            <div v-else
              class="bg-orange-50 text-orange-600 px-3 py-1.5 rounded-lg font-black text-sm border border-orange-200">
              Sobran S/. {{ globalDiff.toFixed(2) }}
            </div>
          </div>
        </div>

        <div class="flex gap-3">
          <button @click="cerrarModal"
            class="px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
            Cancelar
          </button>
          <button @click="confirmarCierre"
            class="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
              <path fill-rule="evenodd"
                d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z"
                clip-rule="evenodd" />
            </svg>
            Confirmar y Cerrar Turno
          </button>
        </div>
      </div>

    </div>
  </div>
</template>