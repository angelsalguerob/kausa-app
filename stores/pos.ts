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
  status: 'Pendiente' | 'Listo'
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
    turnoActual: process.client ? (Number(localStorage.getItem('kausa_turno_actual')) || 1) : 1,
    // 🚀 NUEVO: Guardamos el PIN en memoria para que Ajustes pueda leerlo
    activePin: process.client ? (localStorage.getItem('kausa_active_pin') || '0000') : '0000'
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
    
    // 🚀 NUEVO: Helper para generar un PIN aleatorio de 4 dígitos
    generarNuevoPin() {
      return Math.floor(1000 + Math.random() * 9000).toString()
    },

    // 🚀 NUEVO: Sincronizador de PIN con el servidor
    async syncPinWithDatabase() {
      try {
        const data = await $fetch<any>('/api/settings/active-pin')
        if (data && data.pin) {
          // Si el servidor dice '0000' (la base de datos está vacía por ser la primera vez)
          // y el usuario es Admin, forzamos la creación de un PIN real.
          if (data.pin === '0000' && ['admin', 'glorianora'].includes(this.user?.role || '')) {
            const nuevoPin = this.generarNuevoPin()
            this.activePin = nuevoPin
            localStorage.setItem('kausa_active_pin', nuevoPin)
            await $fetch('/api/settings/update-pin', { method: 'POST', body: { pin: nuevoPin } })
          } else {
            // Si el servidor tiene un PIN real, actualizamos la pantalla de Gloria
            this.activePin = data.pin
            localStorage.setItem('kausa_active_pin', data.pin)
          }
        }
      } catch (error) {
        console.error("Error sincronizando PIN con el servidor", error)
      }
    },

    async loadStats() {
      try {
        await this.syncPinWithDatabase()
        const statsData = await $fetch<any>('/api/orders/stats')
        const hoy = new Date()
        const dateString = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
        
        const ordersData = await $fetch<any[]>(`/api/orders/by-date?date=${dateString}`).catch(() => [])

        const lastCloseStr = localStorage.getItem('kausa_last_close')
        let lastCloseTime = 0
        
        if (lastCloseStr) {
          const closeDate = new Date(lastCloseStr)
          
          if (closeDate.toDateString() === hoy.toDateString()) {
            lastCloseTime = closeDate.getTime()
          } else {
            // 🚀 ES UN NUEVO DÍA: Reseteamos turno a 1
            this.turnoActual = 1
            localStorage.setItem('kausa_turno_actual', '1')

            // 🚀 SEGURIDAD: Destruimos el PIN de ayer y generamos uno nuevo al abrir el día
            const nuevoPin = this.generarNuevoPin()
            this.activePin = nuevoPin
            localStorage.setItem('kausa_active_pin', nuevoPin)
            
            // Lo guardamos silenciosamente en la BD
            $fetch('/api/settings/update-pin', {
              method: 'POST',
              body: { pin: nuevoPin }
            }).catch(() => {})
          }
        }

        const ordenesDelTurno = ordersData.filter(o => new Date(o.createdAt).getTime() > lastCloseTime)

        let efectivo = 0
        let digital = 0
        let porCobrar = 0
        let ventasBrutasTurno = 0

        ordenesDelTurno.forEach((order) => {
          const monto = Number(order.total)
          ventasBrutasTurno += monto

          const status = order.paymentStatus === 'Pagado' ? 'Efectivo' : order.paymentStatus

          if (status === 'Efectivo') {
            efectivo += monto
          } else if (status === 'Yape / Plin' || status === 'Tarjeta') {
            digital += monto
          } else {
            porCobrar += monto
          }
        })

        this.stats.totalVentas = ventasBrutasTurno
        this.stats.totalPagado = efectivo + digital
        this.stats.count = ordenesDelTurno.length
        
        this.stats.recent = (statsData.recent || []).filter((o: any) => new Date(o.createdAt).getTime() > lastCloseTime)

        this.stats.totalEfectivo = efectivo
        this.stats.totalDigital = digital
        this.stats.totalPorCobrar = porCobrar 
        
        this.globalAlerts.hasPendingPayments = this.stats.totalPorCobrar > 0
      } catch (error) { 
        console.error('Error cargando estadísticas y ventas del día', error) 
      }
    },

    async resetearVentasDelDia() {
      const ahora = new Date()
      localStorage.setItem('kausa_last_close', ahora.toISOString())

      this.turnoActual++
      localStorage.setItem('kausa_turno_actual', this.turnoActual.toString())

      // 🚀 SEGURIDAD: Generamos nuevo PIN para el siguiente turno (Cierre de Caja)
      const nuevoPin = this.generarNuevoPin()
      this.activePin = nuevoPin
      localStorage.setItem('kausa_active_pin', nuevoPin)

      try {
        await $fetch('/api/settings/update-pin', {
          method: 'POST',
          body: { pin: nuevoPin }
        })
      } catch (e) {
        console.error("Error guardando el nuevo PIN en BD", e)
      }

      await this.loadStats()
      console.log("Caja cerrada. Pasando al Turno:", this.turnoActual)
      
      // Le mostramos a Gloria el PIN del nuevo turno para que se lo dé al equipo
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
        status: 'Listo',
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
          turno: this.turnoActual 
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
    clearCart() { this.cart = [] },

    // --- METAS ---
    initDailyGoal() {
      const day = new Date().getDay()
      this.isWeekend = (day === 0 || day === 5 || day === 6)
      if (this.dailyGoal === 0) { this.dailyGoal = this.isWeekend ? 1500 : 600 }
    },
    updateGoal(newGoal: number) { this.dailyGoal = newGoal },

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