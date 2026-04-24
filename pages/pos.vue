<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePosStore } from '../stores/pos'
import { onBeforeRouteLeave } from 'vue-router'

const store = usePosStore()
const router = useRouter()

const showMobileCart = ref(false)

const searchQuery = ref('')
const selectedCategory = ref('Todo')
const filterCategories = ['Todo', 'Menú del Día', 'Comida', 'Bebidas', 'Postre']

const filteredProducts = computed(() => {
  let filtrados = store.products

  if (selectedCategory.value !== 'Todo') {
    const categoryToMatch = selectedCategory.value === 'Bebidas' ? 'Bebida' : selectedCategory.value
    filtrados = filtrados.filter(p => p.category === categoryToMatch)
  }

  if (searchQuery.value.trim() !== '') {
    const quitarTildes = (str) => {
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    }

    const query = quitarTildes(searchQuery.value.trim())

    filtrados = filtrados.filter(p => {
      const nombreLimpio = quitarTildes(p.name)
      return nombreLimpio.includes(query)
    })
  }

  return filtrados
})

const activeTab = ref('cart')
const activeOrders = ref([])
const processingIds = ref({})

async function loadActiveOrders() {
  try {
    const data = await $fetch(`/api/orders/pos-active?_t=${Date.now()}`)
    activeOrders.value = data
      .filter(order => !processingIds.value[order.id])
      .reverse()
  } catch (error) {
    console.error('Error cargando pedidos enviados', error)
  }
}

const showTakeawayModal = ref(false)
const takeawayCustomer = ref('')
const isTakeawayActive = ref(false)

function openTakeawayModal() {
  showTakeawayModal.value = true
  takeawayCustomer.value = ''
}

function confirmTakeaway() {
  if (!takeawayCustomer.value.trim()) return
  isTakeawayActive.value = true
  showTakeawayModal.value = false
  mesaSeleccionada.value = null
}

function cancelTakeaway() {
  isTakeawayActive.value = false
  takeawayCustomer.value = ''
}

const mesaSeleccionada = ref(null)
const showTableModal = ref(false)

function seleccionarMesa(mesa) {
  mesaSeleccionada.value = mesa
  showTableModal.value = false
}

const canCheckout = computed(() => {
  return store.cart.length > 0 && (mesaSeleccionada.value !== null || isTakeawayActive.value)
})

const showComboModal = ref(false)
const activeCombo = ref(null)
const comboSelections = ref({ entrada: '', segundo: '', bebida: '', postre: '' })

function getFirstAvailable(items, agotados) {
  if (!items || items.length === 0) return ''
  const agotadosList = agotados || []
  const available = items.find(item => !agotadosList.includes(item))
  return available || ''
}

function toggleSelection(category, value) {
  const agotadosList = activeCombo.value?.options?.agotados || []
  if (agotadosList.includes(value)) return

  if (comboSelections.value[category] === value) {
    comboSelections.value[category] = ''
  } else {
    comboSelections.value[category] = value
  }
}

const cartPulse = ref(false)

function triggerCartAnimation() {
  cartPulse.value = false
  setTimeout(() => {
    cartPulse.value = true
    setTimeout(() => {
      cartPulse.value = false
    }, 400) 
  }, 10)
}

function handleProductClick(product) {
  if (product.type === 'combo') {
    activeCombo.value = product
    const agotados = product.options?.agotados || []

    comboSelections.value = {
      entrada: getFirstAvailable(product.options?.entradas, agotados),
      segundo: getFirstAvailable(product.options?.segundos, agotados),
      bebida: getFirstAvailable(product.options?.bebidas, agotados),
      postre: getFirstAvailable(product.options?.postres, agotados)
    }
    showComboModal.value = true
  } else {
    store.addToCart(product)
    activeTab.value = 'cart'
    triggerCartAnimation()
  }
}

function addComboToCart() {
  const selecciones = [
    comboSelections.value.entrada || 'Sin entrada',
    comboSelections.value.segundo || 'Sin segundo',
    comboSelections.value.bebida || 'Sin bebida',
    comboSelections.value.postre || 'Sin postre'
  ].join(', ')

  const finalName = `${activeCombo.value.name} [${selecciones}]`
  const uniqueId = `combo-${Date.now()}`

  store.addToCart({
    ...activeCombo.value,
    id: uniqueId,
    name: finalName
  })
  showComboModal.value = false
  activeTab.value = 'cart'
  triggerCartAnimation()
}

let syncInterval = null
let ordersInterval = null 
const isSyncingCatalog = ref(false)

