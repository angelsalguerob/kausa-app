//pages/reports.vue
<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { usePosStore } from '../stores/pos'

const store = usePosStore()

// 1. LÓGICA DE FECHAS Y RELOJ
const hoy = new Date()
const selectedYear = ref(hoy.getFullYear())
const selectedMonth = ref(hoy.getMonth()) 
const selectedDay = ref(hoy.getDate())

const currentTime = ref(new Date())
let clockInterval = null

const monthsNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const daysInMonth = ref([])
function generateDays() {
  const numDays = new Date(selectedYear.value, selectedMonth.value + 1, 0).getDate()
  daysInMonth.value = Array.from({ length: numDays }, (_, i) => i + 1)
}

function prevMonth() {
  if (selectedMonth.value === 0) {
    selectedMonth.value = 11
    selectedYear.value--
  } else {
    selectedMonth.value--
  }
  selectedDay.value = 1 
  generateDays()
}

function nextMonth() {
  if (selectedMonth.value === 11) {
    selectedMonth.value = 0
    selectedYear.value++
  } else {
    selectedMonth.value++
  }
  selectedDay.value = 1
  generateDays()
}

// 2. LÓGICA DE BASE DE DATOS Y FINANZAS
const orders = ref([])
const isLoading = ref(false)

const totalBruto = ref(0)
const totalEfectivo = ref(0)
const totalDigital = ref(0)
const totalPorCobrar = ref(0)

// 3. LÓGICA DE SELECCIÓN MÚLTIPLE
const selectedOrders = ref([])
const isBulkUpdating = ref(false)

const allSelected = computed({
  get: () => orders.value.length > 0 && selectedOrders.value.length === orders.value.length,
  set: (value) => {
    if (value) {
      selectedOrders.value = orders.value.map(o => o.id)
    } else {
      selectedOrders.value = []
    }
  }
})


function calcularMetricas() {
  let bruto = 0
  let efectivo = 0 // <--- Una sola 'c'
  let digital = 0
  let porCobrar = 0

  orders.value.forEach(order => {
    const monto = Number(order.total)
    bruto += monto
    const status = order.paymentStatus === 'Pagado' ? 'Efectivo' : order.paymentStatus

    if (status === 'Efectivo') {
      efectivo += monto // 🚀 AQUÍ ESTABA EL ERROR: ahora tiene una sola 'c'
    } else if (status === 'Yape / Plin' || status === 'Tarjeta') {
      digital += monto
    } else {
      porCobrar += monto 
    }
  })

  totalBruto.value = bruto
  totalEfectivo.value = efectivo
  totalDigital.value = digital
  totalPorCobrar.value = porCobrar
}

watch(selectedDay, async () => {
  selectedOrders.value = [] 
  await fetchOrders()
})

async function fetchOrders() {
  isLoading.value = true
  const formattedMonth = String(selectedMonth.value + 1).padStart(2, '0')
  const formattedDay = String(selectedDay.value).padStart(2, '0')
  const dateString = `${selectedYear.value}-${formattedMonth}-${formattedDay}`

  try {
    const data = await $fetch(`/api/orders/by-date?date=${dateString}`)
    orders.value = data.map(o => {
      let currentStatus = o.paymentStatus || 'Pendiente'
      if (currentStatus === 'Pagado') currentStatus = 'Efectivo'
      return { ...o, paymentStatus: currentStatus }
    })
    calcularMetricas()
  } catch (error) {
    console.error("Error al cargar las ventas:", error)
    orders.value = []
    calcularMetricas() 
  } finally {
    isLoading.value = false
  }
}

// 🚀 ACTUALIZACIÓN INDIVIDUAL (El combo desplegable)
async function actualizarPago(orden) {
  // Apagar la alerta global si se marca como pagado
  const estadosPagados = ['Efectivo', 'Yape / Plin', 'Tarjeta']
  if (estadosPagados.includes(orden.paymentStatus)) {
    store.apagarAlertaPagos()
  }

  try {
    await $fetch('/api/orders/update-payment', {
      method: 'POST',
      body: { id: orden.id, paymentStatus: orden.paymentStatus }
    })
    calcularMetricas()
  } catch (error) {
    alert('No se pudo actualizar el estado de pago. Revisa tu conexión.')
    await fetchOrders() 
  }
}

