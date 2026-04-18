<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { usePosStore } from '../stores/pos'

const store = usePosStore()

// --- VARIABLES DEL SISTEMA ---
const isLoading = ref(true)
const showModal = ref(false)
const showDeleteModal = ref(false)
const isEditing = ref(false)
const productToDelete = ref(null)
const searchQuery = ref('')

const showDuplicateModal = ref(false)
const duplicatedItems = ref([])

const showToast = ref(false)
const toastMessage = ref('')
const toastDetails = ref('')
const toastType = ref('success')

const sortKey = ref('id') 
const sortOrder = ref(-1) 

const form = ref({
  id: null,
  name: '',
  price: '',
  category: 'Comida',
  image: ''
})

// --- PULL TO REFRESH (LÓGICA TÁCTIL) ---
const touchStartY = ref(0)
const touchCurrentY = ref(0)
const isPulling = ref(false)
const pullDistance = computed(() => Math.max(0, touchCurrentY.value - touchStartY.value))
const showRefreshSpinner = computed(() => pullDistance.value > 60)

function handleTouchStart(e) {
  // Solo iniciar si estamos arriba del todo de la página
  if (window.scrollY === 0) {
    touchStartY.value = e.touches[0].clientY
    isPulling.value = true
  }
}

function handleTouchMove(e) {
  if (!isPulling.value) return
  touchCurrentY.value = e.touches[0].clientY
  // Evitar que haga scroll normal si estamos jalando
  if (pullDistance.value > 0) {
    e.preventDefault()
  }
}

async function handleTouchEnd() {
  if (!isPulling.value) return
  
  if (pullDistance.value > 80) {
    // Ejecutar recarga
    isLoading.value = true
    try {
      await store.loadProducts()
      triggerToast('Actualizado', 'Inventario sincronizado', 'success')
    } catch (e) {
      console.error(e)
    } finally {
      isLoading.value = false
    }
  }
  
  // Resetear valores
  isPulling.value = false
  touchStartY.value = 0
  touchCurrentY.value = 0
}

// --- EVENTOS DEL DOM PARA EL PULL TO REFRESH ---
onMounted(async () => {
  // Agregar listeners globales para el tacto
  document.addEventListener('touchstart', handleTouchStart, { passive: true })
  document.addEventListener('touchmove', handleTouchMove, { passive: false })
  document.addEventListener('touchend', handleTouchEnd)

  isLoading.value = true
  try {
    await store.loadProducts()
  } catch (error) {
    console.error('Error cargando inventario:', error)
  } finally {
    isLoading.value = false
  }
})

onUnmounted(() => {
  document.removeEventListener('touchstart', handleTouchStart)
  document.removeEventListener('touchmove', handleTouchMove)
  document.removeEventListener('touchend', handleTouchEnd)
})

// --- LÓGICA DE ORDENAMIENTO ---
function sortBy(key) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value * -1
  } else {
    sortKey.value = key
    sortOrder.value = 1
  }
}

const filteredProducts = computed(() => {
  let list = [...store.products] 

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    list = list.filter(product => 
      product.name.toLowerCase().includes(query) || 
      product.category.toLowerCase().includes(query)
    )
  }

  return list.sort((a, b) => {
    let valA = a[sortKey.value]
    let valB = b[sortKey.value]

    if (sortKey.value === 'price' || sortKey.value === 'id') {
      return (Number(valA) - Number(valB)) * sortOrder.value
    }

    valA = String(valA).toLowerCase()
    valB = String(valB).toLowerCase()
    if (valA < valB) return -1 * sortOrder.value
    if (valA > valB) return 1 * sortOrder.value
    return 0
  })
})

function triggerToast(title, details, type = 'success') {
  toastMessage.value = title
  toastDetails.value = details
  toastType.value = type
  showToast.value = true
  setTimeout(() => {
    showToast.value = false
  }, 3000)
}

