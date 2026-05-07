//pages/today-menu.vue
<script setup>
import { ref, computed, onMounted } from 'vue'

// --- 1. BASE DE DATOS LOCAL PARA LA PANTALLA ---
const menus = ref({
  clasico: {
    name: 'Menú Clásico',
    price: 10.00,
    theme: 'orange', 
    entradas: [],
    segundos: [],
    bebidas: [],
    postres: [],
    agotados: []
  },
  ejecutivo: {
    name: 'Menú Ejecutivo',
    price: 15.00,
    theme: 'indigo', 
    entradas: [],
    segundos: [],
    bebidas: [],
    postres: [],
    agotados: [] 
  }
})

const categories = [
  { key: 'entradas', label: 'Entradas de Hoy' },
  { key: 'segundos', label: 'Segundos (Fondo)' },
  { key: 'bebidas', label: 'Refrescos' },
  { key: 'postres', label: 'Postres' }
]

const newItems = ref({
  clasico: { entradas: '', segundos: '', bebidas: '', postres: '' },
  ejecutivo: { entradas: '', segundos: '', bebidas: '', postres: '' }
})

// 🧹 (SE ELIMINARON TODAS LAS VARIABLES Y EVENTOS DEL PULL TO REFRESH MANUAL)

async function loadTodayMenu() {
  try {
    const todayData = await $fetch('/api/menu/today')
    if (todayData) {
      // Protección: Si en la BD antigua no existía el array "agotados", se lo creamos
      if (!todayData.clasico.agotados) todayData.clasico.agotados = []
      if (!todayData.ejecutivo.agotados) todayData.ejecutivo.agotados = []
      
      menus.value = todayData
    }
  } catch (error) {
    console.error('No hay menú publicado hoy todavía o hubo un error de conexión.')
  }
}

onMounted(() => {
  loadTodayMenu()
})

function addItem(menuKey, categoryKey) {
  const itemText = newItems.value[menuKey][categoryKey].trim()
  if (itemText) {
    menus.value[menuKey][categoryKey].push(itemText)
    newItems.value[menuKey][categoryKey] = ''
  }
}

function removeItem(menuKey, categoryKey, index) {
  const itemText = menus.value[menuKey][categoryKey][index]
  menus.value[menuKey][categoryKey].splice(index, 1)
  
  // Si lo borramos por completo, también lo sacamos de la lista de agotados si estaba ahí
  const agotadoIndex = menus.value[menuKey].agotados.indexOf(itemText)
  if (agotadoIndex > -1) {
    menus.value[menuKey].agotados.splice(agotadoIndex, 1)
  }
}

// 🚀 LÓGICA DE PLATO AGOTADO (SOLD OUT)
function toggleAgotado(menuKey, itemText) {
  if (!menus.value[menuKey].agotados) {
    menus.value[menuKey].agotados = []
  }
  
  const index = menus.value[menuKey].agotados.indexOf(itemText)
  if (index > -1) {
    menus.value[menuKey].agotados.splice(index, 1) // Recuperar stock
  } else {
    menus.value[menuKey].agotados.push(itemText) // Marcar agotado
  }
  
  // Guardado silencioso para que se actualice el POS de los meseros al instante
  saveMenuSilently()
}

async function saveMenuSilently() {
  try {
    await $fetch('/api/menu/save', {
      method: 'POST',
      body: menus.value
    })
  } catch (e) {
    console.error('Error auto-guardando estado de agotado:', e)
  }
}

// --- 4. LÓGICA DEL MODAL Y NOTIFICACIÓN ---
const showSummaryModal = ref(false)
const isSaving = ref(false)
const showSuccessToast = ref(false) 

const totalPlatosClasico = computed(() => {
  return menus.value.clasico.entradas.length + menus.value.clasico.segundos.length + menus.value.clasico.bebidas.length + menus.value.clasico.postres.length
})
const totalPlatosEjecutivo = computed(() => {
  return menus.value.ejecutivo.entradas.length + menus.value.ejecutivo.segundos.length + menus.value.ejecutivo.bebidas.length + menus.value.ejecutivo.postres.length
})

function openPublishModal() {
  showSummaryModal.value = true
}