// 🚀 ACTUALIZACIÓN MASIVA (Botonera flotante)
function bulkUpdatePayment(nuevoStatus) {
  if (selectedOrders.value.length === 0) return

  // Apagar alerta global si es un método de pago válido
  const estadosPagados = ['Efectivo', 'Yape / Plin', 'Tarjeta']
  if (estadosPagados.includes(nuevoStatus)) {
    store.apagarAlertaPagos()
  }

  const idsToUpdate = [...selectedOrders.value]

  orders.value = orders.value.map(order => {
    if (idsToUpdate.includes(order.id)) {
      return { ...order, paymentStatus: nuevoStatus }
    }
    return order
  })

  calcularMetricas()
  selectedOrders.value = []

  Promise.all(idsToUpdate.map(id => {
    return $fetch('/api/orders/update-payment', {
      method: 'POST',
      body: { id, paymentStatus: nuevoStatus }
    })
  })).catch(error => {
    console.error('Error actualizando pagos en BD:', error)
    alert('Uy, hubo un problema de red. Actualizando con los datos reales del servidor...')
    fetchOrders() 
  })
}

// DESCARGAR EXCEL (CSV LATINO)
function exportToExcel() {
  if (orders.value.length === 0) {
    return alert('No hay ventas registradas en esta fecha para exportar.');
  }
  
  // 🚀 MAGIA AQUÍ: Cambiamos las comas (,) por punto y coma (;) para Excel Perú
  let csv = 'Ticket;Fecha y Hora;Mesa / Cliente;Cantidad;Producto;Entrada (Item 1);Segundo (Item 2);Bebida (Item 3);Postre (Item 4);Estado de Pago;Total Ticket (S/.)\n';
  
  orders.value.forEach(o => {
    // Limpiamos la fecha de comas o punto y comas para que no rompa el formato
    const fecha = new Date(o.createdAt).toLocaleString('es-PE').replace(/,|;/g, ''); 
    const ticketNum = o.dailyTicket || o.id; 
    const destino = (o.table || 'Caja').replace(/;/g, '-');
    const estadoPago = o.paymentStatus;
    const totalTicket = Number(o.total).toFixed(2);

    // Si es un pedido simple (sin descripción)
    if (!o.description) {
      csv += `${ticketNum};${fecha};${destino};1;Venta de Salón;-;-;-;-;${estadoPago};${totalTicket}\n`;
      return;
    }
    
    // Partimos el pedido por productos
    const productosEnElTicket = o.description.split(/,\s*(?![^\[]*\])/);

    productosEnElTicket.forEach(itemStr => {
      let cantidad = '1';
      let producto = itemStr.trim();
      let entrada = '-';
      let segundo = '-';
      let bebida = '-';
      let postre = '-';

      // Extraemos la cantidad (Ej: 2x Lomo)
      const qtyMatch = producto.match(/^(\d+)x\s+(.*)/);
      if (qtyMatch) {
        cantidad = qtyMatch[1];
        producto = qtyMatch[2];
      }

      // Extraemos las opciones del menú (Ej: [Ceviche, Lomo, Sin bebida, Flan])
      const detailsMatch = producto.match(/(.*?)\s*\[(.*?)\]$/);
      if (detailsMatch) {
        producto = detailsMatch[1].trim(); 
        const partesCombo = detailsMatch[2].split(',');
        if (partesCombo[0]) entrada = partesCombo[0].trim();
        if (partesCombo[1]) segundo = partesCombo[1].trim();
        if (partesCombo[2]) bebida = partesCombo[2].trim();
        if (partesCombo[3]) postre = partesCombo[3].trim();
      }

      // Quitamos cualquier punto y coma rebelde del nombre para no romper Excel
      producto = producto.replace(/;/g, '');
      
      // Armamos la fila con punto y coma
      csv += `${ticketNum};${fecha};${destino};${cantidad};${producto};${entrada};${segundo};${bebida};${postre};${estadoPago};${totalTicket}\n`;
    });
  });

  // Exportamos con codificación UTF-8 para que las tildes (ñ, á) se vean perfectas
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' }); 
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Reporte_Detallado_Kausa_${selectedDay.value}_${monthsNames[selectedMonth.value]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function formatTime(dateString) {
  if (!dateString) return '--:--'
  const date = new Date(dateString)
  return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })
}