function handleFileUpload(event) {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      form.value.image = e.target.result 
    }
    reader.readAsDataURL(file)
  }
}

function openCreateModal() {
  isEditing.value = false
  form.value = { id: null, name: '', price: '', category: 'Comida', image: '' }
  showModal.value = true
}

function openEditModal(product) {
  isEditing.value = true
  form.value = { ...product } 
  showModal.value = true
}

function saveProduct() {
  const nombreLimpio = form.value.name.trim().toLowerCase()
  const nuevoPadded = ` ${nombreLimpio} `

  const coincidencias = store.products.filter(p => {
    if (p.id === form.value.id) return false

    const existente = p.name.trim().toLowerCase()
    const existentePadded = ` ${existente} `

    return existente === nombreLimpio || 
           existentePadded.includes(nuevoPadded) || 
           nuevoPadded.includes(existentePadded)
  })

  if (coincidencias.length > 0) {
    duplicatedItems.value = coincidencias
    showDuplicateModal.value = true
    return 
  }

  executeSave()
}

async function executeSave() {
  try {
    if (isEditing.value) {
      await store.updateProduct(form.value)
      triggerToast('¡Producto Actualizado!', `Se modificó: ${form.value.name}`, 'success')
    } else {
      const newProd = await store.addProduct(form.value)
      triggerToast('¡Producto Agregado!', `${newProd.name} - S/. ${Number(newProd.price).toFixed(2)}`, 'success')
    }
    
    sortKey.value = 'id'
    sortOrder.value = -1

    showModal.value = false
    showDuplicateModal.value = false
  } catch (e) {
    triggerToast('Error', 'No se pudo contactar con el servidor.', 'warning')
  }
}

function requestDelete(product) {
  productToDelete.value = product
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (productToDelete.value) {
    await store.deleteProduct(productToDelete.value.id)
    triggerToast('Producto Eliminado', `Adiós a: ${productToDelete.value.name}`, 'success')
    showDeleteModal.value = false
    productToDelete.value = null
  }
}
</script>

