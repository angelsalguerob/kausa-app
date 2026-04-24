// stores/pos.ts
import { defineStore } from 'pinia'

export interface Product {
  id: number | string
  name: string
  price: number
  category: string
  image: string
  type?: string
  options?: {
    entradas: string[]
    segundos: string[]
    bebidas: string[]
    postres?: string[]
  }
}

export interface CartItem extends Product {
  quantity: number
}

export interface Order {
  id: string
  dailyTicket?: number
  items: CartItem[]
  total: number
  date: Date | string
  status: 'Pendiente' | 'Listo' | 'Entregado' // 🚀 NUEVO: Agregamos el estado 'Entregado' al tipo
  table?: string 
  description?: string
}

export interface User {
  id: string
  name: string
  role: string
  icon: string
}

export interface Table {
  id?: string
  name: string
  type: string
  icon: string
  pos_x?: number
  pos_y?: number
}

export const usePosStore = defineStore('pos', {
  state: () => ({
    user: useCookie<User | null>('kausa_user').value || null,
    products: [] as Product[],
    cart: [] as CartItem[],
    orders: [] as Order[],
    tables: [] as Table[],
    dailyGoal: 0, 
    isWeekend: false,
    stats: { 
      totalVentas: 0,
      totalVentasDia: 0,
      ventasPorTurno: [] as any[],
      totalPagado: 0,
      totalPorCobrar: 0,
      count: 0, 
      recent: [] as any[],
      totalEfectivo: 0,
      totalDigital: 0
    },
    globalAlerts: {
      kitchenCount: 0,
      hasPendingPayments: false
    },
    turnoActual: 1,
    activePin: '0000',
    lastCloseTime: 0 
  }),

  getters: {
    totalPrice: (state) => state.cart.reduce((total, item) => total + (item.price * item.quantity), 0),
    totalItems: (state) => state.cart.reduce((total, item) => total + item.quantity, 0)
  },

  actions: {
    initializeSession() { },

    setUser(userData: User) {
      this.user = userData
      const userCookie = useCookie<User | null>('kausa_user', { maxAge: 60 * 60 * 24 })
      userCookie.value = userData
    },

    async logout() {
      this.user = null
      const userCookie = useCookie('kausa_user')
      userCookie.value = null
      if (process.client) {
        window.location.href = '/login'
      }
    },

    async checkGlobalAlerts() {
      if (!this.user) return

      try {
        if (['admin', 'glorianora', 'cocina'].includes(this.user.role)) {
          const kitchenData = await $fetch<any[]>('/api/orders/kitchen').catch(() => [])
          this.globalAlerts.kitchenCount = kitchenData ? kitchenData.length : 0
        }

        if (['admin', 'glorianora'].includes(this.user.role)) {
          const statsData = await $fetch<any>('/api/orders/stats').catch(() => null)
          if (statsData) {
            this.globalAlerts.hasPendingPayments = statsData.totalPorCobrar > 0
          }
        }
      } catch (error) {
        console.error("Error en el radar de alertas:", error)
      }
    },
    
    // --- PRODUCTOS ---
    async loadProducts() {
      try {
        const data = await $fetch<Product[]>('/api/products')
        this.products = data
      } catch (error) { console.error('Error cargando productos:', error) }
    },

    async addProduct(newProduct: any) {
      try {
        const savedProduct = await $fetch<Product>('/api/products/create', { method: 'POST', body: newProduct })
        this.products.push(savedProduct)
        return savedProduct 
      } catch (error) { throw error }
    },

    async updateProduct(updatedProduct: Product) {
      try {
        await $fetch('/api/products/update', { method: 'PUT', body: updatedProduct })
        const index = this.products.findIndex(p => p.id === updatedProduct.id)
        if (index !== -1) this.products[index] = updatedProduct
      } catch (error) { alert('No se pudieron guardar los cambios.') }
    },

    async deleteProduct(id: number) {
      try {
        await $fetch('/api/products/delete', { method: 'POST', body: { id: id } })
        this.products = this.products.filter(p => p.id !== id)
      } catch (error) { alert('No se pudo eliminar el producto.') }
    },
    
    // --- ESTADÍSTICAS Y ÓRDENES ---
    generarNuevoPin() {
      return Math.floor(1000 + Math.random() * 9000).toString()
    },

    async syncSettingsWithDatabase() {
      try {
        const settings = await $fetch<any[]>(`/api/settings/all?_t=${Date.now()}`).catch(() => [])
        
        let dbPin = '0000'
        let dbTurno = 1
        let dbLastClose = 0

        settings.forEach(s => {
          if (s.key === 'active_pin') dbPin = s.value
          if (s.key === 'current_turno') dbTurno = Number(s.value)
          if (s.key === 'last_close_time') dbLastClose = new Date(s.value).getTime()
        })

        const hoy = new Date().toDateString()
        const ultimoCierre = dbLastClose === 0 ? '' : new Date(dbLastClose).toDateString()

        if (dbPin === '0000' || (dbLastClose !== 0 && hoy !== ultimoCierre)) {
          const nuevoPin = this.generarNuevoPin()
          this.activePin = nuevoPin
          this.turnoActual = 1 
          this.lastCloseTime = Date.now() 
          
          await $fetch('/api/settings/update-multiple', { 
            method: 'POST', 
            body: { 
              settings: [
                { key: 'active_pin', value: nuevoPin },
                { key: 'current_turno', value: '1' },
                { key: 'last_close_time', value: new Date().toISOString() } 
              ] 
            } 
          })
          console.log("🌅 Nuevo día detectado: Turno reiniciado a 1")
        } else {
          this.activePin = dbPin
          this.turnoActual = dbTurno
          this.lastCloseTime = dbLastClose
        }
        
      } catch (error) {
        console.error("Error sincronizando ajustes con BD", error)
      }
    },

    async loadStats(skipSync = false) {
      try {
        if (!skipSync) {
          await this.syncSettingsWithDatabase()
        }
        
        const statsData = await $fetch<any>(`/api/orders/stats?_t=${Date.now()}`).catch(() => null)
        const hoy = new Date()
        const dateString = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
        
        const ordersData = await $fetch<any[]>(`/api/orders/by-date?date=${dateString}&_t=${Date.now()}`).catch(() => [])

        let ventasDiaCompleto = 0
        let mapaTurnos: Record<number, number> = {}

        ordersData.forEach(o => {
          // FIX: Si está anulado o rechazado, su valor en la caja es CERO (0.00)
          const isAnulado = ['Cancelado', 'Anulado', 'Rechazado'].includes(o.status)
          const monto = isAnulado ? 0 : Number(o.total)
          
          ventasDiaCompleto += monto
          const t = o.turno || 1
          if (!mapaTurnos[t]) mapaTurnos[t] = 0
          mapaTurnos[t] += monto
        })

        if (mapaTurnos[this.turnoActual] === undefined) {
          mapaTurnos[this.turnoActual] = 0
        }

        this.stats.totalVentasDia = ventasDiaCompleto
        this.stats.ventasPorTurno = Object.keys(mapaTurnos).map(key => ({
          turno: Number(key),
          total: mapaTurnos[Number(key)]
        })).sort((a, b) => a.turno - b.turno)
        
        const ordenesDelTurno = ordersData.filter(o => new Date(o.createdAt).getTime() > this.lastCloseTime)

        let efectivo = 0
        let digital = 0
        let porCobrar = 0
        let ventasBrutasTurno = 0

        ordenesDelTurno.forEach((order) => {
          // FIX: Ignorar anulados en la suma de Efectivo/Yape/Fiado
          const isAnulado = ['Cancelado', 'Anulado', 'Rechazado'].includes(order.status)
          const monto = isAnulado ? 0 : Number(order.total)
          
          ventasBrutasTurno += monto

          if (!isAnulado) {
            const status = order.paymentStatus === 'Pagado' ? 'Efectivo' : order.paymentStatus
            if (status === 'Efectivo') efectivo += monto
            else if (status === 'Yape / Plin' || status === 'Tarjeta') digital += monto
            else porCobrar += monto
          }
        })

        this.stats.totalVentas = ventasBrutasTurno
        this.stats.totalPagado = efectivo + digital
        this.stats.count = ordersData.filter(o => o.status !== 'Cancelado' && o.status !== 'Rechazado').length
        
        if (statsData) {
          this.stats.recent = (statsData.recent || []).filter((o: any) => new Date(o.createdAt).getTime() > this.lastCloseTime)
        }

        this.stats.totalEfectivo = efectivo
        this.stats.totalDigital = digital
        this.stats.totalPorCobrar = porCobrar 
        
        this.globalAlerts.hasPendingPayments = this.stats.totalPorCobrar > 0
      } catch (error) { 
        console.error('Error cargando estadísticas', error) 
      }
    },

    async resetearVentasDelDia() {
      const nuevoTurno = this.turnoActual + 1
      const nuevoPin = this.generarNuevoPin()
      const horaCierre = new Date().toISOString()

      try {
        await $fetch('/api/settings/update-multiple', {
          method: 'POST',
          body: {
            settings: [
              { key: 'active_pin', value: nuevoPin },
              { key: 'current_turno', value: String(nuevoTurno) },
              { key: 'last_close_time', value: horaCierre }
            ]
          }
        })
      } catch (e) {
        console.error("Error guardando el Cierre Global en BD", e)
      }

      this.turnoActual = nuevoTurno
      this.activePin = nuevoPin
      this.lastCloseTime = new Date(horaCierre).getTime()
      
      await this.loadStats(true) 
      console.log("Cierre Global exitoso. Pasando al Turno:", this.turnoActual)
      
      return { turno: this.turnoActual, pin: nuevoPin }
    },

    decrementarAlertaCocina() {
      if (this.globalAlerts.kitchenCount > 0) {
        this.globalAlerts.kitchenCount--
      }
    },

    apagarAlertaPagos() {
      this.globalAlerts.hasPendingPayments = false
    },

    // 🚀 NUEVA ACCIÓN: Para que el mesero confirme la entrega física
    async marcarComoEntregado(orderId: number | string) {
      try {
        await $fetch('/api/orders/update-status', {
          method: 'POST',
          body: { orderId, newStatus: 'Entregado' }
        })
        
        // Refrescamos las estadísticas (y por ende la lista de recientes/órdenes)
        await this.loadStats() 
        console.log(`Orden ${orderId} marcada como entregada`)
      } catch (error) {
        console.error("Error al marcar entrega", error)
      }
    },

    async checkout(tableName: string = 'Caja') {
      if (this.cart.length === 0) return null
      
      const totalVenta = this.totalPrice
      const descripcionPedido = this.cart.map(item => `${item.quantity}x ${item.name}`).join(', ')
      const itemsCopia = [...this.cart] 
      
      this.clearCart()
      
      const newOrder: Order = {
        id: 'Generando...',
        items: itemsCopia,
        total: totalVenta,
        date: new Date(),
        status: 'Pendiente', // 🚀 CAMBIO: Nace como Pendiente en lugar de Listo
        table: tableName
      }
      this.orders.unshift(newOrder)

      if (['admin', 'glorianora', 'cocina'].includes(this.user?.role || '')) {
        this.globalAlerts.kitchenCount++
      }

      $fetch<any>('/api/orders/create', {
        method: 'POST',
        body: { 
          total: totalVenta, 
          description: descripcionPedido, 
          table: tableName,
          turno: this.turnoActual,
          status: 'Pendiente' // 🚀 CAMBIO: Aseguramos que se guarde como Pendiente en BD
        }
      }).then(savedOrder => {
        newOrder.id = '#' + (savedOrder.dailyTicket || savedOrder.id)
        this.loadStats() 
      }).catch(error => {
        console.error("Fallo al guardar", error)
        this.decrementarAlertaCocina() 
        alert('Cuidado: Hubo un problema de red guardando el último pedido.')
      })

      return newOrder 
    },

    // --- CARRITO ---
    addToCart(product: Product) {
      const existingItem = this.cart.find(item => item.id === product.id)
      if (existingItem) existingItem.quantity++
      else this.cart.push({ ...product, quantity: 1 })
    },
    removeFromCart(productId: number | string) {
      const index = this.cart.findIndex(item => item.id === productId)
      if (index !== -1) this.cart.splice(index, 1)
    },
    decreaseQuantity(productId: number | string) {
      const item = this.cart.find(item => item.id === productId)
      if (item) {
        item.quantity--
        if (item.quantity <= 0) this.removeFromCart(productId)
      }
    },
    clearCart() { 
      this.cart = [] 
    },

    // --- METAS ---
    initDailyGoal() {
      const day = new Date().getDay()
      this.isWeekend = (day === 0 || day === 5 || day === 6)
      if (this.dailyGoal === 0) { 
        this.dailyGoal = this.isWeekend ? 1500 : 600 
      }
    },
    updateGoal(newGoal: number) { 
      this.dailyGoal = newGoal 
    },

    // --- MESAS ---
    async loadTables() {
      try {
        const data = await $fetch<Table[]>('/api/tables')
        if (data && data.length > 0) {
          this.tables = data
        } else {
          this.tables = [
            { id: 'caja', name: 'Caja', type: 'counter', icon: 'C', pos_x: 0, pos_y: 0 },
            { id: 'llevar', name: 'Para Llevar', type: 'takeaway', icon: 'LL', pos_x: 0, pos_y: 0 }
          ]
        }
      } catch (error) { 
        console.error('Error cargando mesas desde la API', error) 
      }
    },

    async addTable(newTable: Table) {
      try {
        if (!newTable.id) newTable.id = `mesa-${Date.now()}`
        const savedTable = await $fetch<Table>('/api/tables/create', {
          method: 'POST',
          body: newTable
        })
        if (savedTable) this.tables.push(savedTable)
      } catch (error) { 
        console.error('Error creando mesa vía API', error) 
      }
    },

    async deleteTable(id: string | number) {
      try {
        await $fetch('/api/tables/delete', {
          method: 'POST',
          body: { id }
        })
        this.tables = this.tables.filter(t => t.id !== id)
      } catch (error) {
        console.error('Error borrando mesa:', error)
      }
    },

    async saveAllTablePositions() {
      const mesasToUpdate = this.tables.filter(t => t.type === 'table')
      try {
        await $fetch('/api/tables/upsert', {
          method: 'POST',
          body: { tables: mesasToUpdate }
        })
        await this.loadTables()
      } catch (error) {
        console.error('Error guardando posiciones masivas:', error)
        throw error
      }
    }
  }
})