<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { usePosStore } from '../stores/pos'

// 🚀 MEMORIA BLINDADA (Usamos objetos planos para máxima compatibilidad)
const cachedOrders = useState('kitchen-cache', () => [])
const processingIds = useState('kitchen-processing', () => ({}))
const knownOrderIds = useState('kitchen-known-ids', () => ({}))
const isInitialLoad = ref(true)

const orders = ref(cachedOrders.value || [])
const timer = ref(null)
const store = usePosStore()

const playSound = () => {
  const audio = new Audio('/ding.mp3')
  audio.play().catch(e => console.log('Interacción requerida para audio'))
}

onMounted(async () => {
  await store.loadProducts()

  // Carga inicial
  await loadKitchenOrders()
  isInitialLoad.value = false // Terminamos la carga inicial, a partir de ahora suena la campana

  timer.value = setInterval(loadKitchenOrders, 2000)
})

onUnmounted(() => {
  clearInterval(timer.value)
})

async function loadKitchenOrders() {
  try {
    const data = await $fetch('/api/orders/kitchen')

    // Filtramos los que el chef está procesando o rechazó
    const visibleOrders = data.filter(order =>
      order.status !== 'Rechazado' && !processingIds.value[order.id]
    )

    let soundTriggered = false

    visibleOrders.forEach(order => {
      // Si el ID no está en nuestra memoria de conocidos
      if (!knownOrderIds.value[order.id]) {
        // Solo hacemos sonar si NO es la primerísima carga de la página
        if (!isInitialLoad.value) {
          soundTriggered = true
        }
        // Marcamos como conocido para SIEMPRE
        knownOrderIds.value[order.id] = true
      }
    })

    if (soundTriggered) {
      playSound()
    }

    orders.value = visibleOrders
    cachedOrders.value = visibleOrders
    store.globalAlerts.kitchenCount = visibleOrders.length
  } catch (e) {
    console.error('Error buscando comandas', e)
  }
}

// 🚀 FUNCIÓN INSTANTÁNEA: Sin demoras, directo al grano
async function markAsReady(orderId) {
  try {
    processingIds.value[orderId] = true
    // Al quitarlo del array instantáneamente, Vue dispara el efecto visual
    orders.value = orders.value.filter(o => o.id !== orderId)
    cachedOrders.value = orders.value
    store.decrementarAlertaCocina()

    // El servidor trabaja en segundo plano sin interrumpir al usuario
    await $fetch('/api/orders/complete', {
      method: 'POST',
      body: { id: orderId }
    })
  } catch (e) {
    delete processingIds.value[orderId]
    loadKitchenOrders()
  }
}

// LÓGICA DE CANCELACIÓN DEL CHEF
const showCancelModal = ref(false)
const orderToCancel = ref(null)
const isCancelling = ref(false)

function askToCancel(order) {
  orderToCancel.value = order
  showCancelModal.value = true
}

function closeCancelModal() {
  showCancelModal.value = false
  orderToCancel.value = null
}

function confirmCancelOrder() {
  if (!orderToCancel.value) return

  const idToRemove = orderToCancel.value.id

  processingIds.value[idToRemove] = true

  closeCancelModal()
  isCancelling.value = false
  orderToCancel.value = null
  orders.value = orders.value.filter(o => o.id !== idToRemove)
  cachedOrders.value = orders.value
  store.decrementarAlertaCocina()

  $fetch('/api/orders/reject', {
    method: 'POST',
    body: { id: idToRemove }
  }).catch(error => {
    console.error('Error de red al rechazar:', error)
    alert('Hubo un problema de conexión al rechazar el pedido.')
    delete processingIds.value[idToRemove]
    loadKitchenOrders()
  })
}

