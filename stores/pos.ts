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
      recent: [] as any[] 
    },
    // 🚀 NUEVO: RADAR DE ALERTAS GLOBALES
    globalAlerts: {
      kitchenCount: 0,
      hasPendingPayments: false
    }
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

    // 🚀 NUEVO: FUNCIÓN PARA REVISAR ALERTAS
    async checkGlobalAlerts() {
      if (!this.user) return

      try {
        // 1. Revisar Cocina (Cualquiera con rol de cocina o admin lo necesita)
        if (['admin', 'glorianora', 'cocina'].includes(this.user.role)) {
          const kitchenData = await $fetch<any[]>('/api/orders/kitchen').catch(() => [])
          this.globalAlerts.kitchenCount = kitchenData ? kitchenData.length : 0
        }

        // 2. Revisar Pagos Pendientes (Solo Admin/Gloria)
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
    async loadStats() {
      try {
        const data = await $fetch<any>('/api/orders/stats')
        this.stats.totalVentas = data.totalVentas || 0
        this.stats.totalPagado = data.totalPagado || 0
        this.stats.totalPorCobrar = data.totalPorCobrar || 0
        this.stats.count = data.totalOrders || 0
        this.stats.recent = data.recent || []
        
        // Actualizamos la alerta de paso
        this.globalAlerts.hasPendingPayments = this.stats.totalPorCobrar > 0
      } catch (error) { 
        console.error('Error cargando estadísticas', error) 
      }
    },

    decrementarAlertaCocina() {
      if (this.globalAlerts.kitchenCount > 0) {
        this.globalAlerts.kitchenCount--
      }
    },

    apagarAlertaPagos() {
      // Asumimos que ya no hay deudas. Si queda alguna, el radar de 15 segs la volverá a prender sola.
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

      // ⚡ MAGIA INSTANTÁNEA: Subimos la alerta de cocina en 1 milisegundo
      if (['admin', 'glorianora', 'cocina'].includes(this.user?.role || '')) {
        this.globalAlerts.kitchenCount++
      }

      // El $fetch trabaja en segundo plano, NO bloquea la pantalla
      $fetch<any>('/api/orders/create', {
        method: 'POST',
        body: { total: totalVenta, description: descripcionPedido, table: tableName }
      }).then(savedOrder => {
        newOrder.id = '#' + (savedOrder.dailyTicket || savedOrder.id)
        this.loadStats() 
        // Ya no llamamos a checkGlobalAlerts() aquí porque ya lo hicimos arriba manual
      }).catch(error => {
        console.error("Fallo al guardar", error)
        // Si falla la red, bajamos la alerta que subimos por error
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