async function confirmPublish() {
  isSaving.value = true
  try {
    await $fetch('/api/menu/save', {
      method: 'POST',
      body: menus.value
    })

    showSummaryModal.value = false
    showSuccessToast.value = true
    
    setTimeout(() => {
      showSuccessToast.value = false
    }, 3500)
    
  } catch (error) {
    console.error('Error al guardar el menú:', error)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="min-h-[calc(100vh-80px)] bg-gray-50 p-4 md:p-8 relative">
      <header class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-7 h-7 md:w-8 md:h-8 text-orange-500"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>
          Pizarra del Menú
        </h1>
        <p class="text-slate-500 mt-1 text-sm md:text-base">Toca un plato para marcarlo como AGOTADO en la caja.</p>
      </div>
      
      <button 
        @click="openPublishModal"
        class="w-full md:w-auto relative overflow-hidden group bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-3 md:py-3.5 px-6 md:px-8 rounded-xl shadow-lg shadow-orange-500/40 hover:shadow-orange-500/60 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2"
      >
        <div class="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
        <div class="relative z-10 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5 md:w-6 md:h-6 group-hover:animate-bounce"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
          <span class="tracking-wide">Publicar Menú</span>
        </div>
      </button>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start pb-10">
      <div v-for="(menuData, menuKey) in menus" :key="menuKey" class="bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col" :class="menuData.theme === 'orange' ? 'border-orange-200' : 'border-indigo-200'">
        
        <div class="p-5 md:p-6 lg:p-8 border-b" :class="menuData.theme === 'orange' ? 'bg-orange-50 border-orange-100' : 'bg-indigo-50 border-indigo-100'">
          <div class="flex justify-between items-center mb-2">
            <h2 class="text-2xl md:text-3xl font-black tracking-tight" :class="menuData.theme === 'orange' ? 'text-orange-600' : 'text-indigo-600'">{{ menuData.name }}</h2>
            <div class="flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-base md:text-lg bg-white shadow-sm border border-black/10 focus-within:ring-2 transition-all" :class="menuData.theme === 'orange' ? 'text-orange-700 focus-within:ring-orange-400' : 'text-indigo-700 focus-within:ring-indigo-400'">
              <span>S/.</span>
              <input v-model.number="menuData.price" type="number" step="0.50" class="w-12 md:w-14 bg-transparent outline-none text-right font-black">
            </div>
          </div>
          <p class="text-xs md:text-sm font-medium opacity-80" :class="menuData.theme === 'orange' ? 'text-orange-800' : 'text-indigo-800'">Configura los platos disponibles.</p>
        </div>

        <div class="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 bg-white flex-1">
          <div v-for="category in categories" :key="category.key" class="relative">
            <h3 class="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-2">
              {{ category.label }}
              <div class="h-px bg-gray-100 flex-1 ml-2"></div>
            </h3>
            
            <div class="flex flex-wrap gap-2.5 mb-3">
              <div v-for="(item, idx) in menuData[category.key]" :key="idx" 
                   @click="toggleAgotado(menuKey, item)"
                   class="inline-flex items-center gap-2 pl-4 pr-2 py-2 rounded-xl border shadow-sm font-bold text-sm group transition-all cursor-pointer select-none active:scale-95" 
                   :class="menuData.agotados?.includes(item) 
                     ? 'bg-slate-100 border-slate-300 text-slate-400 line-through hover:bg-slate-200 shadow-none' 
                     : (menuData.theme === 'orange' ? 'bg-orange-50/30 border-orange-200 text-orange-800 hover:bg-orange-50' : 'bg-indigo-50/30 border-indigo-200 text-indigo-800 hover:bg-indigo-50')"
                   title="Toca para agotar/reactivar"
              >
                <span class="leading-none mt-[1px] tracking-wide">{{ item }}</span>
                <button @click.stop="removeItem(menuKey, category.key, idx)" 
                        class="w-6 h-6 rounded-lg flex items-center justify-center transition-all opacity-60 group-hover:opacity-100" 
                        :class="menuData.agotados?.includes(item) ? 'bg-slate-300 hover:bg-slate-500 hover:text-white text-white' : (menuData.theme === 'orange' ? 'bg-orange-100 hover:bg-orange-500 hover:text-white text-orange-700' : 'bg-indigo-100 hover:bg-indigo-500 hover:text-white text-indigo-700')">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div v-if="menuData[category.key].length === 0" class="text-slate-400 text-xs md:text-sm font-medium italic py-2">No hay opciones configuradas...</div>
            </div>

            <div class="flex gap-2 mt-2">
              <input v-model="newItems[menuKey][category.key]" @keyup.enter="addItem(menuKey, category.key)" type="text" placeholder="Escribe y presiona Enter..." class="flex-1 bg-white border border-gray-200 text-slate-700 rounded-xl px-3 md:px-4 py-2.5 md:py-3 outline-none focus:ring-2 shadow-sm transition-all text-xs md:text-sm font-medium placeholder-slate-300" :class="menuData.theme === 'orange' ? 'focus:ring-orange-100 focus:border-orange-400' : 'focus:ring-indigo-100 focus:border-indigo-400'">
              <button @click="addItem(menuKey, category.key)" class="w-10 h-10 md:w-12 md:h-12 flex-shrink-0 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center active:scale-95" :class="menuData.theme === 'orange' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20' : 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20'">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-5 h-5 md:w-6 md:h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>

  <div v-if="showSummaryModal" class="fixed inset-0 z-[120] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" @click="!isSaving && (showSummaryModal = false)"></div>
    <div class="relative bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden transform transition-all">
      <div class="p-5 md:p-6 border-b border-gray-100 bg-slate-50 flex justify-between items-center">
        <div>
          <h2 class="text-xl md:text-2xl font-black text-slate-800">Confirmar Menú</h2>
          <p class="text-slate-500 text-xs md:text-sm font-medium mt-1">Este será visible en todas las tablets.</p>
        </div>
        <button v-if="!isSaving" @click="showSummaryModal = false" class="p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div class="p-4 md:p-6 overflow-y-auto space-y-4 md:space-y-6">
        <div class="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 md:p-5">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg md:text-xl font-black text-orange-600">{{ menus.clasico.name }}</h3>
            <span class="bg-white px-2 py-1 md:px-3 md:py-1 rounded-lg font-bold text-orange-700 shadow-sm border border-orange-200 text-sm md:text-base">S/. {{ menus.clasico.price.toFixed(2) }}</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs md:text-sm">
            <div><p class="text-[10px] md:text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">Entradas</p><ul class="text-slate-700 font-medium space-y-1"><li v-for="item in menus.clasico.entradas" :key="item" class="truncate" :class="{'line-through text-slate-400': menus.clasico.agotados?.includes(item)}">• {{ item }}</li><li v-if="menus.clasico.entradas.length === 0" class="text-slate-400 italic">Ninguna</li></ul></div>
            <div><p class="text-[10px] md:text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">Segundos</p><ul class="text-slate-700 font-medium space-y-1"><li v-for="item in menus.clasico.segundos" :key="item" class="truncate" :class="{'line-through text-slate-400': menus.clasico.agotados?.includes(item)}">• {{ item }}</li><li v-if="menus.clasico.segundos.length === 0" class="text-slate-400 italic">Ninguno</li></ul></div>
            <div><p class="text-[10px] md:text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">Bebidas</p><ul class="text-slate-700 font-medium space-y-1"><li v-for="item in menus.clasico.bebidas" :key="item" class="truncate" :class="{'line-through text-slate-400': menus.clasico.agotados?.includes(item)}">• {{ item }}</li><li v-if="menus.clasico.bebidas.length === 0" class="text-slate-400 italic">Ninguna</li></ul></div>
            <div><p class="text-[10px] md:text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">Postres</p><ul class="text-slate-700 font-medium space-y-1"><li v-for="item in menus.clasico.postres" :key="item" class="truncate" :class="{'line-through text-slate-400': menus.clasico.agotados?.includes(item)}">• {{ item }}</li><li v-if="menus.clasico.postres.length === 0" class="text-slate-400 italic">Ninguno</li></ul></div>
          </div>
        </div>

        <div class="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 md:p-5">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg md:text-xl font-black text-indigo-600">{{ menus.ejecutivo.name }}</h3>
            <span class="bg-white px-2 py-1 md:px-3 md:py-1 rounded-lg font-bold text-indigo-700 shadow-sm border border-indigo-200 text-sm md:text-base">S/. {{ menus.ejecutivo.price.toFixed(2) }}</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs md:text-sm">
            <div><p class="text-[10px] md:text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Entradas</p><ul class="text-slate-700 font-medium space-y-1"><li v-for="item in menus.ejecutivo.entradas" :key="item" class="truncate" :class="{'line-through text-slate-400': menus.ejecutivo.agotados?.includes(item)}">• {{ item }}</li><li v-if="menus.ejecutivo.entradas.length === 0" class="text-slate-400 italic">Ninguna</li></ul></div>
            <div><p class="text-[10px] md:text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Segundos</p><ul class="text-slate-700 font-medium space-y-1"><li v-for="item in menus.ejecutivo.segundos" :key="item" class="truncate" :class="{'line-through text-slate-400': menus.ejecutivo.agotados?.includes(item)}">• {{ item }}</li><li v-if="menus.ejecutivo.segundos.length === 0" class="text-slate-400 italic">Ninguno</li></ul></div>
            <div><p class="text-[10px] md:text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Bebidas</p><ul class="text-slate-700 font-medium space-y-1"><li v-for="item in menus.ejecutivo.bebidas" :key="item" class="truncate" :class="{'line-through text-slate-400': menus.ejecutivo.agotados?.includes(item)}">• {{ item }}</li><li v-if="menus.ejecutivo.bebidas.length === 0" class="text-slate-400 italic">Ninguna</li></ul></div>
            <div><p class="text-[10px] md:text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Postres</p><ul class="text-slate-700 font-medium space-y-1"><li v-for="item in menus.ejecutivo.postres" :key="item" class="truncate" :class="{'line-through text-slate-400': menus.ejecutivo.agotados?.includes(item)}">• {{ item }}</li><li v-if="menus.ejecutivo.postres.length === 0" class="text-slate-400 italic">Ninguno</li></ul></div>
          </div>
        </div>

        <p class="text-center text-xs md:text-sm text-slate-500 bg-gray-50 py-3 rounded-xl border border-gray-200">
          En total se publicarán <strong>{{ totalPlatosClasico + totalPlatosEjecutivo }}</strong> opciones diferentes.
        </p>
      </div>

      <div class="p-4 md:p-6 bg-slate-50 border-t border-gray-100 flex gap-3 md:gap-4">
        <button v-if="!isSaving" @click="showSummaryModal = false" class="flex-1 bg-white border border-gray-300 text-slate-600 font-bold py-3 md:py-4 rounded-xl hover:bg-gray-100 transition shadow-sm text-sm md:text-base">
          Atrás
        </button>
        <button @click="confirmPublish" :disabled="isSaving" class="flex-[2] text-white font-bold py-3 md:py-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm md:text-base" :class="isSaving ? 'bg-orange-400 cursor-wait' : 'bg-orange-500 hover:bg-orange-600 active:scale-95'">
          <div v-if="isSaving" class="flex items-center gap-2 animate-pulse">
            <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Enviando...
          </div>
          <span v-else class="flex items-center gap-2">
            Sí, ¡Publicar! 
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
          </span>
        </button>
      </div>
    </div>
  </div>

  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="transform translate-y-10 opacity-0"
    enter-to-class="transform translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="transform translate-y-0 opacity-100"
    leave-to-class="transform translate-y-10 opacity-0"
  >
    <div 
      v-if="showSuccessToast" 
      class="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-[200] bg-slate-800 text-white pl-4 pr-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700"
    >
      <div class="bg-emerald-500 rounded-full p-1.5 shadow-inner">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-5 h-5 text-white"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
      </div>
      <div>
        <h4 class="font-black text-sm tracking-wide">¡Actualizado!</h4>
        <p class="text-slate-300 text-xs font-medium">Cualquier cambio ya está en la caja.</p>
      </div>
    </div>
  </Transition>
  
</template>

<style scoped>
input[type=number]::-webkit-inner-spin-button, 
input[type=number]::-webkit-outer-spin-button { 
  -webkit-appearance: none; 
  appearance: none; 
  margin: 0; 
}
input[type=number] {
  -moz-appearance: textfield;
  appearance: textfield; 
}
</style>