<template>
  <div class="p-4 md:p-6 pb-24 md:pb-6 relative min-h-[calc(100vh-80px)]">
    
    <div 
      class="absolute top-0 left-1/2 -translate-x-1/2 flex justify-center items-center pointer-events-none transition-transform"
      :style="`transform: translateY(${Math.min(pullDistance - 50, 20)}px); opacity: ${pullDistance > 20 ? 1 : 0};`"
    >
      <div class="bg-white rounded-full p-2 shadow-md border border-gray-100 flex items-center justify-center" :class="showRefreshSpinner ? 'animate-spin' : ''">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-6 h-6 text-orange-500"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
      </div>
    </div>

    <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-6 bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold text-slate-800">Inventario</h1>
        <p class="text-slate-500 mt-1 text-sm md:text-base">Gestiona tu carta y precios</p>
      </div>
      
      <div class="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
        <div class="relative w-full md:w-64">
          <span class="absolute left-3 top-3.5 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
          </span>
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Buscar plato..." 
            class="w-full bg-gray-50 text-slate-700 pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition"
          >
        </div>

        <button 
          @click="openCreateModal"
          class="w-full md:w-auto bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition active:scale-95 shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Nuevo Plato
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="flex justify-center items-center py-20">
      <svg class="animate-spin h-10 w-10 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
    </div>

    <div v-else>
      
      <div class="md:hidden space-y-4">
        <div v-for="product in filteredProducts" :key="product.id" class="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col gap-4">
          
          <div class="flex items-start gap-4">
            <img 
              :src="product.image || 'https://placehold.co/100?text=?'" 
              class="w-16 h-16 rounded-xl object-cover bg-gray-100 border border-gray-200 shrink-0"
            >
            <div class="flex-1">
              <h3 class="font-bold text-slate-800 text-base leading-tight mb-1">{{ product.name }}</h3>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold inline-block border" :class="{ 'bg-orange-50 text-orange-600 border-orange-200': product.category === 'Comida', 'bg-blue-50 text-blue-600 border-blue-200': product.category === 'Bebida', 'bg-pink-50 text-pink-600 border-pink-200': product.category === 'Postre', 'bg-gray-50 text-gray-600 border-gray-200': !['Comida', 'Bebida', 'Postre'].includes(product.category) }">{{ product.category }}</span>
              <div class="text-emerald-600 font-bold font-mono text-lg mt-1">S/. {{ Number(product.price).toFixed(2) }}</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 mt-1">
            <button @click="openEditModal(product)" class="flex justify-center items-center gap-1.5 bg-indigo-50 text-indigo-600 py-2.5 rounded-xl font-bold text-sm border border-indigo-100 active:bg-indigo-100">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg> Editar
            </button>
            <button @click="requestDelete(product)" class="flex justify-center items-center gap-1.5 bg-red-50 text-red-600 py-2.5 rounded-xl font-bold text-sm border border-red-100 active:bg-red-100">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg> Borrar
            </button>
          </div>

        </div>
      </div>

      <div class="hidden md:block bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <table class="w-full text-left text-slate-600">
          <thead class="bg-gray-50 text-slate-500 uppercase text-xs font-bold border-b border-gray-200 select-none">
            <tr>
              <th @click="sortBy('name')" class="p-5 cursor-pointer hover:bg-gray-100 transition group">
                <div class="flex items-center gap-2">
                  Producto
                  <span v-if="sortKey === 'name'" class="text-orange-500">{{ sortOrder === 1 ? '▲' : '▼' }}</span>
                  <span v-else class="opacity-0 group-hover:opacity-50 transition">↕</span>
                </div>
              </th>
              <th @click="sortBy('category')" class="p-5 cursor-pointer hover:bg-gray-100 transition group">
                <div class="flex items-center gap-2">
                  Categoría
                  <span v-if="sortKey === 'category'" class="text-orange-500">{{ sortOrder === 1 ? '▲' : '▼' }}</span>
                  <span v-else class="opacity-0 group-hover:opacity-50 transition">↕</span>
                </div>
              </th>
              <th @click="sortBy('price')" class="p-5 cursor-pointer hover:bg-gray-100 transition group">
                <div class="flex items-center gap-2">
                  Precio
                  <span v-if="sortKey === 'price'" class="text-orange-500">{{ sortOrder === 1 ? '▲' : '▼' }}</span>
                  <span v-else class="opacity-0 group-hover:opacity-50 transition">↕</span>
                </div>
              </th>
              <th class="p-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="product in filteredProducts" :key="product.id" class="hover:bg-orange-50/50 transition duration-150">
              <td class="p-5">
                <div class="flex items-center gap-4">
                  <img 
                    :src="product.image || 'https://placehold.co/100?text=?'" 
                    class="w-12 h-12 rounded-lg object-cover bg-gray-100 border border-gray-200 shadow-sm"
                  >
                  <span class="font-bold text-slate-800 text-lg">{{ product.name }}</span>
                </div>
              </td>
              <td class="p-5">
                <span 
                  class="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 w-max shadow-sm border"
                  :class="{
                    'bg-orange-50 text-orange-600 border-orange-200': product.category === 'Comida',
                    'bg-blue-50 text-blue-600 border-blue-200': product.category === 'Bebida',
                    'bg-pink-50 text-pink-600 border-pink-200': product.category === 'Postre',
                    'bg-gray-50 text-gray-600 border-gray-200': !['Comida', 'Bebida', 'Postre'].includes(product.category)
                  }"
                >
                  <svg v-if="product.category === 'Comida'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" /></svg>
                  <svg v-if="product.category === 'Bebida'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                  <svg v-if="product.category === 'Postre'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
                  {{ product.category }}
                </span>
              </td>
              <td class="p-5 font-mono text-emerald-600 font-bold text-lg">
                S/. {{ Number(product.price).toFixed(2) }}
              </td>
              <td class="p-5 text-right">
                <div class="flex justify-end gap-3">
                  <button @click="openEditModal(product)" class="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-lg font-bold text-sm transition border border-indigo-100">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>
                    Editar
                  </button>
                  <button @click="requestDelete(product)" class="flex items-center gap-1.5 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg font-bold text-sm transition border border-red-100">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                    Borrar
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="filteredProducts.length === 0" class="p-8 md:p-16 text-center text-slate-400 bg-gray-50/50 mt-4 rounded-xl">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-slate-300"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
        <p class="font-bold text-base md:text-lg text-slate-500">No se encontraron productos.</p>
        <p class="text-sm">Prueba buscando otro nombre o agrega uno nuevo.</p>
      </div>

    </div>

    <div v-if="showModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" @click="showModal = false"></div>
      
      <div class="relative bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-md p-6 md:p-8 transform transition-all max-h-[90vh] overflow-y-auto">
        <h2 class="text-xl md:text-2xl font-bold text-slate-800 mb-6 border-b border-gray-100 pb-4 sticky top-0 bg-white z-10">
          {{ isEditing ? 'Editar Producto' : 'Nuevo Producto' }}
        </h2>
        
        <form @submit.prevent="saveProduct" class="space-y-4">
          <div>
            <label class="block text-slate-600 text-sm mb-1 font-bold">Nombre del Plato</label>
            <input v-model="form.name" type="text" required class="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-slate-800 focus:border-orange-500 outline-none transition" placeholder="Ej: Lomo Saltado">
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-slate-600 text-sm mb-1 font-bold">Categoría</label>
              <select v-model="form.category" class="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-slate-800 focus:border-orange-500 outline-none transition">
                <option>Comida</option>
                <option>Bebida</option>
                <option>Postre</option>
              </select>
            </div>
            <div>
              <label class="block text-slate-600 text-sm mb-1 font-bold">Precio (S/.)</label>
              <input v-model="form.price" type="number" step="0.50" required class="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-slate-800 focus:border-orange-500 outline-none transition" placeholder="0.00">
            </div>
          </div>

          <div>
            <label class="block text-slate-600 text-sm mb-2 font-bold">Imagen del Plato</label>
            <div class="flex gap-4 items-start">
               <div class="w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shrink-0 flex items-center justify-center relative group shadow-inner">
                 <img v-if="form.image" :src="form.image" class="w-full h-full object-cover">
                 <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8 text-slate-400 opacity-50"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
               </div>
               <div class="flex-1 space-y-2">
                 <label class="block w-full text-center bg-white hover:bg-gray-50 text-slate-600 text-xs md:text-sm font-bold py-2.5 md:py-2 rounded-lg cursor-pointer transition border border-gray-300 shadow-sm flex items-center justify-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
                   Subir Foto
                   <input type="file" accept="image/*" class="hidden" @change="handleFileUpload">
                 </label>
                 <input v-model="form.image" type="text" class="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-slate-600 focus:border-orange-500 outline-none" placeholder="O pega URL aquí...">
               </div>
            </div>
          </div>

          <div class="flex gap-3 mt-8 pt-4 border-t border-gray-100">
            <button type="button" @click="showModal = false" class="flex-1 bg-white border border-gray-300 text-slate-600 py-3 rounded-xl hover:bg-gray-50 transition font-bold">Cancelar</button>
            <button type="submit" class="flex-1 bg-orange-500 text-white py-3 rounded-xl hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition font-bold">
              {{ isEditing ? 'Guardar' : 'Crear' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="showDuplicateModal" class="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="showDuplicateModal = false"></div>
      <div class="relative bg-white rounded-2xl border border-orange-100 shadow-2xl w-full max-w-md p-6 md:p-8 text-center flex flex-col max-h-[90vh]">
        <div class="w-16 h-16 md:w-20 md:h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-500 border-4 border-orange-100 shadow-inner shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-8 h-8 md:w-10 md:h-10"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" /></svg>
        </div>
        <h3 class="text-xl font-bold text-slate-800 mb-2">Similitud Detectada</h3>
        <p class="text-slate-500 mb-4 text-sm">Encontramos <span class="font-bold text-orange-600">{{ duplicatedItems.length }}</span> plato(s) con un nombre similar en tu carta:</p>
        
        <div class="overflow-y-auto max-h-40 mb-6 bg-orange-50/50 rounded-xl border border-orange-100 text-left p-1 shadow-inner">
          <ul class="divide-y divide-orange-100/50">
            <li v-for="item in duplicatedItems" :key="item.id" class="flex justify-between items-center text-sm p-3 hover:bg-white rounded-lg transition-colors">
              <span class="font-bold text-slate-700">{{ item.name }}</span>
              <span class="text-orange-600 font-mono font-bold shrink-0 ml-2">S/. {{ Number(item.price).toFixed(2) }}</span>
            </li>
          </ul>
        </div>

        <p class="text-slate-500 mb-6 text-sm shrink-0">¿Estás seguro que deseas agregarlo de nuevo?</p>
        
        <div class="flex gap-3 shrink-0">
           <button @click="showDuplicateModal = false" class="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-slate-600 py-3 rounded-xl transition font-bold shadow-sm">Cancelar</button>
           <button @click="executeSave" class="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl shadow-lg shadow-orange-500/20 transition font-bold active:scale-95">Sí, guardar</button>
        </div>
      </div>
    </div>

    <div v-if="showDeleteModal" class="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="showDeleteModal = false"></div>
      <div class="relative bg-white rounded-2xl border border-red-100 shadow-2xl w-full max-w-sm p-6 md:p-8 text-center">
        <div class="w-16 h-16 md:w-20 md:h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 border-4 border-red-100 shadow-inner">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-8 h-8 md:w-10 md:h-10"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" /></svg>
        </div>
        <h3 class="text-xl font-bold text-slate-800 mb-2">¿Estás seguro?</h3>
        <p class="text-slate-500 mb-6 text-sm">Vas a eliminar <span class="text-slate-800 font-bold">"{{ productToDelete?.name }}"</span> de forma permanente.</p>
        <div class="flex gap-3">
           <button @click="showDeleteModal = false" class="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-slate-600 py-3 rounded-xl transition font-bold shadow-sm">Cancelar</button>
           <button @click="confirmDelete" class="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl shadow-lg shadow-red-500/20 transition font-bold active:scale-95">Sí, eliminar</button>
        </div>
      </div>
    </div>

    <Transition
      enter-active-class="transform ease-out duration-300 transition"
      enter-from-class="translate-y-10 opacity-0 sm:translate-y-0 sm:translate-x-10"
      enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
      leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="showToast" 
           class="fixed bottom-5 right-5 z-[100] bg-white border-l-4 text-slate-800 px-4 md:px-6 py-3 md:py-4 rounded-lg shadow-2xl flex items-center gap-3 md:gap-4 max-w-[90%] md:max-w-sm border border-gray-100"
           :class="toastType === 'warning' ? 'border-orange-500' : 'border-emerald-500'"
      >
        <div class="p-2 rounded-full shrink-0"
             :class="toastType === 'warning' ? 'text-orange-500 bg-orange-50' : 'text-emerald-500 bg-emerald-50'"
        >
          <svg v-if="toastType === 'success'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-5 h-5 md:w-6 md:h-6"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-5 h-5 md:w-6 md:h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" /></svg>
        </div>
        <div class="overflow-hidden">
          <h4 class="font-bold text-slate-800 text-sm truncate">{{ toastMessage }}</h4>
          <p class="text-xs text-slate-500 mt-0.5 leading-snug truncate">{{ toastDetails }}</p>
        </div>
      </div>
    </Transition>

  </div>
</template>