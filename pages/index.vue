<script setup>
import { onMounted, onUnmounted, computed, ref, nextTick, watch } from "vue"
import { useRouter } from "vue-router"
import { usePosStore } from "../stores/pos"

const store = usePosStore()
const router = useRouter()
let syncInterval = null
let clockInterval = null

// Variables de control
const isCheckingAuth = ref(true) 
const currentTime = ref(new Date())

// --- LÓGICA PARA EDITAR LA META ---
const showGoalModal = ref(false)
const tempGoal = ref(0)

function openGoalModal() {
  tempGoal.value = store.dailyGoal || 0
  showGoalModal.value = true
}

function saveNewGoal() {
  if (tempGoal.value > 0) {
    store.dailyGoal = parseFloat(tempGoal.value)
    localStorage.setItem('pos_daily_goal', store.dailyGoal)
  }
  showGoalModal.value = false
}

// 🚀 --- PULL TO REFRESH (LÓGICA TÁCTIL) ---
const touchStartY = ref(0)
const touchCurrentY = ref(0)
const isPulling = ref(false)
const pullDistance = computed(() => Math.max(0, touchCurrentY.value - touchStartY.value))
const showRefreshSpinner = computed(() => pullDistance.value > 60)
const isManualRefreshing = ref(false)

function handleTouchStart(e) {
  if (window.scrollY === 0) {
    touchStartY.value = e.touches[0].clientY
    isPulling.value = true
  }
}

function handleTouchMove(e) {
  if (!isPulling.value) return
  touchCurrentY.value = e.touches[0].clientY
  if (pullDistance.value > 0) {
    e.preventDefault()
  }
}

async function handleTouchEnd() {
  if (!isPulling.value) return
  
  if (pullDistance.value > 80 && ["admin", "glorianora"].includes(store.user?.role)) {
    isManualRefreshing.value = true
    try {
      await store.loadStats()
    } catch (e) {
      console.error(e)
    } finally {
      setTimeout(() => { isManualRefreshing.value = false }, 500)
    }
  }
  
  isPulling.value = false
  touchStartY.value = 0
  touchCurrentY.value = 0
}

onMounted(() => {
  // Eventos para el Pull to Refresh
  document.addEventListener('touchstart', handleTouchStart, { passive: true })
  document.addEventListener('touchmove', handleTouchMove, { passive: false })
  document.addEventListener('touchend', handleTouchEnd)

  // 1. Iniciamos el reloj
  clockInterval = setInterval(() => {
    currentTime.value = new Date()
  }, 1000)

  // 2. Verificación de usuario y carga de pantalla
  setTimeout(async () => {
    if (!store.user) {
      router.push("/login")
      return
    }
    
    isCheckingAuth.value = false

    // 3. CARGAMOS LA MEMORIA DEL CHAT
    const hoy = new Date().toDateString()
    const diaGuardado = localStorage.getItem('kausa_chat_date')

    if (diaGuardado === hoy) {
      const savedChat = localStorage.getItem('kausa_chat_history')
      const savedApi = localStorage.getItem('kausa_api_history')
      
      if (savedChat && savedApi) {
        chatHistory.value = JSON.parse(savedChat)
        apiHistory.value = JSON.parse(savedApi)
        
        if (chatHistory.value.length > 0) {
          isChatActive.value = true
          
          nextTick(() => {
            setTimeout(() => {
              scrollToBottom()
            }, 300)
          })
        }
      }
    } else {
      localStorage.removeItem('kausa_chat_history')
      localStorage.removeItem('kausa_api_history')
      localStorage.setItem('kausa_chat_date', hoy)
    }

    if (typeof isChatLoaded !== 'undefined') {
      isChatLoaded.value = true;
    }

    // 4. CARGAMOS ESTADÍSTICAS EN SEGUNDO PLANO
    if (["admin", "glorianora"].includes(store.user.role)) {
      store.loadStats()
      
      const savedGoal = localStorage.getItem('pos_daily_goal')
      if (savedGoal) {
        store.dailyGoal = parseFloat(savedGoal)
      } else {
        store.initDailyGoal() 
      }
      
      syncInterval = setInterval(() => {
        store.loadStats()
      }, 15000)
    }

  }, 150)
})