onMounted(() => {
  generateDays()
  fetchOrders() 
  clockInterval = setInterval(() => { currentTime.value = new Date() }, 1000)
  setTimeout(() => {
    const activeBtn = document.getElementById(`day-btn-${selectedDay.value}`)
    if(activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, 100)
})

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval)
})

// Función auxiliar para seleccionar una orden en móvil
function toggleMobileSelection(orderId) {
  const index = selectedOrders.value.indexOf(orderId)
  if (index === -1) {
    selectedOrders.value.push(orderId)
  } else {
    selectedOrders.value.splice(index, 1)
  }
}
</script>

<template>
  <div class="min-h-[calc(100vh-80px)] bg-gray-50 p-4 md:p-6 pb-32 relative"> 
      <div class="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-black text-slate-800">Historial Financiero</h1>
        <p class="text-slate-500 text-sm md:text-base">Control de ingresos, cuentas por cobrar y rendimiento</p>
      </div>
      
      <div class="bg-white border border-gray-200 shadow-sm px-4 md:px-5 py-2 md:py-3 rounded-2xl flex items-center gap-3 w-max">
        <div class="bg-orange-100 text-orange-600 p-1.5 md:p-2 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5 md:w-6 md:h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
        </div>
        <div class="flex items-baseline gap-1.5 text-slate-700">
          <span class="font-mono font-black text-xl md:text-2xl tracking-widest">
            {{ currentTime.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) }}
          </span>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6 mb-6 md:mb-8">
      <div class="flex items-center justify-between mb-4 md:mb-6">
        <button @click="prevMonth" class="p-1.5 md:p-2 hover:bg-orange-50 rounded-lg text-slate-400 hover:text-orange-500 transition">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 md:w-6 md:h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        
        <div class="text-center">
          <span class="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-wide">{{ monthsNames[selectedMonth] }}</span>
          <span class="text-base md:text-lg font-bold text-orange-500 ml-2">{{ selectedYear }}</span>
        </div>

        <button @click="nextMonth" class="p-1.5 md:p-2 hover:bg-orange-50 rounded-lg text-slate-400 hover:text-orange-500 transition">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 md:w-6 md:h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        </button>
      </div>

      <div class="flex overflow-x-auto pb-2 md:pb-4 gap-2 md:gap-3 snap-x scrollbar-hide">
        <button 
          v-for="day in daysInMonth" 
          :key="day"
          :id="`day-btn-${day}`"
          @click="selectedDay = day"
          class="flex-shrink-0 w-14 h-16 md:w-16 md:h-20 rounded-xl flex flex-col items-center justify-center transition-all duration-200 border-2 snap-center"
          :class="selectedDay === day 
            ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/30 scale-105' 
            : 'bg-white border-gray-100 text-slate-600 hover:border-orange-200 hover:bg-orange-50'"
        >
          <span class="text-xs md:text-sm font-medium opacity-80">Día</span>
          <span class="text-xl md:text-2xl font-black">{{ day }}</span>
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="flex justify-center p-12">
      <div class="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
    </div>

    <div v-else>
      
      <div class="flex justify-end mb-4">
        <button 
          @click="exportToExcel"
          class="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl shadow-sm transition text-sm md:text-base"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 md:w-5 md:h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
          Descargar Excel
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
        <div class="bg-blue-600 text-white p-5 md:p-6 rounded-2xl flex justify-between items-center shadow-lg shadow-blue-600/20">
          <div>
            <p class="text-blue-100 font-bold text-xs md:text-sm uppercase tracking-wider mb-1">Ingreso Bruto Total</p>
            <p class="text-3xl md:text-4xl font-black">S/. {{ totalBruto.toFixed(2) }}</p>
            <p class="text-[10px] md:text-xs text-blue-200 mt-1 font-medium">Suma de Efectivo, Digital y Fiados</p>
          </div>
          <div class="p-2 md:p-3 bg-white/20 rounded-xl text-white">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6 md:w-8 md:h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" /></svg>
          </div>
        </div>
        
        <div class="bg-white border border-gray-200 p-5 md:p-6 rounded-2xl flex justify-between items-center shadow-sm">
          <div>
            <p class="text-slate-400 font-bold text-xs md:text-sm uppercase tracking-wider mb-1">Total Pedidos Emitidos</p>
            <p class="text-3xl md:text-4xl font-black text-slate-800">{{ orders.length }}</p>
          </div>
          <div class="p-2 md:p-3 bg-gray-100 rounded-xl text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6 md:w-8 md:h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        <div class="bg-emerald-50 border border-emerald-100 p-4 md:p-5 rounded-2xl flex justify-between items-center transition-all relative overflow-hidden group">
          <div class="absolute -right-4 -top-4 w-16 h-16 md:w-20 md:h-20 bg-white/50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <div class="relative z-10">
            <p class="text-emerald-600 font-bold text-[10px] md:text-xs uppercase tracking-wider mb-1">Efectivo Físico</p>
            <p class="text-xl md:text-2xl font-black text-emerald-700">S/. {{ totalEfectivo.toFixed(2) }}</p>
          </div>
          <div class="p-2 md:p-2.5 bg-emerald-100 rounded-xl text-emerald-600 relative z-10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5 md:w-6 md:h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.375c0 .621-.504 1.125-1.125 1.125H2.25m0 0h-.375c-.621 0-1.125-.504-1.125-1.125V21m12-3-3m-3.75 3c-.621 0-1.125-.504-1.125-1.125V18m1.5-1.5h4.5a.75.75 0 0 0 .75-.75v-1.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0-.75.75v1.5c0 .414.336.75.75.75Zm9.25-8.5h.008v.008h-.008v-.008Z" /></svg>
          </div>
        </div>

        <div class="bg-purple-50 border border-purple-100 p-4 md:p-5 rounded-2xl flex justify-between items-center transition-all relative overflow-hidden group">
          <div class="absolute -right-4 -top-4 w-16 h-16 md:w-20 md:h-20 bg-white/50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <div class="relative z-10">
            <p class="text-purple-600 font-bold text-[10px] md:text-xs uppercase tracking-wider mb-1">Yape / Plin / Tarjeta</p>
            <p class="text-xl md:text-2xl font-black text-purple-700">S/. {{ totalDigital.toFixed(2) }}</p>
          </div>
          <div class="p-2 md:p-2.5 bg-purple-200 rounded-xl text-purple-600 relative z-10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5 md:w-6 md:h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
          </div>
        </div>

        <div class="bg-amber-50 border border-amber-100 p-4 md:p-5 rounded-2xl flex justify-between items-center transition-all relative overflow-hidden group">
          <div class="absolute -right-4 -top-4 w-16 h-16 md:w-20 md:h-20 bg-white/50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <div class="relative z-10">
            <p class="text-amber-600 font-bold text-[10px] md:text-xs uppercase tracking-wider mb-1">Por Cobrar</p>
            <p class="text-xl md:text-2xl font-black text-amber-700">S/. {{ totalPorCobrar.toFixed(2) }}</p>
          </div>
          <div class="p-2 md:p-2.5 bg-amber-100 rounded-xl text-amber-600 relative z-10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5 md:w-6 md:h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
          </div>
        </div>
      </div>

      <div v-if="orders.length === 0" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 md:p-12 text-center text-slate-500">
         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-12 h-12 md:w-16 md:h-16 mb-4 opacity-40 mx-auto"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" /></svg>
         No hay ventas registradas el {{ selectedDay }} de {{ monthsNames[selectedMonth] }}.
      </div>

      <div v-else class="md:hidden space-y-3">
        <div class="flex items-center justify-between mb-2 px-1">
          <label class="flex items-center gap-2 text-sm font-bold text-slate-600">
            <input type="checkbox" v-model="allSelected" class="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer">
            Seleccionar Todos
          </label>
        </div>
        
        <div v-for="order in orders" :key="order.id" 
             class="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm relative overflow-hidden transition-all duration-200"
             :class="{'ring-2 ring-orange-500 bg-orange-50/30': selectedOrders.includes(order.id)}"
             @click="toggleMobileSelection(order.id)">
          
          <div class="absolute top-4 right-4 z-10" @click.stop>
            <input type="checkbox" :value="order.id" v-model="selectedOrders" class="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer">
          </div>

          <div class="flex justify-between items-start mb-3 pr-8">
            <div>
              <span class="font-mono font-black text-slate-800 text-base block">#{{ order.dailyTicket || order.id }}</span>
              <span class="text-xs text-slate-500 font-medium">{{ formatTime(order.createdAt) }}</span>
            </div>
            <div class="text-right">
              <span class="font-bold text-slate-800 text-sm block">{{ order.table || 'Caja' }}</span>
            </div>
          </div>

          <p class="text-slate-600 text-sm mb-4 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            {{ order.description || 'Venta de Salón' }}
          </p>

          <div class="flex justify-between items-center pt-3 border-t border-gray-100" @click.stop>
            <div class="flex-1 max-w-[140px]">
              <select 
                v-model="order.paymentStatus" 
                @change="actualizarPago(order)"
                class="w-full font-bold text-xs px-2 py-2 rounded-xl outline-none cursor-pointer transition shadow-sm border appearance-none text-center"
                :class="{
                  'bg-emerald-50 text-emerald-700 border-emerald-200': order.paymentStatus === 'Efectivo',
                  'bg-purple-50 text-purple-700 border-purple-200': order.paymentStatus === 'Yape / Plin' || order.paymentStatus === 'Tarjeta',
                  'bg-amber-50 text-amber-700 border-amber-200': order.paymentStatus === 'Fiado',
                  'bg-slate-50 text-slate-600 border-slate-200': order.paymentStatus === 'Pendiente'
                }"
              >
                <option value="Pendiente">Pendiente</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Yape / Plin">Yape / Plin</option>
                <option value="Tarjeta">Tarjeta (POS)</option>
                <option value="Fiado">Fiado</option>
              </select>
            </div>
            <span class="font-black text-lg text-slate-800 shrink-0">S/. {{ Number(order.total).toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <div class="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-100 text-sm text-slate-500">
              <th class="p-4 w-10 text-center">
                <input type="checkbox" v-model="allSelected" class="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer">
              </th>
              <th class="p-4 font-bold w-24 lg:w-32">Ticket</th>
              <th class="p-4 font-bold w-24 lg:w-32">Hora</th>
              <th class="p-4 font-bold w-32 lg:w-48">Mesa/Cliente</th>
              <th class="p-4 font-bold">Descripción</th>
              <th class="p-4 font-bold text-center w-32 lg:w-48">Estado</th>
              <th class="p-4 font-bold text-right w-24 lg:w-32">Monto</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order.id" class="border-b border-gray-50 hover:bg-orange-50/50 transition" :class="{'bg-orange-50': selectedOrders.includes(order.id)}">
              <td class="p-4 text-center">
                <input type="checkbox" :value="order.id" v-model="selectedOrders" class="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer">
              </td>
              <td class="p-4 font-mono font-bold text-slate-700">#{{ order.dailyTicket || order.id }}</td>
              <td class="p-4 text-sm font-medium text-slate-500 whitespace-nowrap">{{ formatTime(order.createdAt) }}</td>
              <td class="p-4 font-bold text-slate-800 text-sm whitespace-nowrap truncate">{{ order.table || 'Caja' }}</td>
              <td class="p-4 text-slate-600 text-sm max-w-md xl:max-w-xl truncate" :title="order.description">{{ order.description || 'Venta de Salón' }}</td>
              
              <td class="py-3 text-center px-2">
                <select 
                  v-model="order.paymentStatus" 
                  @change="actualizarPago(order)"
                  class="w-full font-bold text-xs px-2 py-1.5 rounded-lg outline-none cursor-pointer transition shadow-sm border appearance-none text-center focus:ring-2"
                  :class="{
                    'bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-emerald-200': order.paymentStatus === 'Efectivo',
                    'bg-purple-50 text-purple-700 border-purple-200 focus:ring-purple-200': order.paymentStatus === 'Yape / Plin' || order.paymentStatus === 'Tarjeta',
                    'bg-amber-50 text-amber-700 border-amber-200 focus:ring-amber-200': order.paymentStatus === 'Fiado',
                    'bg-slate-50 text-slate-600 border-slate-200 focus:ring-slate-200': order.paymentStatus === 'Pendiente'
                  }"
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Yape / Plin">Yape / Plin</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Fiado">Fiado</option>
                </select>
              </td>

              <td class="p-4 text-right font-black text-slate-800 whitespace-nowrap">S/. {{ Number(order.total).toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>

    <Transition
      enter-active-class="transform ease-out duration-300 transition"
      enter-from-class="translate-y-24 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-24 opacity-0"
    >
      <div v-if="selectedOrders.length > 0" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white p-3 md:p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col lg:flex-row items-center gap-3 md:gap-4 border border-slate-700 w-[95%] max-w-5xl">

        <div class="flex items-center justify-center lg:justify-start gap-3 shrink-0 w-full lg:w-auto px-2 lg:pl-2">
          <div class="bg-orange-500 text-white w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-black text-base md:text-lg shadow-inner">
            {{ selectedOrders.length }}
          </div>
          <div class="flex flex-col text-left">
            <span class="font-bold text-xs md:text-sm leading-tight text-white">Pedidos</span>
            <span class="text-[9px] md:text-[11px] text-slate-400 font-bold uppercase tracking-widest">Seleccionados</span>
          </div>
          
          <button @click="selectedOrders = []" :disabled="isBulkUpdating" class="lg:hidden ml-auto p-2 bg-slate-800 rounded-lg text-slate-400 border border-slate-700">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div class="hidden lg:block w-px h-10 bg-slate-700 mx-2"></div>

        <div class="flex-1 grid grid-cols-3 lg:flex flex-wrap lg:flex-nowrap items-center justify-center gap-2 w-full">
          <button @click="bulkUpdatePayment('Pendiente')" :disabled="isBulkUpdating" class="flex-1 min-w-[80px] lg:min-w-[100px] bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold text-xs md:text-sm py-2.5 md:py-3.5 rounded-xl transition shadow-sm">Pend.</button>
          <button @click="bulkUpdatePayment('Efectivo')" :disabled="isBulkUpdating" class="flex-1 min-w-[80px] lg:min-w-[100px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs md:text-sm py-2.5 md:py-3.5 rounded-xl transition shadow-sm">Efectivo</button>
          <button @click="bulkUpdatePayment('Yape / Plin')" :disabled="isBulkUpdating" class="flex-1 min-w-[80px] lg:min-w-[100px] bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-bold text-xs md:text-sm py-2.5 md:py-3.5 rounded-xl transition shadow-sm">Yape</button>
          <button @click="bulkUpdatePayment('Tarjeta')" :disabled="isBulkUpdating" class="flex-1 min-w-[80px] lg:min-w-[100px] bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold text-xs md:text-sm py-2.5 md:py-3.5 rounded-xl transition shadow-sm">Tarjeta</button>
          <button @click="bulkUpdatePayment('Fiado')" :disabled="isBulkUpdating" class="flex-1 min-w-[80px] lg:min-w-[100px] bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs md:text-sm py-2.5 md:py-3.5 rounded-xl transition shadow-sm">Fiado</button>
        </div>

        <div class="hidden lg:block w-px h-10 bg-slate-700 mx-2"></div>

        <button @click="selectedOrders = []" :disabled="isBulkUpdating" class="hidden lg:flex w-full lg:w-auto items-center justify-center gap-2 bg-slate-800 border border-slate-700 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 disabled:opacity-50 text-slate-300 px-5 py-3.5 rounded-xl transition group" title="Cancelar selección">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5 group-hover:scale-110 transition-transform"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>

      </div>
    </Transition>

  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
    display: none;

}
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
</style>