async function syncCatalog() {
  isSyncingCatalog.value = true
  try {
    const [productosNormales, todayMenu] = await Promise.all([
      $fetch('/api/products'),
      $fetch('/api/menu/today').catch(() => null)
    ])

    let listaFinal = productosNormales || []

    if (todayMenu) {
      if (todayMenu.ejecutivo) {
        listaFinal.unshift({ id: 'menu-ejecutivo', name: todayMenu.ejecutivo.name, price: todayMenu.ejecutivo.price, category: 'Menú del Día', image: '', type: 'combo', options: todayMenu.ejecutivo })
      }
      if (todayMenu.clasico) {
        listaFinal.unshift({ id: 'menu-clasico', name: todayMenu.clasico.name, price: todayMenu.clasico.price, category: 'Menú del Día', image: '', type: 'combo', options: todayMenu.clasico })
      }
    }

    store.products = listaFinal
    store.loadTables()

  } catch (error) {
    console.error('Error sincronizando catalogo', error)
  } finally {
    setTimeout(() => {
      isSyncingCatalog.value = false
    }, 500)
  }
}

onMounted(() => {
  syncCatalog()
  loadActiveOrders()
  
  syncInterval = setInterval(syncCatalog, 15000)
  ordersInterval = setInterval(loadActiveOrders, 5000) 
})

onUnmounted(() => {
  if (syncInterval) clearInterval(syncInterval)
  if (ordersInterval) clearInterval(ordersInterval) 
})

const showModal = ref(false)
const lastOrder = ref(null)

async function handleCheckout() {
  if (!canCheckout.value) return

  const orderDestination = isTakeawayActive.value
    ? `Para Llevar - ${takeawayCustomer.value.toUpperCase()}`
    : (mesaSeleccionada.value ? mesaSeleccionada.value.name : 'Caja')

  const order = await store.checkout(orderDestination)
  if (order) {
    lastOrder.value = order
    showModal.value = true
    showMobileCart.value = false

    mesaSeleccionada.value = null
    isTakeawayActive.value = false
    takeawayCustomer.value = ''
    
    activeOrders.value.unshift(order)
    setTimeout(() => loadActiveOrders(), 1500)
  }
}

function closeModal() {
  showModal.value = false
}

async function handleMarcarEntregado(order) {
  try {
    processingIds.value[order.id] = true
    activeOrders.value = activeOrders.value.filter(o => o.id !== order.id)
    await store.marcarComoEntregado(order.id)
  } catch (error) {
    console.error('Error al entregar', error)
    delete processingIds.value[order.id] 
    loadActiveOrders()
  }
}

function handleCancelCart() {
  store.clearCart()
  mesaSeleccionada.value = null
  isTakeawayActive.value = false
  takeawayCustomer.value = ''
  showMobileCart.value = false
}

const showPosCancelModal = ref(false)
const orderToCancelPos = ref(null)
const isCancellingPos = ref(false)

function askToCancelPos(order) {
  orderToCancelPos.value = order
  showPosCancelModal.value = true
}

function confirmCancelPos() {
  if (!orderToCancelPos.value) return

  const targetId = orderToCancelPos.value.id
  showPosCancelModal.value = false
  activeOrders.value = activeOrders.value.filter(o => o.id !== targetId)

  $fetch('/api/orders/cancel', {
    method: 'POST',
    body: { id: targetId }
  }).catch(error => {
    console.error("Error anulando en BD:", error)
    alert('Uy, hubo un problema de red. Verificando con cocina...')
    loadActiveOrders()
  })
}
onBeforeRouteLeave((to, from) => {
  // Si el panel inferior (Carrito/Cocina/Listos) está abierto...
  if (showMobileCart.value) {
    showMobileCart.value = false // 1. Lo cerramos
    return false // 2. Cancelamos la navegación para que no salga del POS
  }
  
  // Si el panel ya estaba cerrado, dejamos que la navegación fluya normal
  return true 
})

</script>