onUnmounted(() => {
  if (syncInterval) clearInterval(syncInterval)
  if (clockInterval) clearInterval(clockInterval)
  document.removeEventListener('touchstart', handleTouchStart)
  document.removeEventListener('touchmove', handleTouchMove)
  document.removeEventListener('touchend', handleTouchEnd)
})

// --- LÓGICA DEL RELOJ MEJORADA ---
const timeParts = computed(() => {
  const fullTime = currentTime.value.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  })
  
  const match = fullTime.match(/([\d:]+)\s*(.*)/)
  return {
    time: match ? match[1] : fullTime,
    ampm: match ? match[2].replace(/\./g, '').trim().toUpperCase() : ''
  }
})

const dateString = computed(() => {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  const rawDate = currentTime.value.toLocaleDateString('es-PE', options)
  return rawDate.charAt(0).toUpperCase() + rawDate.slice(1) 
})


const roleNames = {
  admin: "Soporte TI",
  GloriaNora: "Gerencia General",
  Usuarios: "Salón / Meseros",
  Chef: "Jefatura de Cocina",
}

const goalProgress = computed(() => {
  if (store.dailyGoal <= 0) return 0
  const ventas = store.stats?.totalVentas || 0
  const percentage = (ventas / store.dailyGoal) * 100
  return Math.min(Math.floor(percentage), 100)
})

const isGoalReached = computed(() => {
  const ventas = store.stats?.totalVentas || 0
  return ventas >= store.dailyGoal && store.dailyGoal > 0
})

const surplusAmount = computed(() => {
  if (!isGoalReached.value) return 0
  const ventas = store.stats?.totalVentas || 0
  return ventas - store.dailyGoal
})

// --- LÓGICA DE KAUSABOT ---
const chatHistory = ref([]) 
const apiHistory = ref([])  
const isLoadingAI = ref(false)
const userMessage = ref('')
const chatInputRef = ref(null)
const isChatActive = ref(false)
const isChatLoaded = ref(false)
const chatContainer = ref(null) 

watch(chatHistory, (nuevoHistorial) => {
  localStorage.setItem('kausa_chat_history', JSON.stringify(nuevoHistorial))
}, { deep: true })

watch(apiHistory, (nuevoApiHistorial) => {
  localStorage.setItem('kausa_api_history', JSON.stringify(nuevoApiHistorial))
}, { deep: true })