function getOrderItems(description) {
  if (!description) return []

  const rawItems = description.split(/,\s*(?![^\[]*\])/)

  return rawItems.map(rawItem => {
    const match = rawItem.match(/(.*?)\[(.*?)\]/)

    if (match) {
      const mainTitle = match[1].trim()
      const subItemsStr = match[2]

      const subItems = subItemsStr.split(',').map(s => s.trim()).filter(Boolean)
      const isEjecutivo = mainTitle.toLowerCase().includes('ejecutivo')

      return {
        isCombo: true,
        text: mainTitle,
        isEjecutivo: isEjecutivo,
        subItems: subItems.map(sub => {
          const product = store.products.find(p => p.name.toLowerCase() === sub.toLowerCase())
          return {
            text: sub,
            category: product ? product.category : 'Desconocido',
            isSin: sub.toLowerCase().startsWith('sin ')
          }
        })
      }
    } else {
      const cleanName = rawItem.replace(/^\d+x\s/, '').trim()
      const product = store.products.find(p => p.name.toLowerCase() === cleanName.toLowerCase())
      return {
        isCombo: false,
        text: rawItem,
        category: product ? product.category : 'Otro'
      }
    }
  })
}

function getTicketColor(description) {
  const items = getOrderItems(description)
  let hasComida = false
  let hasPostre = false
  let hasBebida = false

  items.forEach(item => {
    if (item.isCombo) {
      hasComida = true
    } else {
      if (item.category === 'Comida') hasComida = true
      if (item.category === 'Postre') hasPostre = true
      if (item.category === 'Bebida') hasBebida = true
    }
  })

  if (hasComida) return 'comida'
  if (hasPostre) return 'postre'
  if (hasBebida) return 'bebida'
  return 'otro'
}
</script>