<template>
  <div class="flex h-full lg:gap-6 relative overflow-hidden lg:overflow-visible">
    <div class="flex-1 flex flex-col overflow-hidden pb-24 lg:pb-0 w-full">

      <header class="mb-6 flex flex-col gap-4">
        <div class="relative shadow-sm flex items-center">
          <span class="absolute left-4 text-slate-400 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2"
              stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </span>

          <input v-model="searchQuery" type="text" placeholder="Buscar producto..."
            class="w-full bg-white text-slate-700 pl-11 pr-12 py-4 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition">

          <button @click="syncCatalog"
            class="absolute right-3 p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
            title="Sincronizar Catalogo">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5"
              stroke="currentColor" class="w-5 h-5" :class="{ 'animate-spin text-orange-500': isSyncingCatalog }">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>

        <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          <button v-for="cat in filterCategories" :key="cat" @click="selectedCategory = cat"
            class="px-5 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap"
            :class="selectedCategory === cat ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-white text-slate-600 border border-gray-200 shadow-sm'">
            {{ cat }}
          </button>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto pr-2 pb-4">
        <div v-if="filteredProducts.length === 0"
          class="flex flex-col items-center justify-center py-16 text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
            stroke="currentColor" class="w-16 h-16 mb-4 opacity-50">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <p class="font-bold text-lg text-slate-500">No se encontraron productos</p>
          <p class="text-sm">Prueba con otro termino de busqueda o categoria.</p>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
          <div v-for="product in filteredProducts" :key="product.id" @click="handleProductClick(product)"
            class="bg-white rounded-2xl p-0 cursor-pointer border border-gray-200 shadow-sm group relative overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_15px_30px_-5px_rgba(249,115,22,0.3)] hover:border-orange-300">
            <div v-if="product.type === 'combo'"
              class="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md z-10 shadow-sm flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5"
                stroke="currentColor" class="w-3 h-3">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
              HOY
            </div>

            <div
              class="aspect-[4/3] overflow-hidden bg-slate-50 relative flex items-center justify-center w-full border-b border-gray-100">
              <img v-if="product.image" :src="product.image" alt="Foto"
                class="w-full h-full object-cover group-hover:scale-110 transition duration-500">

              <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                stroke="currentColor" class="w-12 h-12 text-slate-300 group-hover:scale-110 transition duration-500">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>

              <div
                class="absolute bottom-0 right-0 bg-slate-800 text-white font-bold px-3 py-1.5 rounded-tl-xl shadow-lg text-sm transition-colors duration-300 group-hover:bg-orange-500">
                S/. {{ Number(product.price).toFixed(2) }}
              </div>
            </div>

            <div class="p-3 flex-1 flex flex-col justify-between bg-white">
              <h3
                class="font-bold text-slate-800 leading-tight text-sm mb-2 line-clamp-2 transition-colors duration-300 group-hover:text-orange-600">
                {{ product.name }}</h3>
              <div>
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-gray-200 group-hover:border-orange-200 transition-colors duration-300">
                  {{ product.category }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white border-gray-200 flex flex-col z-[60] overflow-hidden transition-transform duration-300 ease-in-out
             fixed inset-x-0 bottom-0 h-[85vh] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)]
             lg:relative lg:w-96 lg:h-auto lg:rounded-2xl lg:border lg:shadow-xl lg:translate-y-0 lg:z-20 lg:!flex"
      :class="showMobileCart ? 'translate-y-0' : 'translate-y-full'">
      
      <div class="lg:hidden flex justify-center items-center py-3 bg-gray-50 border-b border-gray-200 active:bg-gray-100"
        @click="showMobileCart = false">
        <div class="w-12 h-1.5 bg-gray-300 rounded-full cursor-pointer"></div>
      </div>

      <div class="flex border-b border-gray-200 bg-gray-50/80 text-[11px] sm:text-xs">
        <button @click="activeTab = 'cart'"
          class="flex-[1.2] py-4 font-bold transition-colors relative flex items-center justify-center gap-1"
          :class="activeTab === 'cart' ? 'bg-white text-slate-800' : 'text-slate-400 hover:text-slate-600'">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5 sm:w-4 sm:h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z" />
          </svg> Nueva
          <div v-if="activeTab === 'cart'" class="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500"></div>
        </button>
        
        <button @click="activeTab = 'sent'; loadActiveOrders()"
          class="flex-1 py-4 font-bold transition-colors relative flex items-center justify-center gap-1"
          :class="activeTab === 'sent' ? 'bg-white text-orange-600' : 'text-slate-400 hover:text-slate-600'">
          En Cocina
          <span v-if="activeOrders.filter(o => o.status === 'Pendiente').length > 0"
            class="bg-orange-100 text-orange-600 px-1.5 rounded-full font-black border border-orange-200">
            {{ activeOrders.filter(o => o.status === 'Pendiente').length }}
          </span>
        <div v-if="activeTab === 'sent'" class="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500"></div>
          
        </button>

        <button @click="activeTab = 'ready'; loadActiveOrders()"
          class="flex-1 py-4 font-bold transition-colors relative flex items-center justify-center gap-1"
          :class="activeTab === 'ready' ? 'bg-white text-emerald-600' : 'text-slate-400 hover:text-slate-600'">
          Listos
          <span v-if="activeOrders.filter(o => o.status === 'Listo').length > 0"
            class="bg-emerald-500 text-white px-1.5 rounded-full font-black animate-pulse shadow-sm shadow-emerald-500/50">
            {{ activeOrders.filter(o => o.status === 'Listo').length }}
          </span>
          <div v-if="activeTab === 'ready'" class="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500"></div>
        </button>
      </div>

      <div v-if="activeTab === 'cart'" class="flex-1 flex flex-col overflow-hidden bg-white">
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <div v-if="store.cart.length === 0" class="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" class="w-20 h-20 mb-4 text-slate-300">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            <p class="font-medium text-lg">El carrito está vacío</p>
          </div>

          <div v-for="item in store.cart" :key="item.id"
            class="flex justify-between items-center group bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:border-orange-200 transition">
            <div class="flex items-center gap-3">
              <img :src="item.image || 'https://placehold.co/100?text=?'"
                class="w-12 h-12 rounded-lg object-cover bg-gray-100 border border-gray-200">
              <div class="max-w-[120px] sm:max-w-[160px]">
                <p class="text-sm font-bold text-slate-800 line-clamp-2 leading-tight" :title="item.name">{{ item.name }}</p>
                <p class="text-xs text-slate-500 font-mono mt-0.5">S/. {{ item.price }} x {{ item.quantity }}</p>
              </div>
            </div>

            <div class="flex items-center gap-2 bg-gray-100 rounded-lg p-1 shrink-0">
              <button @click.stop="store.decreaseQuantity(item.id); triggerCartAnimation()" class="w-7 h-7 rounded-md bg-white text-slate-600 shadow-sm hover:text-red-500 hover:bg-red-50 transition font-bold">-</button>
              <span class="text-slate-800 font-bold w-4 text-center text-sm">{{ item.quantity }}</span>
              <button @click.stop="store.addToCart(item); triggerCartAnimation()" class="w-7 h-7 rounded-md bg-white text-slate-600 shadow-sm hover:text-emerald-500 hover:bg-emerald-50 transition font-bold">+</button>
            </div>
            
          </div>
        </div>

        <div class="p-6 bg-gray-50 border-t border-gray-200">
          <div class="flex justify-between mb-2 text-sm text-slate-500 font-medium">
            <span>Subtotal</span><span>S/. {{ store.totalPrice.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between mb-4 text-2xl font-bold text-slate-800">
            <span>Total</span>
            <span class="text-emerald-600 transition-all duration-300" :class="{ 'text-flash': cartPulse }">
              S/. {{ store.totalPrice.toFixed(2) }}
            </span>
          </div>

          <div class="mb-3">
            <button v-if="!isTakeawayActive" @click="openTakeawayModal" class="w-full bg-slate-800 hover:bg-slate-900 text-white px-4 py-3 rounded-xl font-bold transition-colors text-sm shadow-sm">
              Nuevo Pedido: Para Llevar
            </button>
            <div v-else class="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center justify-between shadow-sm">
              <div>
                <span class="text-blue-600 font-bold block text-[10px] uppercase tracking-wider">Modo Activo</span>
                <span class="text-slate-800 font-bold text-sm">Llevar: {{ takeawayCustomer }}</span>
              </div>
              <button @click="cancelTakeaway" class="text-slate-500 hover:text-red-600 font-bold px-3 py-1.5 border border-slate-200 hover:border-red-200 bg-white rounded-lg transition-colors text-xs">Cancelar</button>
            </div>
          </div>

          <div v-if="!isTakeawayActive" class="mb-4 bg-white p-2.5 rounded-xl border-2 transition-all duration-300"
            :class="!mesaSeleccionada && store.cart.length > 0 ? 'border-red-300 shadow-md shadow-red-500/10' : 'border-gray-200 shadow-sm'">
            <label class="block text-[10px] font-black uppercase tracking-widest mb-2 px-1"
              :class="!mesaSeleccionada && store.cart.length > 0 ? 'text-red-500' : 'text-slate-400'">
              {{ !mesaSeleccionada ? '[!] Obligatorio: Asignar a destino' : 'Destino de la Orden:' }}
            </label>
            <button @click="showTableModal = true" class="w-full bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-800 p-2.5 rounded-lg flex items-center justify-between transition-colors group">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded bg-slate-200 group-hover:bg-emerald-200 text-slate-600 group-hover:text-emerald-700 flex items-center justify-center font-black text-xs transition-colors">{{ mesaSeleccionada ? mesaSeleccionada.icon : '?' }}</div>
                <span class="font-bold text-sm" :class="!mesaSeleccionada && store.cart.length > 0 ? 'text-red-500 animate-pulse' : ''">{{ mesaSeleccionada ? mesaSeleccionada.name : 'Seleccionar Mesa' }}</span>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors">
                <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          <div class="flex gap-3 mt-4">
            <button @click="handleCancelCart" class="flex-1 bg-red-50 text-red-500 border-2 border-red-200 hover:bg-red-100 py-3 rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center gap-2 active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              <span class="lg:hidden truncate">{{ store.cart.length === 0 ? 'Cerrar' : 'Cancelar' }}</span>
              <span class="hidden lg:inline">Cancelar</span>
            </button>
            <button @click="handleCheckout()" :disabled="!canCheckout" class="flex-1 font-bold py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2" :class="[canCheckout ? 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95 shadow-emerald-500/30' : 'bg-gray-300 text-gray-400 cursor-not-allowed shadow-none', { 'cart-bump-desktop': cartPulse && canCheckout }]">
              Enviar
            </button>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'sent'" class="flex-1 flex flex-col bg-slate-50 overflow-hidden">
        <div class="p-4 border-b border-gray-200 bg-white flex justify-between items-center shadow-sm z-10">
          <div>
            <h3 class="font-black text-slate-800 text-sm">Cocinando...</h3>
            <p class="text-[11px] text-slate-500 font-medium">Pedidos en preparación.</p>
          </div>
          <button @click="loadActiveOrders" class="text-orange-500 bg-orange-50 hover:bg-orange-100 p-2 rounded-lg transition" title="Refrescar">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
          
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <div v-if="activeOrders.filter(o => o.status === 'Pendiente').length === 0" class="text-center text-slate-400 mt-10">
            <p class="font-medium">No hay órdenes esperando en cocina.</p>
            
          </div>

          <div v-for="order in activeOrders.filter(o => o.status === 'Pendiente')" :key="order.id" 
            class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group">
            
            <div class="flex justify-between items-center mb-3">
              <span class="font-black text-slate-800 tracking-wide">Orden #{{ order.dailyTicket || order.id }}</span>
              <span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] uppercase tracking-widest font-black border border-gray-200">
                {{ order.table }}
              </span>
            </div>
            
            <p class="text-xs text-slate-500 mb-4 line-clamp-3 leading-relaxed" :title="order.description">{{ order.description }}</p>
            
            <div class="flex justify-between items-center pt-3 border-t border-gray-100">
              <span class="font-black text-slate-800">S/. {{ order.total.toFixed(2) }}</span>
              <button @click="askToCancelPos(order)" class="px-3 py-1.5 text-red-600 bg-white border-2 border-red-100 hover:bg-red-50 hover:border-red-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg> Anular
              </button>
            </div>
          </div>
          
          <div class="p-4 bg-white border-t border-gray-200 mt-auto shrink-0 lg:hidden">
            <button @click="showMobileCart = false" class="w-full bg-red-50 text-red-500 border-2 border-red-200 hover:bg-red-100 py-3 rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center gap-2 active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              Cerrar Panel
            </button>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'ready'" class="flex-1 flex flex-col bg-slate-50 overflow-hidden">
        <div class="p-4 border-b border-gray-200 bg-white flex justify-between items-center shadow-sm z-10">
          <div>
            <h3 class="font-black text-emerald-600 text-sm flex items-center gap-2">¡Listos para llevar!</h3>
            <p class="text-[11px] text-slate-500 font-medium">Lleva estos pedidos a la mesa.</p>
          </div>
          <button @click="loadActiveOrders" class="text-emerald-500 bg-emerald-50 hover:bg-emerald-100 p-2 rounded-lg transition" title="Refrescar">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <div v-if="activeOrders.filter(o => o.status === 'Listo').length === 0" class="flex flex-col items-center text-slate-400 mt-10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-12 h-12 mb-2 opacity-50">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p class="font-medium">No hay platos listos por ahora.</p>
          </div>

          <div v-for="order in activeOrders.filter(o => o.status === 'Listo')" :key="order.id"
            class="bg-gradient-to-b from-white to-emerald-50/40 p-4 rounded-xl border border-emerald-200 shadow-[0_4px_15px_-3px_rgba(16,185,129,0.15)] relative group transform transition hover:-translate-y-1">
            
            <div class="flex justify-between items-center mb-3">
              <span class="font-black text-slate-800 tracking-wide text-lg">Orden #{{ order.dailyTicket || order.id }}</span>
              <span class="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-md font-black text-[11px] uppercase tracking-widest shadow-sm">{{ order.table }}</span>
            </div>
            
            <p class="text-xs text-slate-600 mb-4 line-clamp-3 leading-relaxed" :title="order.description">{{ order.description }}</p>
            
            <button @click="handleMarcarEntregado(order)" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl shadow-lg shadow-emerald-500/30 transition active:scale-95 flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
              Marcar Entregado
            </button>
          </div>

          <div class="p-4 bg-white border-t border-gray-200 mt-auto shrink-0 lg:hidden">
            <button @click="showMobileCart = false" class="w-full bg-red-50 text-red-500 border-2 border-red-200 hover:bg-red-100 py-3 rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center gap-2 active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              Cerrar Panel
            </button>
          </div>

        </div>
      </div>
      
    </div>

    <button @click="showMobileCart = true"
      class="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white px-6 py-4 rounded-full shadow-[0_15px_40px_rgba(0,0,0,0.4)] flex justify-between items-center font-bold active:scale-95 transition-all w-[90%] max-w-[400px]"
      :class="{ 'cart-bump': cartPulse }">
      <div class="flex items-center gap-3">
        <div class="bg-orange-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs shadow-inner">
          {{ store.cart.length > 0 ? store.cart.length : activeOrders.length }}
        </div>
        <span class="text-sm uppercase tracking-wider">Cuenta / Pedidos</span>
      </div>
      <div class="h-6 w-px bg-slate-700 mx-2"></div>
      <span class="text-emerald-400 text-lg transition-colors" :class="{ 'text-flash': cartPulse }">
        S/. {{ store.totalPrice.toFixed(2) }}
      </span>
    </button>

    <div v-if="showMobileCart" @click="showMobileCart = false"
      class="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 transition-opacity"></div>
  </div>

  <div v-if="showComboModal" class="fixed inset-0 z-[80] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" @click="showComboModal = false">
    </div>
    <div class="relative bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden">
      <div class="p-6 border-b border-gray-100 flex justify-between items-center"
        :class="activeCombo?.id === 'menu-ejecutivo' ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'">
        <div>
          <h2 class="text-2xl font-black" :class="activeCombo?.id === 'menu-ejecutivo' ? 'text-blue-800' : 'text-orange-800'">Personalizar {{ activeCombo?.name }}</h2>
          <p class="text-sm font-medium mt-1 opacity-80" :class="activeCombo?.id === 'menu-ejecutivo' ? 'text-blue-700' : 'text-orange-700'">Selecciona las opciones para el comensal</p>
        </div>
        <div class="text-right hidden sm:block">
          <span class="block text-2xl font-black" :class="activeCombo?.id === 'menu-ejecutivo' ? 'text-blue-600' : 'text-orange-600'">S/. {{ activeCombo?.price.toFixed(2) }}</span>
        </div>
      </div>
      <div class="p-6 overflow-y-auto flex-1 space-y-8 bg-white">
        <div v-if="activeCombo?.options?.entradas?.length > 0">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Entrada (Opcional)</h3>
            <span v-if="comboSelections.entrada === ''" class="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">Sin Entrada</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div v-for="opt in activeCombo.options.entradas" :key="opt" @click="toggleSelection('entrada', opt)"
              class="h-full p-4 border-2 rounded-xl font-bold text-sm text-center transition flex flex-col items-center justify-center select-none"
              :class="{
                'border-slate-800 bg-slate-50 text-slate-800 shadow-sm cursor-pointer': comboSelections.entrada === opt && !activeCombo.options.agotados?.includes(opt),
                'border-slate-100 text-slate-600 hover:border-slate-300 bg-white shadow-sm cursor-pointer': comboSelections.entrada !== opt && !activeCombo.options.agotados?.includes(opt),
                'bg-gray-100 text-gray-400 border-gray-200 opacity-60 cursor-not-allowed': activeCombo.options.agotados?.includes(opt)
              }">
              <span :class="{ 'line-through': activeCombo.options.agotados?.includes(opt) }">{{ opt }}</span>
              <span v-if="activeCombo.options.agotados?.includes(opt)" class="block text-[9px] text-red-500 mt-1 uppercase font-black tracking-widest">Agotado</span>
            </div>
          </div>
        </div>

        <div v-if="activeCombo?.options?.segundos?.length > 0">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Segundo (Opcional)</h3>
            <span v-if="comboSelections.segundo === ''" class="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">Sin Segundo</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div v-for="opt in activeCombo.options.segundos" :key="opt" @click="toggleSelection('segundo', opt)"
              class="h-full p-4 border-2 rounded-xl font-bold text-sm text-center transition flex flex-col items-center justify-center select-none"
              :class="{
                'border-slate-800 bg-slate-50 text-slate-800 shadow-sm cursor-pointer': comboSelections.segundo === opt && !activeCombo.options.agotados?.includes(opt),
                'border-slate-100 text-slate-600 hover:border-slate-300 bg-white shadow-sm cursor-pointer': comboSelections.segundo !== opt && !activeCombo.options.agotados?.includes(opt),
                'bg-gray-100 text-gray-400 border-gray-200 opacity-60 cursor-not-allowed': activeCombo.options.agotados?.includes(opt)
              }">
              <span :class="{ 'line-through': activeCombo.options.agotados?.includes(opt) }">{{ opt }}</span>
              <span v-if="activeCombo.options.agotados?.includes(opt)" class="block text-[9px] text-red-500 mt-1 uppercase font-black tracking-widest">Agotado</span>
            </div>
          </div>
        </div>

        <div v-if="activeCombo?.options?.bebidas?.length > 0">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Bebida (Opcional)</h3>
            <span v-if="comboSelections.bebida === ''" class="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">Sin Bebida</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div v-for="opt in activeCombo.options.bebidas" :key="opt" @click="toggleSelection('bebida', opt)"
              class="h-full p-4 border-2 rounded-xl font-bold text-sm text-center transition flex flex-col items-center justify-center select-none"
              :class="{
                'border-slate-800 bg-slate-50 text-slate-800 shadow-sm cursor-pointer': comboSelections.bebida === opt && !activeCombo.options.agotados?.includes(opt),
                'border-slate-100 text-slate-600 hover:border-slate-300 bg-white shadow-sm cursor-pointer': comboSelections.bebida !== opt && !activeCombo.options.agotados?.includes(opt),
                'bg-gray-100 text-gray-400 border-gray-200 opacity-60 cursor-not-allowed': activeCombo.options.agotados?.includes(opt)
              }">
              <span :class="{ 'line-through': activeCombo.options.agotados?.includes(opt) }">{{ opt }}</span>
              <span v-if="activeCombo.options.agotados?.includes(opt)" class="block text-[9px] text-red-500 mt-1 uppercase font-black tracking-widest">Agotado</span>
            </div>
          </div>
        </div>

        <div v-if="activeCombo?.options?.postres?.length > 0">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Postre (Opcional)</h3>
            <span v-if="comboSelections.postre === ''" class="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">Sin Postre</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div v-for="opt in activeCombo.options.postres" :key="opt" @click="toggleSelection('postre', opt)"
              class="h-full p-4 border-2 rounded-xl font-bold text-sm text-center transition flex flex-col items-center justify-center select-none"
              :class="{
                'border-slate-800 bg-slate-50 text-slate-800 shadow-sm cursor-pointer': comboSelections.postre === opt && !activeCombo.options.agotados?.includes(opt),
                'border-slate-100 text-slate-600 hover:border-slate-300 bg-white shadow-sm cursor-pointer': comboSelections.postre !== opt && !activeCombo.options.agotados?.includes(opt),
                'bg-gray-100 text-gray-400 border-gray-200 opacity-60 cursor-not-allowed': activeCombo.options.agotados?.includes(opt)
              }">
              <span :class="{ 'line-through': activeCombo.options.agotados?.includes(opt) }">{{ opt }}</span>
              <span v-if="activeCombo.options.agotados?.includes(opt)" class="block text-[9px] text-red-500 mt-1 uppercase font-black tracking-widest">Agotado</span>
            </div>
          </div>
        </div>
      </div>
      <div class="p-6 bg-slate-50 border-t border-gray-200 flex gap-4">
        <button @click="showComboModal = false" class="flex-1 bg-white border border-gray-300 text-slate-600 font-bold py-4 rounded-xl hover:bg-gray-100 transition shadow-sm">Cancelar</button>
        <button @click="addComboToCart" class="flex-[2] text-white font-bold py-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition hover:-translate-y-0.5" :class="activeCombo?.id === 'menu-ejecutivo' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'">Agregar</button>
      </div>
    </div>
  </div>

  <div v-if="showModal" class="fixed inset-0 z-[90] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" @click="closeModal"></div>
    <div class="relative bg-white rounded-2xl border border-gray-100 shadow-2xl max-w-sm w-full p-8 text-center">
      <div class="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-500 shadow-inner">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-10 h-10"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
      </div>
      <h3 class="text-2xl font-bold text-slate-800 mb-2">Pedido Confirmado!</h3>
      <p class="text-slate-500 mb-6 text-sm">La orden ha sido enviada a cocina exitosamente.</p>
      <button @click="closeModal" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg mt-4 transition active:scale-95">Aceptar</button>
    </div>
  </div>

  <div v-if="showTableModal" class="fixed inset-0 z-[80] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" @click="showTableModal = false"></div>
    <div class="relative bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-8 flex flex-col max-h-[90vh]">
      <div class="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
        <h2 class="text-2xl font-black text-slate-800">Seleccionar Destino</h2>
        <button @click="showTableModal = false" class="p-2 bg-gray-50 hover:bg-red-50 hover:text-red-500 rounded-xl text-slate-400 transition-colors border">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div class="overflow-y-auto pr-2 pb-4">
        <div class="grid grid-cols-2 gap-4 mb-8">
          <button v-for="mesa in store.tables.filter(t => t.type !== 'table')" :key="mesa.id" @click="seleccionarMesa(mesa)" class="bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 p-5 rounded-2xl font-bold flex flex-col items-center gap-3 transition-colors group">
            <div class="w-16 h-16 rounded-full bg-white text-blue-600 group-hover:scale-110 flex items-center justify-center text-2xl transition shadow-sm">{{ mesa.icon }}</div>
            <span>{{ mesa.name }}</span>
          </button>
        </div>
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
          <button v-for="mesa in store.tables.filter(t => t.type === 'table')" :key="mesa.id" @click="seleccionarMesa(mesa)" class="bg-white hover:bg-orange-500 text-slate-700 hover:text-white border-2 border-slate-200 hover:border-orange-500 p-4 rounded-2xl font-bold flex flex-col items-center gap-3 transition-all group shadow-sm">
            <div class="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-white text-slate-500 group-hover:text-orange-500 group-hover:scale-110 flex items-center justify-center text-xl transition">{{ mesa.icon }}</div>
            <span class="text-sm">{{ mesa.name }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <div v-if="showPosCancelModal" class="fixed inset-0 z-[80] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" @click="!isCancellingPos && (showPosCancelModal = false)"></div>
    <div class="relative bg-white rounded-3xl border border-red-100 shadow-2xl max-w-sm w-full p-8 text-center">
      <div class="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 shadow-inner border-4 border-red-100">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-10 h-10"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" /></svg>
      </div>
      <h3 class="text-2xl font-black text-slate-800 mb-2">¿Anular esta Orden?</h3>
      <p class="text-slate-500 mb-6 text-sm">Esto enviará una alerta a la pantalla de la Cocina para que detengan la preparación. ¿Estás seguro?</p>
      <div class="flex gap-3">
        <button @click="showPosCancelModal = false" :disabled="isCancellingPos" class="flex-1 bg-white border border-gray-300 text-slate-600 font-bold py-3 rounded-xl hover:bg-gray-50 transition shadow-sm">Atrás</button>
        <button @click="confirmCancelPos" :disabled="isCancellingPos" class="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl shadow-md transition active:scale-95 flex items-center justify-center">
          <span v-if="!isCancellingPos">Sí, Anular</span>
          <svg v-else class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </button>
      </div>
    </div>
  </div>

  <div v-if="showTakeawayModal" class="fixed inset-0 z-[90] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="showTakeawayModal = false"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
      <h3 class="text-xl font-bold text-slate-800 mb-2">Pedido Para Llevar</h3>
      <p class="text-slate-500 text-sm mb-6">Ingresa el nombre del cliente externo.</p>
      <form @submit.prevent="confirmTakeaway">
        <input v-model="takeawayCustomer" type="text" placeholder="Ej: Sr. Torres" class="w-full border-2 border-slate-200 rounded-xl px-4 py-3 mb-6 focus:border-slate-800 focus:outline-none text-slate-800 font-medium" required autofocus />
        <div class="flex gap-3">
          <button type="button" @click="showTakeawayModal = false" class="flex-1 border border-slate-300 text-slate-600 hover:bg-slate-50 py-3 rounded-xl font-bold transition-colors">Cerrar</button>
          <button type="submit" class="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-bold transition-colors">Iniciar Pedido</button>
        </div>
      </form>
    </div>
  </div>
  
</template>

<style scoped>
/* ══════════════════════════════════════════════════
   PRECIO — efecto "slam": cae desde arriba,
   rebota elásticamente y aterriza en su lugar.
   Mucho más legible que el flip: el mesero ve
   el nuevo monto desde el primer frame.
══════════════════════════════════════════════════ */
.text-flash {
  animation: price-slam 2s cubic-bezier(0.22, 1, 0.36, 1);
  display: inline-block;
  transform-origin: center bottom;
}

@keyframes price-slam {
  0% {
    transform: translateY(-18px) scale(1.35);
    opacity: 0;
    color: #f97316;
  }

  55% {
    transform: translateY(4px) scale(0.92);
    opacity: 1;
    color: #f97316;
  }

  72% {
    transform: translateY(-3px) scale(1.04);
    color: #f97316;
  }

  85% {
    transform: translateY(1px) scale(0.98);
    color: inherit;
  }

  100% {
    transform: translateY(0) scale(1);
    color: inherit;
  }
}


/* ══════════════════════════════════════════════════
   CARRITO MÓVIL — sacudida con rotación
   (no usa translateY absoluto → no rompe centrado)
══════════════════════════════════════════════════ */
.cart-bump-mobile {
  animation: cart-shake-mobile 2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes cart-shake-mobile {
  0% {
    transform: scale(1) rotate(0deg);
  }

  20% {
    transform: scale(1.25) rotate(-12deg);
  }

  40% {
    transform: scale(0.9) rotate(8deg);
  }

  65% {
    transform: scale(1.1) rotate(-4deg);
  }

  85% {
    transform: scale(0.97) rotate(1deg);
  }

  100% {
    transform: scale(1) rotate(0deg);
  }
}


/* ══════════════════════════════════════════════════
   CARRITO TABLET/PC — igual pero más contenido
══════════════════════════════════════════════════ */
.cart-bump-desktop {
  animation: cart-shake-desktop 2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes cart-shake-desktop {
  0% {
    transform: scale(1) rotate(0deg);
  }

  20% {
    transform: scale(1.18) rotate(-8deg);
  }

  40% {
    transform: scale(0.94) rotate(5deg);
  }

  65% {
    transform: scale(1.07) rotate(-2deg);
  }

  85% {
    transform: scale(0.98) rotate(0deg);
  }

  100% {
    transform: scale(1) rotate(0deg);
  }
}


/* ══════════════════════════════════════════════════
   CARD/CONTENEDOR — ring naranja confirma al mesero
   que el ítem fue sumado sin molestar al cliente
══════════════════════════════════════════════════ */
.card-confirm {
  animation: card-ring 2s ease-out;
}

@keyframes card-ring {
  0% {
    box-shadow: 0 0 0 0px rgba(249, 115, 22, 0);
  }

  35% {
    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.40);
  }

  100% {
    box-shadow: 0 0 0 0px rgba(249, 115, 22, 0);
  }
}


/* ══════════════════════════════════════════════════
   BADGE (contador del carrito) — pop con rotación
══════════════════════════════════════════════════ */
.badge-pop {
  animation: badge-pop 2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes badge-pop {
  0% {
    transform: scale(0) rotate(-15deg);
  }

  65% {
    transform: scale(1.3) rotate(5deg);
  }

  100% {
    transform: scale(1) rotate(0deg);
  }
}
</style>