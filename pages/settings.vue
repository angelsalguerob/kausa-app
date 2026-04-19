<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { usePosStore } from '../stores/pos'

const store = usePosStore()

// --- NAVEGACIÓN DE AJUSTES ---
const activeTab = ref('mapa') // general, usuarios, impresion, avanzado, mapa

// Mock de datos para los ajustes (Para que se vea funcional)
const config = ref({
  nombre: 'Kausa Restaurante',
  ruc: '20123456789',
  direccion: 'Av. La Molina 123',
  moneda: 'Soles (S/.)',
  ticketMsj: '¡Gracias por su preferencia! Vuelva pronto.',
  impresoraCaja: 'Bluetooth - TM200',
  impresoraCocina: 'Red - Cocina LAN',
  propinaAuto: false,
  pinAnulacion: true,
  botPersonality: 'Amigable y Rápido'
})

// --- CONFIGURACIÓN DE LA CUADRÍCULA (SNAP-TO-GRID) ---
const GRID_SIZE = 25
const isLoading = ref(true)
const isSaving = ref(false)
const isAddingTable = ref(false)

// --- ESTADOS DE SELECCIÓN Y ELIMINACIÓN ---
const selectedTable = ref(null)
const showDeleteModal = ref(false)

const showToast = ref(false)
const toastMessage = ref('')

function triggerToast(message) {
  toastMessage.value = message
  showToast.value = true
  setTimeout(() => { showToast.value = false }, 3000)
}

onMounted(async () => {
  isLoading.value = true
  try {
    await store.loadTables()
  } catch (error) {
    console.error('Error cargando mesas:', error)
  } finally {
    isLoading.value = false
  }
})

// --- LÓGICA DE AGREGAR MESA ---
async function handleAddTable() {
  isAddingTable.value = true
  try {
    const tablesOnly = store.tables.filter(t => t.type === 'table')
    let nextNumber = 1
    if (tablesOnly.length > 0) {
      const numbers = tablesOnly.map(t => parseInt(t.name.replace(/\D/g, '')) || 0)
      nextNumber = Math.max(...numbers) + 1
    }

    await store.addTable({
      name: `Mesa ${nextNumber}`,
      type: 'table',
      icon: `${nextNumber}`,
      pos_x: 350, // Lo soltamos en el medio del área principal
      pos_y: 350
    })
    triggerToast(`Mesa ${nextNumber} añadida al salón.`)
  } catch (error) {
    alert('Error al agregar una nueva mesa.')
  } finally {
    isAddingTable.value = false
  }
}

// --- LÓGICA DE ELIMINAR MESA ---
function promptDeleteTable() {
  if (selectedTable.value) {
    showDeleteModal.value = true
  }
}

async function confirmDeleteTable() {
  if (selectedTable.value) {
    await store.deleteTable(selectedTable.value.id)
    triggerToast(`Se eliminó la ${selectedTable.value.name}.`)
    selectedTable.value = null
    showDeleteModal.value = false
  }
}

// --- LÓGICA DE DRAG & DROP ---
const canvasRef = ref(null)
const draggingTable = ref(null)
const dragOffset = ref({ x: 0, y: 0 })

function onDragStart(event, table) {
  draggingTable.value = table
  selectedTable.value = table

  const canvasRect = canvasRef.value.getBoundingClientRect()
  const scrollLeft = canvasRef.value.scrollLeft
  const scrollTop = canvasRef.value.scrollTop

  const currentX = table.pos_x || 0
  const currentY = table.pos_y || 0

  dragOffset.value = {
    x: event.clientX - canvasRect.left + scrollLeft - currentX,
    y: event.clientY - canvasRect.top + scrollTop - currentY
  }

  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
}

function onDragMove(event) {
  if (!draggingTable.value) return

  const canvasRect = canvasRef.value.getBoundingClientRect()
  const scrollLeft = canvasRef.value.scrollLeft
  const scrollTop = canvasRef.value.scrollTop

  let rawX = event.clientX - canvasRect.left + scrollLeft - dragOffset.value.x
  let rawY = event.clientY - canvasRect.top + scrollTop - dragOffset.value.y

  // 🚀 LÍMITES AMPLIADOS PARA EL NUEVO MAPA (1200x800px)
  rawX = Math.max(0, Math.min(rawX, 1200 - 60))
  rawY = Math.max(0, Math.min(rawY, 800 - 60))

  draggingTable.value.pos_x = Math.round(rawX / GRID_SIZE) * GRID_SIZE
  draggingTable.value.pos_y = Math.round(rawY / GRID_SIZE) * GRID_SIZE
}