function scrollToBottom() {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

async function enviarMensajeAI(mensajeOculto = null) {
  isLoadingAI.value = true
  isChatActive.value = true
  
  const mensajeTexto = mensajeOculto || userMessage.value
  if (!mensajeTexto) return

  if (!mensajeOculto) {
    chatHistory.value.push({ role: 'user', text: userMessage.value })
  }
  
  apiHistory.value.push({ role: 'user', parts: [{ text: mensajeTexto }] })
  userMessage.value = '' 
  
  await nextTick()
  scrollToBottom()

  const analizarInteligenciaNegocio = (listaPedidos) => {
    if (!listaPedidos || listaPedidos.length === 0) {
      return { topPlato: "Ninguno", bottomPlato: "Ninguno", mesaTop: "Ninguna", pagoTop: "Ninguno", deudaFiada: 0 };
    }

    const conteoPlatos = {};
    const conteoMesas = {};
    const conteoPagos = {};
    let deudaTotal = 0;

    listaPedidos.forEach(order => {
      const descripcion = order.description || 'Venta General';
      descripcion.split(',').forEach(item => {
        const match = item.trim().match(/^(\d+)\s*[xX]\s+(.+)$/);
        if (match) {
          conteoPlatos[match[2].trim()] = (conteoPlatos[match[2].trim()] || 0) + parseInt(match[1], 10);
        } else {
          conteoPlatos[item.trim()] = (conteoPlatos[item.trim()] || 0) + 1;
        }
      });

      if (order.table && !order.table.toLowerCase().includes('llevar')) {
        conteoMesas[order.table] = (conteoMesas[order.table] || 0) + 1;
      }

      const metodo = order.paymentStatus || 'Pendiente';
      conteoPagos[metodo] = (conteoPagos[metodo] || 0) + 1;
      
      if (metodo.toLowerCase() === 'fiado' || metodo.toLowerCase() === 'pendiente') {
        deudaTotal += (order.total || 0);
      }
    });

    const getGanador = (obj) => Object.keys(obj).length > 0 ? Object.keys(obj).reduce((a, b) => obj[a] > obj[b] ? a : b) : "Ninguno";
    
    const platosKeys = Object.keys(conteoPlatos);
    let platoMenosVendido = "Ninguno";
    if (platosKeys.length > 0) {
      platosKeys.sort((a, b) => conteoPlatos[b] - conteoPlatos[a]);
      platoMenosVendido = platosKeys[platosKeys.length - 1];
    }

    return { 
      topPlato: getGanador(conteoPlatos), 
      bottomPlato: platoMenosVendido,
      mesaTop: getGanador(conteoMesas),
      pagoTop: getGanador(conteoPagos),
      deudaFiada: deudaTotal
    };
  };

  const clientesLlevarHoy = store.orders
    .filter(o => o.table && o.table.toLowerCase().includes('llevar'))
    .map(o => {
      const hora = o.createdAt ? new Date(o.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Hace un rato';
      return `${o.table.replace(/para llevar\s*-\s*/i, '').trim()} (${hora})`;
    }).join(', ');

  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  const fechaAyerStr = ayer.toLocaleDateString('en-CA');

  let ventasAyer = 0;
  let pedidosAyer = 0;
  let analisisAyer = { topPlato: "Sin datos", bottomPlato: "Sin datos", mesaTop: "Sin datos", pagoTop: "Sin datos", deudaFiada: 0 };
  let caserosLlevarAyer = "Nadie registrado";

  let ventasSemana = 0;
  let pedidosSemana = 0;
  let fiadoSemana = 0; 
  let desgloseDias = ""; 

  let analisisHoyReal = { topPlato: "Aún sin datos", bottomPlato: "Aún sin datos", mesaTop: "Aún sin datos", pagoTop: "Aún sin datos", deudaFiada: 0 };

  try {
    const promesasDias = [];
    const nombresDias = []; 

    const fHoyStr = hoy.toLocaleDateString('en-CA');
    const promesaHoy = $fetch('/api/orders/by-date', { query: { date: fHoyStr } }).catch(() => []);

    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(hoy.getDate() - i);
      const nombreBonito = d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
      nombresDias.push(nombreBonito);
      promesasDias.push($fetch('/api/orders/by-date', { query: { date: d.toLocaleDateString('en-CA') } }).catch(() => []));
    }

    const [reporteHoy, ...resultadosSemana] = await Promise.all([promesaHoy, ...promesasDias]);

    if (reporteHoy && reporteHoy.length > 0) {
      analisisHoyReal = analizarInteligenciaNegocio(reporteHoy);
    }

    const reporteAyer = resultadosSemana[0] || [];
    
    resultadosSemana.forEach((diaReporte, index) => {
      let vDia = 0;
      let pDia = 0;
      let intelDia = { topPlato: "Ninguno", bottomPlato: "Ninguno", mesaTop: "Ninguna", pagoTop: "Ninguno", deudaFiada: 0 }; 
      
      if (diaReporte && diaReporte.length > 0) {
        vDia = diaReporte.reduce((acc, order) => acc + (order.total || 0), 0);
        pDia = diaReporte.length;
        intelDia = analizarInteligenciaNegocio(diaReporte); 
      }
      ventasSemana += vDia;
      pedidosSemana += pDia;
      fiadoSemana += intelDia.deudaFiada;
      
      desgloseDias += `\n    - ${nombresDias[index]}: S/. ${vDia.toFixed(2)} (${pDia} pedidos) | Top: ${intelDia.topPlato} | Menos: ${intelDia.bottomPlato} | Mesa Fav: ${intelDia.mesaTop} | Pago Fav: ${intelDia.pagoTop} | Fiado: S/. ${intelDia.deudaFiada.toFixed(2)}`;
    });

    if (reporteAyer.length > 0) {
      ventasAyer = reporteAyer.reduce((acc, order) => acc + (order.total || 0), 0);
      pedidosAyer = reporteAyer.length;
      analisisAyer = analizarInteligenciaNegocio(reporteAyer);
      
      const listaLlevarAyer = [];
      reporteAyer.forEach(order => {
        if (order.table && order.table.toLowerCase().includes('llevar')) {
          const horaAyer = new Date(order.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
          listaLlevarAyer.push(`${order.table.replace(/para llevar\s*-\s*/i, '').trim()} a las ${horaAyer}`);
        }
      });
      if (listaLlevarAyer.length > 0) caserosLlevarAyer = listaLlevarAyer.join(', ');
    }
  } catch (err) {
    console.error("Falla al obtener los reportes:", err);
  }

  const resumenHoy = {
    totalVentas: store.stats?.totalVentas || 0,
    totalPedidos: store.stats?.count || 0,
    fecha: hoy.toLocaleDateString('en-CA'),
    caserosLlevar: clientesLlevarHoy || "Aún no hay pedidos para llevar",
    platoTop: analisisHoyReal.topPlato,
    platoBottom: analisisHoyReal.bottomPlato,
    mesaFavorita: analisisHoyReal.mesaTop,
    metodoPago: analisisHoyReal.pagoTop,
    cuentasPorCobrar: analisisHoyReal.deudaFiada
  };

  const memoriaAyerYsemana = `
    DATOS DEL PASADO (AYER - ${fechaAyerStr}):
    - Venta Total: S/. ${ventasAyer.toFixed(2)} (${pedidosAyer} pedidos)
    - Inteligencia de Platos: Más vendido (${analisisAyer.topPlato}), Menos vendido (${analisisAyer.bottomPlato})
    - Inteligencia Operativa: Mesa más usada (${analisisAyer.mesaTop}), Método de pago preferido (${analisisAyer.pagoTop})
    - Dinero Fiado/Pendiente ayer: S/. ${analisisAyer.deudaFiada.toFixed(2)}
    - Clientes "Para Llevar": ${caserosLlevarAyer}
    
    DESGLOSE DE LOS ÚLTIMOS 7 DÍAS (Análisis profundo):${desgloseDias}
    
    RENDIMIENTO ACUMULADO (SEMANA):
    - Ventas Totales: S/. ${ventasSemana.toFixed(2)} (${pedidosSemana} pedidos)
    - Deuda Total Acumulada (Fiados): S/. ${fiadoSemana.toFixed(2)}
  `;

  try {
    const data = await $fetch('/api/ai/chat', {
      method: 'POST',
      body: { 
        history: apiHistory.value.slice(-6),
        resumenDia: resumenHoy, 
        datosHistoricos: memoriaAyerYsemana 
      }
    });

    chatHistory.value.push({ role: 'bot', text: data.reply });
    apiHistory.value.push({ role: 'model', parts: [{ text: data.reply }] });
    await nextTick();
    scrollToBottom();
  } catch (error) {
    apiHistory.value.pop();
    chatHistory.value.push({ role: 'bot', text: "Uy coquita, se me fue la señal contando los fiados. ¡Reintenta!" });
  } finally {
    isLoadingAI.value = false
    await nextTick() 
    if (chatInputRef.value) {
      chatInputRef.value.focus() 
    }
  }
}

function iniciarAnalisis() {
  enviarMensajeAI("Hola KausaBot, hazme un resumen estratégico de las ventas de hoy y dame un consejo operativo.")
}
</script>

<template>
  <div v-if="isCheckingAuth" class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="flex flex-col items-center gap-4">
      <div class="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
      <p class="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">Cargando perfil...</p>
    </div>
  </div>

  <div v-else-if="store.user" class="min-h-screen bg-gray-50 p-4 md:p-6 relative">
    
    <div 
      class="absolute top-0 left-1/2 -translate-x-1/2 flex justify-center items-center pointer-events-none transition-transform z-50"
      :style="`transform: translateY(${Math.min(pullDistance - 50, 20)}px); opacity: ${pullDistance > 20 ? 1 : 0};`"
    >
      <div class="bg-white rounded-full p-2 shadow-md border border-gray-100 flex items-center justify-center" :class="(showRefreshSpinner || isManualRefreshing) ? 'animate-spin' : ''">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-6 h-6 text-orange-500"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
      
      <div class="lg:col-span-2 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-5 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
        <div class="flex items-center gap-4 md:gap-5 w-full sm:w-auto">
          <img
            :src="`https://ui-avatars.com/api/?name=${encodeURIComponent(store.user.name)}&background=f97316&color=fff`"
            class="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-orange-200 shadow-sm"
            alt="Avatar"
          />
          <div>
            <h1 class="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
              Hola, {{ store.user.name }}
            </h1>
            <p class="text-slate-500 text-xs md:text-sm font-medium mt-1 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 text-orange-500"><path stroke-linecap="round" stroke-linejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59" /></svg>
              {{ roleNames[store.user.role] }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 flex flex-col justify-center items-center relative min-h-[100px] md:min-h-[120px]">
        <div class="text-center flex flex-col items-center justify-center w-full">
          <div class="flex items-baseline gap-2">
            <span class="text-slate-800 font-mono text-3xl md:text-4xl xl:text-5xl font-black tracking-widest leading-none drop-shadow-sm">
              {{ timeParts.time }}
            </span>
            <span class="text-slate-400 font-black text-sm md:text-lg uppercase tracking-widest">
              {{ timeParts.ampm }}
            </span>
          </div>
          <span class="text-slate-400 text-[9px] md:text-[10px] xl:text-xs font-bold uppercase tracking-widest mt-2 md:mt-3">
            {{ dateString }}
          </span>
        </div>
      </div>

    </div>

    <div class="flex gap-4 mb-6 md:mb-8 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
      <NuxtLink
        v-if="['admin', 'glorianora'].includes(store.user?.role)"
        to="/inventory"
        class="snap-center flex-1 px-5 md:px-6 py-3 md:py-4 bg-white hover:bg-gray-50 text-slate-700 border border-gray-200 rounded-xl font-bold transition flex items-center justify-center gap-3 shadow-sm group min-w-[160px] md:min-w-[180px]"
      >
        <div class="bg-blue-100 text-blue-600 p-2 rounded-lg group-hover:scale-110 transition">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>
        </div>
        Inventario
      </NuxtLink>

      <NuxtLink
        v-if="['admin', 'glorianora', 'mesero'].includes(store.user?.role)"
        to="/pos"
        class="snap-center flex-1 px-5 md:px-6 py-3 md:py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-3 shadow-lg shadow-orange-500/20 group min-w-[160px] md:min-w-[180px]"
      >
        <div class="bg-white/20 p-2 rounded-lg group-hover:scale-110 transition text-white">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>
        </div>
        Vender
      </NuxtLink>

      <NuxtLink
        v-if="['admin', 'glorianora', 'cocina'].includes(store.user?.role)"
        to="/kitchen"
        class="snap-center flex-1 px-5 md:px-6 py-3 md:py-4 bg-white hover:bg-gray-50 text-slate-700 border border-gray-200 rounded-xl font-bold transition flex items-center justify-center gap-3 shadow-sm group min-w-[160px] md:min-w-[180px]"
      >
        <div class="bg-red-100 text-red-600 p-2 rounded-lg group-hover:scale-110 transition">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" /></svg>
        </div>
        Cocina
      </NuxtLink>
    </div>

    <div v-if="['admin', 'glorianora'].includes(store.user?.role)" class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      
      <div class="xl:col-span-2 flex flex-col gap-4 md:gap-6">
        
        <div class="bg-white p-5 md:p-8 rounded-2xl border transition-colors duration-500 shadow-sm relative overflow-hidden" :class="isGoalReached ? 'border-emerald-200' : 'border-gray-200'">
          <div class="absolute top-0 right-0 p-4">
            <span
              :class="store.isWeekend ? 'bg-purple-100 text-purple-600 border border-purple-200' : 'bg-blue-100 text-blue-600 border border-blue-200'"
              class="text-[9px] md:text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1.5"
            >
              <svg v-if="store.isWeekend" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3"><path fill-rule="evenodd" d="M13.5 4.938a7 7 0 1 1-9.006 1.737c.202-.257.59-.218.793.039.278.352.594.672.943.954.332.269.786-.049.773-.476a5.977 5.977 0 0 1 .572-2.759 6.026 6.026 0 0 1 2.486-2.665c.247-.14.55-.016.677.238A6.967 6.967 0 0 0 13.5 4.938ZM14 12a4 4 0 0 1-4 4c-1.913 0-3.52-1.398-3.91-3.182-.093-.429.44-.643.814-.413a4.043 4.043 0 0 0 1.601.564c.303.038.531-.24.51-.544a5.975 5.975 0 0 1 1.315-4.192.447.447 0 0 1 .431-.16A4.001 4.001 0 0 1 14 12Z" clip-rule="evenodd" /></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3"><path d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15.657 5.404a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM6.464 14.596a.75.75 0 1 0-1.06-1.06l-1.06 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10ZM14.596 15.657a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.06 1.06l1.06 1.06ZM5.404 6.464a.75.75 0 0 0 1.06-1.06l-1.06-1.06a.75.75 0 1 0-1.06 1.06l1.06 1.06Z" /></svg>
              <span class="hidden sm:inline">{{ store.isWeekend ? "Fin de Semana" : "Día Normal" }}</span>
            </span>
          </div>

          <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mt-6 md:mt-0">
            <div class="flex-1">
              
              <div class="flex items-center justify-between mb-4">
                <span class="text-xs font-black uppercase tracking-widest" :class="isGoalReached ? 'text-emerald-500' : 'text-slate-400'">
                  Progreso del Día
                </span>
                <button 
                  @click="openGoalModal" 
                  class="flex items-center gap-2 text-xs md:text-sm font-black text-slate-600 hover:text-slate-900 transition bg-slate-100 hover:bg-slate-200 px-3 md:px-4 py-2 rounded-xl border border-slate-300 shadow-sm"
                  title="Editar Meta"
                >
                  Meta: S/. {{ store.dailyGoal.toFixed(0) }}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5 md:w-4 md:h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>
                </button>
              </div>
              
              <div class="flex items-end gap-2 mb-4">
                <span class="text-4xl md:text-6xl font-black transition-colors duration-500" :class="isGoalReached ? 'text-emerald-600' : 'text-slate-800'">
                  S/. {{ (store.stats?.totalVentas || 0).toFixed(2) }}
                </span>
              </div>

              <div class="w-full bg-slate-100 h-3 md:h-4 rounded-full overflow-hidden flex relative border border-slate-200/50">
                <div
                  class="transition-all duration-1000 ease-out h-full rounded-full"
                  :class="isGoalReached ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-gradient-to-r from-orange-400 to-orange-500'"
                  :style="{ width: goalProgress + '%' }"
                ></div>
              </div>
            </div>

            <div class="flex flex-col items-center justify-center min-w-[140px] md:min-w-[160px] px-6 py-4 md:py-5 rounded-2xl border transition-colors duration-500"
                 :class="isGoalReached ? 'bg-emerald-50 border-emerald-100' : 'bg-orange-50 border-orange-100'">
              <span class="text-3xl md:text-4xl font-black mb-1" :class="isGoalReached ? 'text-emerald-600' : 'text-orange-600'">
                {{ goalProgress }}%
              </span>
              <span class="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-center" :class="isGoalReached ? 'text-emerald-500' : 'text-orange-400'">
                {{ isGoalReached ? 'Completado' : 'De la meta' }}
              </span>
            </div>
          </div>

          <div v-if="isGoalReached" class="mt-6 p-4 bg-emerald-500 text-white rounded-xl flex items-center justify-between shadow-lg shadow-emerald-500/20 border border-emerald-400">
            <div class="flex items-center gap-3">
              <div class="bg-white/20 p-2 rounded-lg hidden sm:block">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
              </div>
              <div>
                <h4 class="font-black text-base md:text-lg leading-tight">¡Meta Superada!</h4>
                <p class="text-emerald-100 text-xs md:text-sm font-medium">Generando ganancias extra.</p>
              </div>
            </div>
            <div class="text-right bg-white/10 px-3 md:px-4 py-2 rounded-lg border border-white/20">
              <span class="block text-[9px] md:text-[10px] font-black uppercase tracking-widest text-emerald-100 mb-0.5">Superávit</span>
              <span class="text-lg md:text-2xl font-black">+ S/. {{ surplusAmount.toFixed(0) }}</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          
          <div class="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group h-max">
            <div class="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
            <div class="relative z-10">
              <div class="flex items-center justify-between mb-2 md:mb-4">
                <p class="text-slate-400 font-bold uppercase text-xs tracking-wider">Caja</p>
                <div class="p-2 md:p-2.5 bg-emerald-100 text-emerald-600 rounded-xl border border-emerald-200 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4 md:w-5 md:h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                </div>
              </div>
              <p class="text-3xl md:text-4xl font-black text-slate-800">S/. {{ (store.stats?.totalPagado || 0).toFixed(0) }}</p>
            </div>
          </div>

          <div class="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group h-max">
            <div class="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
            <div class="relative z-10">
              <div class="flex items-center justify-between mb-2 md:mb-4">
                <p class="text-slate-400 font-bold uppercase text-xs tracking-wider">Atendidos</p>
                <div class="p-2 md:p-2.5 bg-blue-100 text-blue-600 rounded-xl border border-blue-200 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4 md:w-5 md:h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                </div>
              </div>
              <p class="text-3xl md:text-4xl font-black text-slate-800">{{ store.stats?.count || 0 }}</p>
            </div>
          </div>

          <div class="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group h-max">
            <div class="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
            <div class="relative z-10">
              <div class="flex items-center justify-between mb-2 md:mb-4">
                <p class="text-slate-400 font-bold uppercase text-xs tracking-wider">Por Cobrar</p>
                <div class="p-2 md:p-2.5 bg-amber-100 text-amber-600 rounded-xl border border-amber-200 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4 md:w-5 md:h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                </div>
              </div>
              <p class="text-3xl md:text-4xl font-black text-slate-800">S/. {{ (store.stats?.totalPorCobrar || 0).toFixed(0) }}</p>
            </div>
          </div>

        </div>
      </div>

      <div class="xl:col-span-1 h-[500px] md:h-[550px] mb-8 md:mb-0">
        <div class="bg-gradient-to-br from-indigo-900 to-slate-900 p-1 rounded-3xl shadow-xl overflow-hidden relative group h-full flex flex-col">
          <div class="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none"></div>
          <div class="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-fuchsia-500/20 blur-3xl rounded-full pointer-events-none"></div>
          
          <div class="relative bg-slate-900/60 backdrop-blur-xl p-5 md:p-6 rounded-[22px] flex flex-col h-full z-10">
            
            <div class="flex items-center gap-3 mb-4 pb-4 border-b border-white/10 shrink-0">
              <div class="bg-indigo-500/20 p-2 md:p-2.5 rounded-xl border border-indigo-400/30 text-indigo-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 md:w-6 md:h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09l2.846.813-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>
              </div>
              <div>
                <h3 class="text-base md:text-lg font-black text-white tracking-wide leading-none">KausaBot AI</h3>
                <span class="text-indigo-300/70 text-[9px] md:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 mt-1">
                  <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> En línea
                </span>
              </div>
            </div>

            <div ref="chatContainer" class="flex-1 overflow-y-auto pr-2 mb-4 flex flex-col gap-4 custom-scroll scrollbar-hide">
              
              <div v-if="!isChatLoaded" class="h-full flex items-center justify-center">
                <span class="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin"></span>
              </div>

              <div v-else-if="!isChatActive" class="h-full flex flex-col items-center justify-center text-center">
                <p class="text-indigo-200/50 mb-6 max-w-sm text-xs md:text-sm">Inicia el análisis para descubrir patrones de venta o pregúntame qué cocinar para mañana.</p>
                <button 
                  @click="iniciarAnalisis" 
                  class="bg-indigo-500 hover:bg-indigo-400 text-white px-5 md:px-6 py-2.5 md:py-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center gap-2 text-sm md:text-base"
                >
                  Generar Resumen
                </button>
              </div>

              <template v-else>
                <div 
                  v-for="(msg, index) in chatHistory" 
                  :key="index"
                  class="max-w-[90%] md:max-w-[85%] rounded-2xl p-3 md:p-4 text-xs md:text-sm font-medium leading-relaxed"
                  :class="msg.role === 'user' 
                    ? 'bg-indigo-500 text-white self-end rounded-tr-sm' 
                    : 'bg-white/10 text-indigo-50 self-start rounded-tl-sm border border-white/5'"
                >
                  <div class="whitespace-pre-line">{{ msg.text }}</div>
                </div>
                
                <div v-if="isLoadingAI" class="bg-white/10 border border-white/5 self-start rounded-2xl rounded-tl-sm p-3 w-16 flex justify-center gap-1">
                  <span class="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce"></span>
                  <span class="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" style="animation-delay: 0.1s"></span>
                  <span class="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
                </div>
              </template>
            </div>

            <div v-if="isChatActive" class="relative mt-auto shrink-0">
              <input 
                ref="chatInputRef"
                v-model="userMessage" 
                @keyup.enter="enviarMensajeAI()"
                type="text" 
                placeholder="Pregúntale a KausaBot..." 
                class="w-full bg-black/30 border border-white/10 rounded-xl py-2.5 md:py-3 pl-4 pr-12 text-sm md:text-base text-white placeholder-indigo-200/40 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition"
                :disabled="isLoadingAI"
              >
              <button 
                @click="enviarMensajeAI()"
                :disabled="!userMessage || isLoadingAI"
                class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 md:p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-400 disabled:opacity-50 disabled:bg-slate-700 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4"><path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" /></svg>
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>

    <div v-if="!['admin', 'glorianora'].includes(store.user?.role)" class="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm text-center py-16 mt-8">
      <div class="w-20 h-20 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-orange-100">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-10 h-10"><path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" /></svg>
      </div>
      <h2 class="text-2xl font-black text-slate-800 mb-2">Todo listo en tu estación</h2>
      <p class="text-slate-500 max-w-md mx-auto font-medium text-sm md:text-base">Selecciona una de las herramientas en la parte superior para comenzar a trabajar. El reloj ya está sincronizado.</p>
    </div>

    <div v-if="showGoalModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" @click="showGoalModal = false"></div>
      <div class="relative bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-sm w-full p-6 md:p-8 text-center">
        <div class="w-14 h-14 md:w-16 md:h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 text-blue-500 border border-blue-100">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-6 h-6 md:w-8 md:h-8"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
        </div>
        <h3 class="text-xl md:text-2xl font-black text-slate-800 mb-2">Editar Meta Diaria</h3>
        <p class="text-slate-500 mb-6 text-xs md:text-sm">Define la expectativa de ingresos para motivar al equipo hoy.</p>
        
        <div class="mb-6 relative">
          <span class="absolute left-4 top-3.5 md:top-4 font-black text-slate-400">S/.</span>
          <input 
            v-model="tempGoal" 
            type="number" 
            step="10"
            class="w-full bg-gray-50 text-slate-800 font-black text-xl md:text-2xl pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
          >
        </div>

        <div class="flex gap-3">
          <button @click="showGoalModal = false" class="flex-1 bg-white border border-gray-300 text-slate-600 font-bold py-2.5 md:py-3 rounded-xl hover:bg-gray-50 transition shadow-sm">
            Cancelar
          </button>
          <button @click="saveNewGoal" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 md:py-3 rounded-xl shadow-md transition active:scale-95 flex items-center justify-center">
            Guardar
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Ocultar barra de scroll para el carrusel de botones (App Feel) */
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
.scrollbar-hide {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
}

/* Scroll custom para el chat */
.custom-scroll::-webkit-scrollbar {
    width: 4px;
}
.custom-scroll::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
    border-radius: 10px;
}
.custom-scroll::-webkit-scrollbar-thumb {
    background: rgba(99, 102, 241, 0.2); 
    border-radius: 10px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(99, 102, 241, 0.5);
}
</style>