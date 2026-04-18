import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    // 1. Definir el rango exacto de HOY
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)

    // 2. Buscar SOLO las órdenes que se crearon hoy
    const todayOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: {
        createdAt: 'desc' // Las más nuevas primero
      }
    })

    // 3. 🚀 LÓGICA FINANCIERA INTELIGENTE (BUG FIX)
    
    // Creamos nuestro "diccionario" de palabras que significan dinero cobrado
    const estadosPagados = ['pagado', 'efectivo', 'yape/plin', 'yape / plin', 'tarjeta']

    // A. Progreso del Día (Suma absolutamente todo para medir la producción real)
    const totalVentas = todayOrders.reduce((sum, order) => sum + Number(order.total), 0)

    // B. Caja Físicamente Pagada (Reconoce Efectivo, Yape y Tarjeta)
    const totalPagado = todayOrders
      .filter(order => {
        // Limpiamos la palabra (minúsculas y sin espacios extra) por seguridad
        const estado = (order.paymentStatus || '').toLowerCase().trim()
        return estadosPagados.includes(estado)
      })
      .reduce((sum, order) => sum + Number(order.total), 0)

    // C. Cuentas por Cobrar (Cualquier cosa que NO esté en la lista de pagados: Pendiente, Fiado)
    const totalPorCobrar = todayOrders
      .filter(order => {
        const estado = (order.paymentStatus || '').toLowerCase().trim()
        return !estadosPagados.includes(estado)
      })
      .reduce((sum, order) => sum + Number(order.total), 0)

    const totalOrders = todayOrders.length

    // 4. Separar las últimas 5 ventas (Ventas Recientes)
    const recent = todayOrders.slice(0, 5)

    // 5. Devolver los datos limpios al Dashboard
    return {
      totalVentas,
      totalPagado,
      totalPorCobrar,
      totalOrders,
      recent
    }

  } catch (error) {
    console.error('Error cargando estadísticas de hoy:', error)
    // Devolvemos ceros para que no se rompa la pantalla si hay error
    return { 
      totalVentas: 0, 
      totalPagado: 0, 
      totalPorCobrar: 0, 
      totalOrders: 0, 
      recent: [] 
    }
  }
})