function onDragEnd() {
  draggingTable.value = null
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
}

async function handleSavePositions() {
  isSaving.value = true
  try {
    await store.saveAllTablePositions()
    triggerToast('Diseño del salón guardado localmente.')
    selectedTable.value = null
  } catch (error) {
    alert('Error al guardar posiciones.')
  } finally {
    isSaving.value = false
  }
}

function handleCanvasClick() {
  selectedTable.value = null
}

function saveMockSettings() {
  triggerToast('Ajustes guardados correctamente.')
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col lg:flex-row pb-20 lg:pb-0">

    <aside
      class="w-full lg:w-64 bg-white border-r border-gray-200 shrink-0 lg:h-screen lg:sticky top-0 p-4 overflow-y-auto">
      <h2 class="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3 px-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
          class="w-7 h-7 text-orange-500">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
        Ajustes
      </h2>
      <nav class="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-hide">
        <button @click="activeTab = 'general'"
          class="flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors whitespace-nowrap"
          :class="activeTab === 'general' ? 'bg-orange-50 text-orange-600' : 'text-slate-600 hover:bg-slate-50'">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
            class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
          </svg>
          Negocio
        </button>
        <button @click="activeTab = 'usuarios'"
          class="flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors whitespace-nowrap"
          :class="activeTab === 'usuarios' ? 'bg-orange-50 text-orange-600' : 'text-slate-600 hover:bg-slate-50'">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
            class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          Usuarios y PIN
        </button>
        <button @click="activeTab = 'mapa'"
          class="flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors whitespace-nowrap"
          :class="activeTab === 'mapa' ? 'bg-orange-50 text-orange-600' : 'text-slate-600 hover:bg-slate-50'">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
            class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.705V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
          </svg>
          Mapa del Local
        </button>
        <button @click="activeTab = 'impresion'"
          class="flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors whitespace-nowrap"
          :class="activeTab === 'impresion' ? 'bg-orange-50 text-orange-600' : 'text-slate-600 hover:bg-slate-50'">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
            class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0v2.796c0 .112.08.202.19.202h10.12c.11 0 .19-.09.19-.202V8.987Zm-8.69 4.043h.008v.008H8.69v-.008Zm3 0h.008v.008h-.008v-.008Zm3 0h.008v.008h-.008v-.008Z" />
          </svg>
          Tickets e Impresión
        </button>
        <button @click="activeTab = 'avanzado'"
          class="flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors whitespace-nowrap"
          :class="activeTab === 'avanzado' ? 'bg-orange-50 text-orange-600' : 'text-slate-600 hover:bg-slate-50'">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
            class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.82 1.508-2.316a7.5 7.5 0 1 0-7.516 0c.85.496 1.508 1.333 1.508 2.316V18" />
          </svg>
          KausaBot / Avanzado
        </button>
      </nav>
    </aside>

    <main class="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">

      <div v-if="activeTab === 'mapa'">
        <div
          class="flex flex-col md:flex-row md:justify-between md:items-center mb-6 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm gap-4">
          <div>
            <h1 class="text-2xl font-bold text-slate-800">Diseño del Salón</h1>
            <p class="text-slate-500 text-sm font-medium">Croquis físico interactivo de KausaApp</p>
          </div>
          <div class="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <Transition enter-active-class="transition-all duration-300 ease-out"
              enter-from-class="opacity-0 w-0 -translate-x-4" enter-to-class="opacity-100 w-auto translate-x-0"
              leave-active-class="transition-all duration-200 ease-in"
              leave-from-class="opacity-100 w-auto translate-x-0" leave-to-class="opacity-0 w-0 -translate-x-4">
              <button v-if="selectedTable" @click="promptDeleteTable"
                class="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition active:scale-95 whitespace-nowrap shrink-0 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5"
                  stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Quitar
              </button>
            </Transition>

            <button @click="handleAddTable" :disabled="isAddingTable"
              class="bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-50 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition active:scale-95 whitespace-nowrap shrink-0 text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5"
                stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Agregar Mesa
            </button>

            <button @click="handleSavePositions" :disabled="isSaving"
              class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-95 disabled:bg-slate-300 whitespace-nowrap shrink-0 text-sm">
              <svg v-if="!isSaving" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                stroke-width="2.5" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <svg v-else class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none"
                viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                </path>
              </svg>
              Guardar Plano
            </button>
          </div>
        </div>

        <div class="bg-white p-4 rounded-3xl border border-gray-200 shadow-lg relative flex flex-col">
          <div class="flex items-center justify-between mb-4 px-3 pt-2">
            <p class="text-sm text-slate-500 font-medium">Arrastra las mesas para organizarlas en los diferentes
              ambientes.</p>
            <span
              class="text-xs font-black text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">Total
              Mesas: {{store.tables.filter(t => t.type === 'table').length}}</span>
          </div>

          <div v-if="isLoading"
            class="w-full min-h-[500px] bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-inner">
            <svg class="animate-spin h-10 w-10 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none"
              viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
              </path>
            </svg>
          </div>

          <div v-else
            class="w-full overflow-x-auto bg-slate-50 rounded-2xl border border-gray-200 shadow-inner cursor-crosshair">
            <div ref="canvasRef" @mousedown.self="handleCanvasClick" class="relative overflow-hidden select-none"
              style="width: 1200px; height: 800px; background-image: linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px); background-size: 25px 25px;">
              <div
                class="absolute top-0 left-0 w-[200px] h-[250px] bg-slate-200 border-[3px] border-slate-800 flex items-center justify-center pointer-events-none z-0">
                <span class="font-black text-slate-500 uppercase tracking-widest text-lg">Cocina</span>
              </div>

              <div
                class="absolute top-[250px] left-0 w-[150px] h-[300px] border-[3px] border-slate-800 flex items-center justify-center pointer-events-none z-0 bg-white">
                <span
                  class="font-black text-red-500 text-center uppercase tracking-widest leading-loose">Area<br>de<br>pedi<br>dos</span>
              </div>

              <div
                class="absolute top-[550px] left-0 w-[200px] h-[250px] border-[3px] border-slate-800 flex items-center justify-center pointer-events-none z-0 bg-white">
                <span class="font-black text-red-500 text-xl uppercase tracking-widest">Baños</span>
              </div>

              <div
                class="absolute top-0 left-[200px] w-[650px] h-[250px] flex flex-col items-center justify-center pointer-events-none z-0 bg-transparent">
                <span class="font-black text-emerald-400 text-3xl uppercase tracking-widest mt-10">Jardín</span>
                <span class="font-bold text-blue-400 text-sm uppercase tracking-widest mt-auto mb-4">Ventanas</span>
              </div>

              <div
                class="absolute top-[250px] left-[150px] w-[700px] h-[300px] bg-white border-[3px] border-slate-800 flex items-center justify-center pointer-events-none z-0">
                <span class="font-black text-slate-200 text-4xl uppercase tracking-widest">Área Principal</span>
              </div>

              <div
                class="absolute top-[380px] left-[830px] w-[40px] h-[40px] bg-white border-2 border-slate-800 flex items-center justify-center pointer-events-none z-10">
                <span class="font-black text-[8px] uppercase tracking-widest rotate-90 text-slate-800">Puerta</span>
              </div>

              <div
                class="absolute top-[50px] left-[850px] w-[300px] h-[700px] bg-emerald-50/20 border-[3px] border-slate-800 flex items-center justify-center pointer-events-none z-0">
                <span
                  class="font-black text-emerald-200 text-6xl uppercase tracking-widest rotate-90 opacity-50 absolute">Patio</span>
                <span class="font-black text-red-500 text-xl uppercase tracking-widest absolute right-8">Caja</span>
              </div>

              <div
                class="absolute top-[550px] left-[200px] w-[300px] h-[250px] bg-orange-50 border-[3px] border-slate-800 flex items-center justify-center pointer-events-none z-0">
                <span class="font-black text-orange-300 uppercase tracking-widest text-xl">Área Exclusiva</span>
              </div>

              <div
                class="absolute top-[550px] left-[500px] w-[350px] h-[250px] flex items-center justify-center pointer-events-none z-0 bg-transparent">
                <span class="font-black text-red-500 text-lg uppercase tracking-widest text-center">Acceso tienda
                  y<br>2do piso</span>
              </div>

              <div v-for="mesa in store.tables.filter(t => t.type === 'table')" :key="mesa.id"
                @mousedown="onDragStart($event, mesa)"
                class="absolute cursor-grab active:cursor-grabbing rounded-xl shadow-md border-2 transition-transform duration-100 ease-out flex flex-col items-center justify-center bg-slate-800"
                :class="[
                  mesa === draggingTable ? 'z-30 scale-110 border-orange-500 bg-orange-500 shadow-2xl shadow-orange-500/50' :
                    mesa === selectedTable ? 'z-20 ring-4 ring-blue-400 border-slate-900 scale-105' :
                      'z-10 hover:scale-105 border-slate-900 hover:bg-slate-700'
                ]" :style="{
                  width: '60px',
                  height: '60px',
                  left: `${mesa.pos_x || 0}px`,
                  top: `${mesa.pos_y || 0}px`
                }">
                <span class="text-2xl font-black text-white leading-none">{{ mesa.icon }}</span>
              </div>

            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'general'" class="max-w-2xl mx-auto">
        <h1 class="text-2xl font-bold text-slate-800 mb-6">Ajustes del Negocio</h1>

        <div class="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5">
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre del
              Restaurante</label>
            <input v-model="config.nombre" type="text"
              class="w-full bg-slate-50 border border-gray-200 text-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 font-bold transition">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">RUC</label>
              <input v-model="config.ruc" type="text"
                class="w-full bg-slate-50 border border-gray-200 text-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 font-bold transition">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Moneda Oficial</label>
              <select v-model="config.moneda"
                class="w-full bg-slate-50 border border-gray-200 text-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 font-bold transition appearance-none">
                <option>Soles (S/.)</option>
                <option>Dólares ($)</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Dirección del
              Local</label>
            <input v-model="config.direccion" type="text"
              class="w-full bg-slate-50 border border-gray-200 text-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 font-bold transition">
          </div>
          <div class="pt-4 border-t border-gray-100">
            <button @click="saveMockSettings"
              class="bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-6 rounded-xl transition shadow-md">Guardar
              Cambios</button>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'impresion'" class="max-w-2xl mx-auto">
        <h1 class="text-2xl font-bold text-slate-800 mb-6">Configuración de Tickets</h1>

        <div class="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Impresora de Caja
              (Boletas)</label>
            <select v-model="config.impresoraCaja"
              class="w-full bg-slate-50 border border-gray-200 text-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 font-bold transition">
              <option>Bluetooth - TM200</option>
              <option>USB - Epson POS</option>
              <option>Desactivado</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Impresora de Cocina
              (Comandas)</label>
            <select v-model="config.impresoraCocina"
              class="w-full bg-slate-50 border border-gray-200 text-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 font-bold transition">
              <option>Red - Cocina LAN</option>
              <option>Bluetooth - Cocina2</option>
              <option>Solo Pantalla (KDS)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mensaje al pie del
              Ticket de Cliente</label>
            <textarea v-model="config.ticketMsj" rows="3"
              class="w-full bg-slate-50 border border-gray-200 text-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 font-bold transition resize-none"></textarea>
            <p class="text-[10px] text-slate-400 mt-1">Ideal para poner la clave del WiFi o agradecer la visita.</p>
          </div>
          <div class="pt-4 border-t border-gray-100">
            <button @click="saveMockSettings"
              class="bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-6 rounded-xl transition shadow-md">Guardar
              Ajustes</button>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'avanzado'" class="max-w-2xl mx-auto">
        <h1 class="text-2xl font-bold text-slate-800 mb-6">Avanzado y KausaBot</h1>

        <div class="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <div class="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <p class="font-bold text-slate-800">Propina Automática (10%)</p>
              <p class="text-xs text-slate-500 mt-1">Sugiere automáticamente el 10% al cerrar la cuenta.</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="config.propinaAuto" class="sr-only peer">
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500">
              </div>
            </label>
          </div>

          <div class="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <p class="font-bold text-slate-800">PIN para Anulaciones</p>
              <p class="text-xs text-slate-500 mt-1">Requerir clave de Administrador para anular platos de cocina.</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="config.pinAnulacion" class="sr-only peer">
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500">
              </div>
            </label>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2"
                stroke="currentColor" class="w-4 h-4 text-indigo-500">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
              </svg>
              Personalidad de KausaBot AI
            </label>
            <select v-model="config.botPersonality"
              class="w-full bg-slate-50 border border-gray-200 text-indigo-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 font-bold transition appearance-none">
              <option>Amigable y Rápido</option>
              <option>Formal y Analítico</option>
              <option>Directo (Solo números)</option>
            </select>
          </div>

          <div class="pt-4 border-t border-gray-100">
            <button @click="saveMockSettings"
              class="bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-6 rounded-xl transition shadow-md">Guardar
              Ajustes</button>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'usuarios'" class="max-w-2xl mx-auto">
        <h1 class="text-2xl font-bold text-slate-800 mb-6">Seguridad y Accesos</h1>

        <div class="bg-indigo-600 rounded-2xl p-6 md:p-8 shadow-lg shadow-indigo-600/20 mb-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div class="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          
          <div class="relative z-10 text-center md:text-left text-white">
            <div class="flex items-center gap-2 mb-2 justify-center md:justify-start">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5 text-indigo-200">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              <h2 class="font-bold text-sm uppercase tracking-widest text-indigo-100">PIN de Seguridad (Turno {{ store.turnoActual }})</h2>
            </div>
            <p class="text-xs text-indigo-200 max-w-sm leading-relaxed">
              Díctale este número a los meseros y cocineros para que puedan usar KausaApp en sus celulares.
              <br><br>
              <span class="font-bold text-white bg-indigo-500/50 px-2 py-1 rounded">Expira y cambia automáticamente al "Cerrar Turno".</span>
            </p>
          </div>

          <div class="relative z-10 shrink-0 bg-white p-4 rounded-2xl shadow-inner border border-indigo-100 text-center min-w-[200px]">
            <span class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">PIN Actual</span>
            <span class="text-5xl font-black text-slate-800 tracking-widest font-mono">{{ store.activePin }}</span>
          </div>
        </div>

        <div class="flex justify-between items-center mb-4 mt-8">
          <h2 class="text-xl font-bold text-slate-800">Equipo de Trabajo</h2>
          <button class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition">NUEVO</button>
        </div>

        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div class="p-4 border-b border-gray-100 flex items-center justify-between hover:bg-gray-50 transition cursor-pointer">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-black">GN</div>
              <div>
                <p class="font-bold text-slate-800 leading-tight">Gloria Nora</p>
                <p class="text-xs text-slate-500 font-bold uppercase tracking-wider">Administrador</p>
              </div>
            </div>
            <span class="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px] font-black uppercase">Exento de PIN</span>
          </div>

          <div class="p-4 border-b border-gray-100 flex items-center justify-between hover:bg-gray-50 transition cursor-pointer">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center font-black">MS</div>
              <div>
                <p class="font-bold text-slate-800 leading-tight">Perfil: Meseros</p>
                <p class="text-xs text-slate-500 font-bold uppercase tracking-wider">Salón y Atención</p>
              </div>
            </div>
            <span class="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-[10px] font-black uppercase border border-indigo-200">Usa PIN Global</span>
          </div>

          <div class="p-4 flex items-center justify-between hover:bg-gray-50 transition cursor-pointer">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-black">CF</div>
              <div>
                <p class="font-bold text-slate-800 leading-tight">Perfil: Cocineros</p>
                <p class="text-xs text-slate-500 font-bold uppercase tracking-wider">Cocina</p>
              </div>
            </div>
            <span class="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-[10px] font-black uppercase border border-indigo-200">Usa PIN Global</span>
          </div>
        </div>
      </div>

    </main>

    <div v-if="showDeleteModal" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="showDeleteModal = false"></div>
      <div class="relative bg-white rounded-2xl border border-red-100 shadow-2xl w-full max-w-sm p-8 text-center">
        <div
          class="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 border-4 border-red-100 shadow-inner">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5"
            stroke="currentColor" class="w-10 h-10">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" />
          </svg>
        </div>
        <h3 class="text-xl font-bold text-slate-800 mb-2">¿Quitar Mesa?</h3>
        <p class="text-slate-500 mb-6 text-sm">Vas a eliminar la <span class="text-slate-800 font-bold">"{{
          selectedTable?.name }}"</span> del plano permanentemente.</p>
        <div class="flex gap-3">
          <button @click="showDeleteModal = false"
            class="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-slate-600 py-3 rounded-xl transition font-bold shadow-sm">Cancelar</button>
          <button @click="confirmDeleteTable"
            class="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl shadow-lg shadow-red-500/20 transition font-bold active:scale-95">Sí,
            quitar</button>
        </div>
      </div>
    </div>

    <Transition enter-active-class="transform ease-out duration-300 transition"
      enter-from-class="translate-y-10 opacity-0 sm:translate-y-0 sm:translate-x-10"
      enter-to-class="translate-y-0 opacity-100 sm:translate-x-0" leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="showToast"
        class="fixed bottom-5 right-5 z-[300] bg-white border-l-4 border-emerald-500 text-slate-800 px-6 py-4 rounded-lg shadow-xl flex items-center gap-4 max-w-sm border border-gray-100">
        <div class="text-emerald-500 bg-emerald-50 p-1.5 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor"
            class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <div>
          <h4 class="font-bold text-slate-800 text-sm">Aviso</h4>
          <p class="text-xs text-slate-500 mt-0.5">{{ toastMessage }}</p>
        </div>
      </div>
    </Transition>

  </div>
</template>