//pages/pos.vue
<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue' 
import { usePosStore } from '../stores/pos'

const store = usePosStore()

const showMobileCart = ref(false)

const searchQuery = ref('')
const selectedCategory = ref('Todo')
const filterCategories = ['Todo', 'Menú del Día', 'Comida', 'Bebidas', 'Postre']

const filteredProducts = computed(() => {
  let filtrados = store.products

  // 1. Primero filtramos por categoría (si no es 'Todo')
  if (selectedCategory.value !== 'Todo') {
    const categoryToMatch = selectedCategory.value === 'Bebidas' ? 'Bebida' : selectedCategory.value
    filtrados = filtrados.filter(p => p.category === categoryToMatch)
  }

  // 2. Luego aplicamos la búsqueda sobre esos resultados
  if (searchQuery.value.trim() !== '') {
    // 🚀 MAGIA ANTI-TILDES: Separa el acento de la letra y lo elimina
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

async function loadActiveOrders() {
  try {
    const data = await $fetch('/api/orders/kitchen')
    activeOrders.value = data.reverse()
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

// 🚀 1. Función para encontrar el primer plato que NO esté agotado
function getFirstAvailable(items, agotados) {
  if (!items || items.length === 0) return ''
  const agotadosList = agotados || []
  const available = items.find(item => !agotadosList.includes(item))
  return available || '' // Si todo está agotado, lo deja vacío
}

// 🚀 2. Función para alternar (seleccionar/deseleccionar) un plato
function toggleSelection(category, value) {
  const agotadosList = activeCombo.value?.options?.agotados || []
  if (agotadosList.includes(value)) return // Si está agotado, no hace nada al hacer clic

  // Si ya estaba seleccionado, lo DESMARCA (porque el cliente no quiere)
  if (comboSelections.value[category] === value) {
    comboSelections.value[category] = ''
  } else {
    // Si no estaba seleccionado, lo marca
    comboSelections.value[category] = value
  }
}

// 🚀 3. El nuevo comportamiento al abrir el Menú
function handleProductClick(product) {
  if (product.type === 'combo') {
    activeCombo.value = product
    const agotados = product.options?.agotados || []
    
    // Asigna automáticamente el primer plato que haya "sobrevivido" al Sold Out
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
  }
}

function addComboToCart() {
  // 🚀 MAGIA AQUÍ: Si está vacío, escribimos explícitamente "Sin..."
  const selecciones = [
    comboSelections.value.entrada || 'Sin entrada',
    comboSelections.value.segundo || 'Sin segundo',
    comboSelections.value.bebida || 'Sin bebida',
    comboSelections.value.postre || 'Sin postre'
  ].join(', ') // Quitamos el filter(Boolean) para que pasen todos

  const finalName = `${activeCombo.value.name} [${selecciones}]`
  const uniqueId = `combo-${Date.now()}`

  store.addToCart({
    ...activeCombo.value,
    id: uniqueId,
    name: finalName
  })
  showComboModal.value = false
  activeTab.value = 'cart' 
}

let syncInterval = null
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

// 🧹 (SE ELIMINARON TODAS LAS VARIABLES Y EVENTOS DEL PULL TO REFRESH MANUAL)

onMounted(() => {
  syncCatalog() 
  loadActiveOrders() // 🚀 Agregado aquí para que los pedidos carguen al abrir el POS
  syncInterval = setInterval(syncCatalog, 15000) 
})

onUnmounted(() => {
  if (syncInterval) clearInterval(syncInterval)
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
    loadActiveOrders()
  }
}

function closeModal() {
  showModal.value = false
}

// --- CANCELAR / CERRAR CARRITO ---
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
</script>

<template>
  <div class="flex h-full lg:gap-6 relative overflow-hidden lg:overflow-visible">
       <div class="flex-1 flex flex-col overflow-hidden pb-24 lg:pb-0 w-full">
      
      <header class="mb-6 flex flex-col gap-4">
        <div class="relative shadow-sm flex items-center">
          <span class="absolute left-4 text-slate-400 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
          </span>
          
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Buscar producto..." 
            class="w-full bg-white text-slate-700 pl-11 pr-12 py-4 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition"
          >
          
          <button 
            @click="syncCatalog" 
            class="absolute right-3 p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
            title="Sincronizar Catalogo"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5"
              :class="{'animate-spin text-orange-500': isSyncingCatalog}"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>

        <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          <button 
            v-for="cat in filterCategories" 
            :key="cat"
            @click="selectedCategory = cat"
            class="px-5 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap"
            :class="selectedCategory === cat ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-white text-slate-600 border border-gray-200 shadow-sm'"
          >
            {{ cat }}
          </button>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto pr-2 pb-4">
        <div v-if="filteredProducts.length === 0" class="flex flex-col items-center justify-center py-16 text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-16 h-16 mb-4 opacity-50"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
          <p class="font-bold text-lg text-slate-500">No se encontraron productos</p>
          <p class="text-sm">Prueba con otro termino de busqueda o categoria.</p>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <div v-for="product in filteredProducts" :key="product.id" @click="handleProductClick(product)" class="bg-white rounded-2xl p-0 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition duration-300 border border-gray-100 group relative overflow-hidden flex flex-col">
            <div v-if="product.type === 'combo'" class="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md z-10 shadow-sm flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>
              HOY
            </div>
            <div class="aspect-[4/3] overflow-hidden bg-slate-100 relative flex items-center justify-center w-full">
               <img v-if="product.image" :src="product.image" alt="Foto" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
               <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-16 h-16 text-slate-300 group-hover:scale-110 transition duration-500"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
               <div class="absolute bottom-0 right-0 bg-orange-500 text-white font-bold px-3 py-1 rounded-tl-xl shadow-lg text-sm">
                 S/. {{ product.price.toFixed(2) }}
               </div>
            </div>
            <div class="p-3 flex-1 flex flex-col justify-between">
              <h3 class="font-bold text-slate-800 leading-tight text-sm mb-2 line-clamp-2">{{ product.name }}</h3>
              <div>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-gray-200">
                  {{ product.category }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div 
      class="bg-white border-gray-200 flex flex-col z-[60] overflow-hidden transition-transform duration-300 ease-in-out
             fixed inset-x-0 bottom-0 h-[85vh] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)]
             lg:relative lg:w-96 lg:h-auto lg:rounded-2xl lg:border lg:shadow-xl lg:translate-y-0 lg:z-20 lg:!flex"
      :class="showMobileCart ? 'translate-y-0' : 'translate-y-full'"
    >
      <div class="lg:hidden flex justify-center items-center py-3 bg-gray-50 border-b border-gray-200 active:bg-gray-100" @click="showMobileCart = false">
        <div class="w-12 h-1.5 bg-gray-300 rounded-full cursor-pointer"></div>
      </div>

      <div class="flex border-b border-gray-200 bg-gray-50/80">
        <button @click="activeTab = 'cart'" class="flex-1 py-4 font-bold text-sm transition-colors relative flex items-center justify-center gap-2" :class="activeTab === 'cart' ? 'bg-white text-slate-800' : 'text-slate-400 hover:text-slate-600'">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg> Nueva Orden
          <div v-if="activeTab === 'cart'" class="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500"></div>
        </button>
        <button @click="activeTab = 'sent'; loadActiveOrders()" class="flex-1 py-4 font-bold text-sm transition-colors relative flex items-center justify-center gap-2" :class="activeTab === 'sent' ? 'bg-white text-slate-800' : 'text-slate-400 hover:text-slate-600'">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" /></svg> Enviados
          <span v-if="activeOrders.length > 0" class="bg-red-500 text-white text-[10px] px-1.5 rounded-full font-black">{{ activeOrders.length }}</span>
          <div v-if="activeTab === 'sent'" class="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500"></div>
        </button>
      </div>

      <div v-if="activeTab === 'cart'" class="flex-1 flex flex-col overflow-hidden bg-white">
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <div v-if="store.cart.length === 0" class="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" class="w-20 h-20 mb-4 text-slate-300"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
            <p class="font-medium text-lg">El carrito esta vacio</p>
          </div>

          <div v-for="item in store.cart" :key="item.id" class="flex justify-between items-center group bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:border-orange-200 transition">
            <div class="flex items-center gap-3">
               <img :src="item.image || 'https://placehold.co/100?text=?'" class="w-12 h-12 rounded-lg object-cover bg-gray-100 border border-gray-200">
              <div class="max-w-[120px] sm:max-w-[160px]">
                <p class="text-sm font-bold text-slate-800 line-clamp-2 leading-tight" :title="item.name">{{ item.name }}</p>
                <p class="text-xs text-slate-500 font-mono mt-0.5">S/. {{ item.price }} x {{ item.quantity }}</p>
              </div>
            </div>
            
            <div class="flex items-center gap-2 bg-gray-100 rounded-lg p-1 shrink-0">
               <button @click.stop="store.decreaseQuantity(item.id)" class="w-7 h-7 rounded-md bg-white text-slate-600 shadow-sm hover:text-red-500 hover:bg-red-50 transition font-bold">-</button>
               <span class="text-slate-800 font-bold w-4 text-center text-sm">{{ item.quantity }}</span>
               <button @click.stop="store.addToCart(item)" class="w-7 h-7 rounded-md bg-white text-slate-600 shadow-sm hover:text-emerald-500 hover:bg-emerald-50 transition font-bold">+</button>
            </div>
          </div>
        </div>

        <div class="p-6 bg-gray-50 border-t border-gray-200">
          <div class="flex justify-between mb-2 text-sm text-slate-500 font-medium">
            <span>Subtotal</span><span>S/. {{ store.totalPrice.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between mb-4 text-2xl font-bold text-slate-800">
            <span>Total</span><span class="text-emerald-600">S/. {{ store.totalPrice.toFixed(2) }}</span>
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
              <button @click="cancelTakeaway" class="text-slate-500 hover:text-red-600 font-bold px-3 py-1.5 border border-slate-200 hover:border-red-200 bg-white rounded-lg transition-colors text-xs">
                Cancelar
              </button>
            </div>
          </div>
          
          <div v-if="!isTakeawayActive" class="mb-4 bg-white p-2.5 rounded-xl border-2 transition-all duration-300" :class="!mesaSeleccionada && store.cart.length > 0 ? 'border-red-300 shadow-md shadow-red-500/10' : 'border-gray-200 shadow-sm'">
            <label class="block text-[10px] font-black uppercase tracking-widest mb-2 px-1" :class="!mesaSeleccionada && store.cart.length > 0 ? 'text-red-500' : 'text-slate-400'">
              {{ !mesaSeleccionada ? '[!] Obligatorio: Asignar a destino' : 'Destino de la Orden:' }}
            </label>
            <button @click="showTableModal = true" class="w-full bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-800 p-2.5 rounded-lg flex items-center justify-between transition-colors group">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded bg-slate-200 group-hover:bg-emerald-200 text-slate-600 group-hover:text-emerald-700 flex items-center justify-center font-black text-xs transition-colors">{{ mesaSeleccionada ? mesaSeleccionada.icon : '?' }}</div>
                <span class="font-bold text-sm" :class="!mesaSeleccionada && store.cart.length > 0 ? 'text-red-500 animate-pulse' : ''">{{ mesaSeleccionada ? mesaSeleccionada.name : 'Seleccionar Mesa' }}</span>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>
          
          <div class="grid grid-cols-2 gap-3 mt-4">
             <button @click="handleCancelCart" class="bg-white border border-gray-300 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-600 font-bold py-3 rounded-xl transition shadow-sm">
               <span class="lg:hidden">{{ store.cart.length === 0 ? 'Cerrar Panel' : 'Cancelar Pedido' }}</span>
               <span class="hidden lg:inline">Cancelar</span>
             </button>
             <button @click="handleCheckout()" :disabled="!canCheckout" class="font-bold py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2" :class="canCheckout ? 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95 shadow-emerald-500/30' : 'bg-gray-300 text-gray-400 cursor-not-allowed shadow-none'">Enviar</button>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'sent'" class="flex-1 flex flex-col bg-slate-50 overflow-hidden">
        
        <div class="p-4 border-b border-gray-200 bg-white flex justify-between items-center shadow-sm z-10">
          <div>
            <h3 class="font-black text-slate-800 text-sm">Ordenes en Preparacion</h3>
            <p class="text-[11px] text-slate-500 font-medium">Pedidos enviados a cocina.</p>
          </div>
          <button @click="loadActiveOrders" class="text-blue-500 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition" title="Refrescar">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <div v-if="activeOrders.length === 0" class="text-center text-slate-400 mt-10">
            <p class="font-medium">No hay ordenes esperando en cocina.</p>
          </div>

          <div v-for="order in activeOrders" :key="order.id" class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group">
            <div class="flex justify-between items-center mb-3">
              <span class="font-black text-slate-800 tracking-wide">Orden #{{ order.dailyTicket || order.id }}</span>
              <span class="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-bold text-xs border border-slate-200">{{ order.table }}</span>
            </div>
            
            <p class="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed" :title="order.description">{{ order.description }}</p>
            
            <div class="flex justify-between items-center pt-3 border-t border-gray-100">
              <span class="font-black text-emerald-600">S/. {{ order.total.toFixed(2) }}</span>
              <button @click="askToCancelPos(order)" class="text-red-600 bg-red-50 hover:bg-red-500 hover:text-white px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-red-100 hover:border-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                Anular
              </button>
            </div>
          </div>
        </div>

        <div class="p-4 bg-white border-t border-gray-200 lg:hidden">
          <button @click="showMobileCart = false" class="w-full bg-white border border-gray-300 hover:bg-gray-50 text-slate-600 font-bold py-3 rounded-xl transition shadow-sm">
            Cerrar Panel
          </button>
        </div>

      </div>

    </div>

    <button 
      @click="showMobileCart = true"
      class="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white px-6 py-4 rounded-full shadow-[0_15px_40px_rgba(0,0,0,0.4)] flex justify-between items-center font-bold active:scale-95 transition-all w-[90%] max-w-[400px]"
    >
      <div class="flex items-center gap-3">
        <div class="bg-orange-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs shadow-inner">
          {{ store.cart.length > 0 ? store.cart.length : activeOrders.length }}
        </div>
        <span class="text-sm uppercase tracking-wider">Cuenta / Enviados</span>
      </div>
      <div class="h-6 w-px bg-slate-700 mx-2"></div>
      <span class="text-emerald-400 text-lg">S/. {{ store.totalPrice.toFixed(2) }}</span>
    </button>
    
    <div v-if="showMobileCart" @click="showMobileCart = false" class="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 transition-opacity"></div>
  </div>

  <div v-if="showComboModal" class="fixed inset-0 z-[80] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" @click="showComboModal = false"></div>
    <div class="relative bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden">
      
      <div class="p-6 border-b border-gray-100 flex justify-between items-center" :class="activeCombo?.id === 'menu-ejecutivo' ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'">
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
            <div 
              v-for="opt in activeCombo.options.entradas" 
              :key="opt" 
              @click="toggleSelection('entrada', opt)"
              class="h-full p-4 border-2 rounded-xl font-bold text-sm text-center transition flex flex-col items-center justify-center select-none"
              :class="{
                'border-slate-800 bg-slate-50 text-slate-800 shadow-sm cursor-pointer': comboSelections.entrada === opt && !activeCombo.options.agotados?.includes(opt),
                'border-slate-100 text-slate-600 hover:border-slate-300 bg-white shadow-sm cursor-pointer': comboSelections.entrada !== opt && !activeCombo.options.agotados?.includes(opt),
                'bg-gray-100 text-gray-400 border-gray-200 opacity-60 cursor-not-allowed': activeCombo.options.agotados?.includes(opt)
              }"
            >
              <span :class="{'line-through': activeCombo.options.agotados?.includes(opt)}">{{ opt }}</span>
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
            <div 
              v-for="opt in activeCombo.options.segundos" 
              :key="opt" 
              @click="toggleSelection('segundo', opt)"
              class="h-full p-4 border-2 rounded-xl font-bold text-sm text-center transition flex flex-col items-center justify-center select-none"
              :class="{
                'border-slate-800 bg-slate-50 text-slate-800 shadow-sm cursor-pointer': comboSelections.segundo === opt && !activeCombo.options.agotados?.includes(opt),
                'border-slate-100 text-slate-600 hover:border-slate-300 bg-white shadow-sm cursor-pointer': comboSelections.segundo !== opt && !activeCombo.options.agotados?.includes(opt),
                'bg-gray-100 text-gray-400 border-gray-200 opacity-60 cursor-not-allowed': activeCombo.options.agotados?.includes(opt)
              }"
            >
              <span :class="{'line-through': activeCombo.options.agotados?.includes(opt)}">{{ opt }}</span>
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
            <div 
              v-for="opt in activeCombo.options.bebidas" 
              :key="opt" 
              @click="toggleSelection('bebida', opt)"
              class="h-full p-4 border-2 rounded-xl font-bold text-sm text-center transition flex flex-col items-center justify-center select-none"
              :class="{
                'border-slate-800 bg-slate-50 text-slate-800 shadow-sm cursor-pointer': comboSelections.bebida === opt && !activeCombo.options.agotados?.includes(opt),
                'border-slate-100 text-slate-600 hover:border-slate-300 bg-white shadow-sm cursor-pointer': comboSelections.bebida !== opt && !activeCombo.options.agotados?.includes(opt),
                'bg-gray-100 text-gray-400 border-gray-200 opacity-60 cursor-not-allowed': activeCombo.options.agotados?.includes(opt)
              }"
            >
              <span :class="{'line-through': activeCombo.options.agotados?.includes(opt)}">{{ opt }}</span>
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
            <div 
              v-for="opt in activeCombo.options.postres" 
              :key="opt" 
              @click="toggleSelection('postre', opt)"
              class="h-full p-4 border-2 rounded-xl font-bold text-sm text-center transition flex flex-col items-center justify-center select-none"
              :class="{
                'border-slate-800 bg-slate-50 text-slate-800 shadow-sm cursor-pointer': comboSelections.postre === opt && !activeCombo.options.agotados?.includes(opt),
                'border-slate-100 text-slate-600 hover:border-slate-300 bg-white shadow-sm cursor-pointer': comboSelections.postre !== opt && !activeCombo.options.agotados?.includes(opt),
                'bg-gray-100 text-gray-400 border-gray-200 opacity-60 cursor-not-allowed': activeCombo.options.agotados?.includes(opt)
              }"
            >
              <span :class="{'line-through': activeCombo.options.agotados?.includes(opt)}">{{ opt }}</span>
              <span v-if="activeCombo.options.agotados?.includes(opt)" class="block text-[9px] text-red-500 mt-1 uppercase font-black tracking-widest">Agotado</span>
            </div>
          </div>
        </div>

      </div>
      
      <div class="p-6 bg-slate-50 border-t border-gray-200 flex gap-4">
        <button @click="showComboModal = false" class="flex-1 bg-white border border-gray-300 text-slate-600 font-bold py-4 rounded-xl hover:bg-gray-100 transition shadow-sm">Cancelar</button>
        <button @click="addComboToCart" class="flex-[2] text-white font-bold py-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition hover:-translate-y-0.5" :class="activeCombo?.id === 'menu-ejecutivo' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'">
          Agregar
        </button>
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
      <p class="text-slate-500 mb-6 text-sm">Esto enviara una alerta a la pantalla de la Cocina para que detengan la preparacion. ¿Estas seguro?</p>
      <div class="flex gap-3">
        <button @click="showPosCancelModal = false" :disabled="isCancellingPos" class="flex-1 bg-white border border-gray-300 text-slate-600 font-bold py-3 rounded-xl hover:bg-gray-50 transition shadow-sm">
          Atras
        </button>
        <button @click="confirmCancelPos" :disabled="isCancellingPos" class="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl shadow-md transition active:scale-95 flex items-center justify-center">
          <span v-if="!isCancellingPos">Si, Anular</span>
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
        <input 
          v-model="takeawayCustomer"
          type="text"
          placeholder="Ej: Sr. Torres"
          class="w-full border-2 border-slate-200 rounded-xl px-4 py-3 mb-6 focus:border-slate-800 focus:outline-none text-slate-800 font-medium"
          required
          autofocus
        />
        <div class="flex gap-3">
          <button 
            type="button" 
            @click="showTakeawayModal = false"
            class="flex-1 border border-slate-300 text-slate-600 hover:bg-slate-50 py-3 rounded-xl font-bold transition-colors"
          >
            Cerrar
          </button>
          <button 
            type="submit"
            class="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-bold transition-colors"
          >
            Iniciar Pedido
          </button>
        </div>
      </form>
    </div>
  </div>
</template>