<template>
  <div class="min-h-[calc(100vh-80px)] bg-gray-50 p-4 md:p-6 relative overflow-hidden">
    <header class="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm relative z-10">
      <div class="flex items-center gap-3">
        <div class="bg-red-50 text-red-500 p-2.5 rounded-xl border border-red-100 hidden md:block">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-7 h-7">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
        </div>
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-800">Monitor de Cocina</h1>
          <div class="flex items-center justify-center md:justify-start gap-2 mt-1">
            <span class="relative flex h-3 w-3">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <p class="text-slate-500 text-[10px] md:text-xs font-mono uppercase">En vivo</p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-4 w-full md:w-auto">
        <div v-if="orders.length > 0"
          class="w-full md:w-auto flex items-center justify-center gap-2 bg-red-50 text-red-600 px-5 py-2.5 rounded-xl font-bold border border-red-200 shadow-sm text-sm md:text-base">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 animate-pulse">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" />
          </svg>
          {{ orders.length }} Pendientes
        </div>
        <div v-else
          class="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 px-5 py-2.5 rounded-xl font-bold border border-emerald-200 text-sm md:text-base">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          Todo limpio
        </div>
      </div>
    </header>

    <TransitionGroup name="kitchen-grid" type="transition" tag="div" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 relative z-0 w-full">
      
      <div v-for="order in orders" :key="order.id"
        class="bg-white rounded-2xl shadow-sm border-2 overflow-hidden flex flex-col hover:shadow-lg transition-all duration-300 relative group"
        :class="{
          'border-red-500 shadow-red-500/30 scale-[1.02] z-10': order.status === 'Cancelado',
          'border-teal-600 shadow-teal-600/20': order.status !== 'Cancelado' && order.table?.toLowerCase().includes('llevar'),
          'border-orange-500 animate-border-pulse-orange shadow-orange-500/20': order.status !== 'Cancelado' && !order.table?.toLowerCase().includes('llevar') && getTicketColor(order.description) === 'comida',
          'border-blue-500 shadow-blue-500/20': order.status !== 'Cancelado' && !order.table?.toLowerCase().includes('llevar') && getTicketColor(order.description) === 'bebida',
          'border-pink-500 shadow-pink-500/20': order.status !== 'Cancelado' && !order.table?.toLowerCase().includes('llevar') && getTicketColor(order.description) === 'postre',
          'border-slate-400 shadow-slate-400/20': order.status !== 'Cancelado' && !order.table?.toLowerCase().includes('llevar') && getTicketColor(order.description) === 'otro'
        }">
        
        <div v-if="order.status === 'Cancelado'" class="bg-red-500 text-white font-black text-center py-2 text-sm uppercase tracking-widest flex items-center justify-center gap-2 animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" /></svg>
          ANULADO POR SALÓN
        </div>

        <div class="p-3 md:p-4 border-b flex flex-col gap-3 md:gap-4" :class="{
          'bg-red-50 border-red-200': order.status === 'Cancelado',
          'bg-teal-50 border-teal-200': order.status !== 'Cancelado' && order.table?.toLowerCase().includes('llevar'),
          'bg-orange-50 border-orange-200': order.status !== 'Cancelado' && !order.table?.toLowerCase().includes('llevar') && getTicketColor(order.description) === 'comida',
          'bg-blue-50 border-blue-200': order.status !== 'Cancelado' && !order.table?.toLowerCase().includes('llevar') && getTicketColor(order.description) === 'bebida',
          'bg-pink-50 border-pink-200': order.status !== 'Cancelado' && !order.table?.toLowerCase().includes('llevar') && getTicketColor(order.description) === 'postre',
          'bg-slate-50 border-slate-200': order.status !== 'Cancelado' && !order.table?.toLowerCase().includes('llevar') && getTicketColor(order.description) === 'otro'
        }">
          <div class="flex justify-between items-start">
            <div class="flex items-center gap-2 md:gap-3">
              <div class="p-2 md:p-2.5 bg-white rounded-xl shadow-sm border border-black/5 flex items-center justify-center">
                <svg v-if="order.table?.toLowerCase().includes('llevar')" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5 md:w-6 md:h-6 text-teal-600"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
                <svg v-else-if="getTicketColor(order.description) === 'bebida'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5 md:w-6 md:h-6 text-blue-600"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5 md:w-6 md:h-6 text-orange-500"><path stroke-linecap="round" stroke-linejoin="round" d="M6.082 18h11.836l1.264-12A1.125 1.125 0 0 1 20.302 4.5H3.698a1.125 1.125 0 0 1 1.12 1.243l1.264 12ZM8.25 10.5h7.5M8.25 14.25h7.5M12 21.75V18M12 4.5v-1.5M12 4.5H9.75M12 4.5h2.25" /></svg>
              </div>
              <div>
                <span class="block text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500">Orden #</span>
                <span class="text-2xl md:text-3xl font-black text-slate-800 leading-none" :class="{ 'text-red-600 line-through opacity-80': order.status === 'Cancelado' }">
                  {{ order.dailyTicket || order.id }}
                </span>
              </div>
            </div>

            <div class="flex flex-col items-end gap-1">
              <button v-if="order.status !== 'Cancelado'" @click="askToCancel(order)" class="text-slate-400 hover:text-red-500 active:bg-red-100 active:text-red-600 hover:bg-red-50 rounded-lg p-1.5 transition-all -mr-1" title="Rechazar Pedido">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
              <div class="flex items-center gap-1 text-slate-500 bg-white/60 px-1.5 py-0.5 md:px-2 md:py-1 rounded border border-black/5 shadow-sm" :class="{ 'text-red-500 bg-red-100 border-red-200': order.status === 'Cancelado' }">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3 md:w-3.5 h-3 md:h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                <span class="text-[10px] md:text-[11px] font-mono font-black">
                  {{ new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
                </span>
              </div>
            </div>
          </div>

          <div class="w-full bg-white px-3 md:px-4 py-2 md:py-3 rounded-xl shadow-sm border flex items-center justify-center text-center mt-1"
            :class="{
              'border-teal-300 bg-teal-50/50': order.table?.toLowerCase().includes('llevar'),
              'border-orange-300': !order.table?.toLowerCase().includes('llevar') && getTicketColor(order.description) === 'comida',
              'border-blue-300': !order.table?.toLowerCase().includes('llevar') && getTicketColor(order.description) === 'bebida',
              'border-black/10': order.status === 'Cancelado'
            }">
            <span class="text-lg md:text-xl font-black leading-tight break-words w-full" :class="{
              'text-teal-900 text-lg md:text-[22px]': order.table?.toLowerCase().includes('llevar'),
              'text-orange-950': !order.table?.toLowerCase().includes('llevar') && getTicketColor(order.description) === 'comida',
              'text-blue-950': !order.table?.toLowerCase().includes('llevar') && getTicketColor(order.description) === 'bebida',
              'text-slate-800': order.status === 'Cancelado'
            }">
              {{ order.table || 'Caja' }}
            </span>
          </div>
        </div>

        <div class="p-3 md:p-4 flex-1 bg-white" :class="{ 'opacity-50 grayscale pointer-events-none': order.status === 'Cancelado' }">
          <ul class="space-y-2 md:space-y-3 mb-2">
            <li v-for="(item, idx) in getOrderItems(order.description)" :key="idx">
              <div v-if="item.isCombo" class="flex flex-col gap-2 md:gap-3 p-3 md:p-4 rounded-xl border transition-all shadow-sm" :class="item.isEjecutivo ? 'bg-indigo-50/40 border-indigo-200' : 'bg-orange-50/40 border-orange-200'">
                <div class="font-black flex items-center gap-2 text-sm md:text-base" :class="item.isEjecutivo ? 'text-indigo-800' : 'text-orange-800'">
                  <span class="relative flex h-2.5 w-2.5 md:h-3 md:w-3">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" :class="item.isEjecutivo ? 'bg-indigo-400' : 'bg-orange-400'"></span>
                    <span class="relative inline-flex rounded-full h-2.5 w-2.5 md:h-3 md:w-3" :class="item.isEjecutivo ? 'bg-indigo-500' : 'bg-orange-500'"></span>
                  </span>
                  {{ item.text }}
                </div>
                <ul class="pl-3 md:pl-4 space-y-1.5 md:space-y-2 border-l-2 ml-1" :class="item.isEjecutivo ? 'border-indigo-300' : 'border-orange-300'">
                  <li v-for="(sub, sIdx) in item.subItems" :key="sIdx" class="text-xs md:text-sm font-bold flex items-center gap-2 text-slate-700">
                    <span v-if="!sub.isSin" class="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full" :class="item.isEjecutivo ? 'bg-indigo-500' : 'bg-orange-500'"></span>
                    <span v-else class="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-slate-300"></span>
                    <span :class="sub.isSin ? 'text-slate-400 italic font-medium' : 'text-slate-800'">{{ sub.text }}</span>
                    <span v-if="sub.category === 'Bebida' && !sub.isSin" class="ml-auto text-[9px] md:text-[10px] font-black uppercase tracking-widest bg-blue-100 text-blue-700 px-1.5 md:px-2 py-0.5 md:py-1 rounded-md border border-blue-200">Barra</span>
                  </li>
                </ul>
              </div>
              <div v-else class="flex items-center gap-2 md:gap-3 p-2.5 md:p-3 rounded-xl text-xs md:text-sm font-bold border transition-all"
                :class="{
                  'bg-orange-50 text-orange-900 border-orange-300 shadow-sm shadow-orange-500/20': item.category === 'Comida',
                  'bg-blue-50 text-blue-700 border-blue-200 opacity-80': item.category === 'Bebida',
                  'bg-pink-50 text-pink-800 border-pink-200': item.category === 'Postre',
                  'bg-gray-50 text-slate-700 border-gray-200': !['Comida', 'Bebida', 'Postre'].includes(item.category)
                }">
                <div class="relative bg-white p-1 md:p-1.5 rounded-lg shadow-sm border border-black/5 flex-shrink-0">
                  <span v-if="item.category === 'Comida'" class="absolute inset-0 rounded-lg bg-orange-500 opacity-40 animate-ping"></span>
                  <svg v-if="item.category === 'Comida'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="relative w-3.5 h-3.5 md:w-4 md:h-4 text-orange-600"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" /></svg>
                  <svg v-else-if="item.category === 'Bebida'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-500"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                  <svg v-else-if="item.category === 'Postre'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5 md:w-4 md:h-4 text-pink-500"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-500"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M6 7.5h.008v.008H6V7.5Z" /></svg>
                </div>
                <span class="text-sm md:text-base leading-snug">{{ item.text }}</span>
                <span v-if="item.category === 'Bebida'" class="ml-auto text-[9px] md:text-[10px] font-black uppercase tracking-widest bg-blue-100 text-blue-700 px-1.5 md:px-2 py-0.5 md:py-1 rounded-md border border-blue-200">Barra</span>
              </div>
            </li>
          </ul>
        </div>

        <div class="p-3 md:p-4 bg-slate-50 border-t border-slate-200 mt-auto z-10 relative">
          <button v-if="order.status !== 'Cancelado'" @click="markAsReady(order.id)"
            class="w-full border-2 font-bold py-2.5 md:py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm text-sm md:text-base transition-all active:scale-95 active:shadow-inner focus:outline-none"
            :class="{
              'bg-white border-teal-500 text-teal-600 hover:bg-teal-500 hover:text-white': order.table?.toLowerCase().includes('llevar'),
              'bg-white border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white': !order.table?.toLowerCase().includes('llevar')
            }">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4 md:w-5 md:h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            MARCAR LISTO
          </button>
          <button v-else @click="markAsReady(order.id)"
            class="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 md:py-3 rounded-xl transition flex items-center justify-center gap-2 active:scale-95 shadow-md shadow-red-500/30 text-sm md:text-base">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4 md:w-5 md:h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            ENTERADO (QUITAR)
          </button>
        </div>
      </div>
    </TransitionGroup>

    <div v-if="orders.length === 0" class="flex flex-col items-center justify-center py-16 md:py-20 text-slate-400 opacity-80 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" class="w-24 h-24 md:w-32 md:h-32 mb-4 text-slate-300"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" /></svg>
      <h2 class="text-2xl md:text-3xl font-bold text-slate-500">Sin platos pendientes</h2>
      <p class="text-sm md:text-base">La cocina está tranquila... por ahora.</p>
    </div>

    <div v-if="showCancelModal" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" @click="!isCancelling && closeCancelModal()"></div>
      <div class="relative bg-white rounded-3xl border border-red-100 shadow-2xl max-w-sm w-full p-6 md:p-8 text-center transform transition-all">
        <div class="w-16 h-16 md:w-20 md:h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 text-red-500 shadow-inner border-4 border-red-100">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-8 h-8 md:w-10 md:h-10"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" /></svg>
        </div>
        <h3 class="text-xl md:text-2xl font-black text-slate-800 mb-2">¿Eliminar Orden #{{ orderToCancel?.dailyTicket || orderToCancel?.id }}?</h3>
        <p class="text-slate-500 mb-6 text-xs md:text-sm">Estás a punto de rechazar el pedido de la <strong class="text-slate-700">{{ orderToCancel?.table || 'Caja' }}</strong>. Desaparecerá de la pantalla.</p>
        <div class="flex gap-3">
          <button @click="closeCancelModal" :disabled="isCancelling" class="flex-1 bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 font-bold py-2.5 md:py-3 rounded-xl transition shadow-sm text-sm md:text-base">Atrás</button>
          <button @click="confirmCancelOrder" :disabled="isCancelling" class="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 md:py-3 rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center text-sm md:text-base">
            <span v-if="!isCancelling">Sí, Eliminar</span>
            <svg v-else class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes border-pulse-orange {
  0%, 100% { border-color: rgb(249 115 22); }
  50% { border-color: rgba(249, 115, 22, 0.3); }
}

.animate-border-pulse-orange {
  animation: border-pulse-orange 3.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* =========================================
   🪄 LA MAGIA DEL GRID: RÁPIDO Y SEGURO
   ========================================= */

/* Movimiento general: cuando las tarjetas se reacomodan */
.kitchen-grid-move {
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Tiempos de entrada y salida */
.kitchen-grid-enter-active {
  transition: all 0.35s ease-out;
}

.kitchen-grid-leave-active {
  transition: all 0.35s ease-out;
  position: absolute; /* 🚀 MAGIA: Libera el hueco en el grid al instante */
  z-index: 0;
}

/* Cuando un pedido ENTRA (Bono: aparece suavecito) */
.kitchen-grid-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}

/* 🚀 Cuando el chef le da "MARCAR LISTO" (El efecto humo) */
.kitchen-grid-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(-40px); /* Vuela hacia arriba y se encoge */
  filter: blur(4px) brightness(1.2); /* Efecto desvanecimiento/brillo */
}
</style>