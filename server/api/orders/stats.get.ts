import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    // BUG FIX HORARIO LIMA (UTC-5)
    const now = new Date()
    // Restamos 5 horas en milisegundos para sincronizar con la hora exacta de Perú
    const peruTime = new Date(now.getTime() - (5 * 60 * 60 * 1000))
    
    // Extraemos el día real en Perú (Ej: 2026-04-17)
    const yyyy = peruTime.getUTCFullYear()
    const mm = String(peruTime.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(peruTime.getUTCDate()).padStart(2, '0')
    const peruDateString = `${yyyy}-${mm}-${dd}`

    // Armamos los límites del día forzando la zona horaria peruana (-05:00)
    const startOfDay = new Date(`${peruDateString}T00:00:00-05:00`)
    const endOfDay = new Date(`${peruDateString}T23:59:59-05:00`)

    // Buscar SOLO las órdenes que se crearon hoy en Perú
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

    // LÓGICA FINANCIERA
    const estadosPagados = ['pagado', 'efectivo', 'yape/plin', 'yape / plin', 'tarjeta']

    const totalVentas = todayOrders.reduce((sum, order) => sum + Number(order.total), 0)

    const totalPagado = todayOrders
      .filter(order => {
        const estado = (order.paymentStatus || '').toLowerCase().trim()
        return estadosPagados.includes(estado)
      })
      .reduce((sum, order) => sum + Number(order.total), 0)

    const totalPorCobrar = todayOrders
      .filter(order => {
        const estado = (order.paymentStatus || '').toLowerCase().trim()
        return !estadosPagados.includes(estado)
      })
      .reduce((sum, order) => sum + Number(order.total), 0)

    const totalOrders = todayOrders.length
    const recent = todayOrders.slice(0, 5)

    return {
      totalVentas,
      totalPagado,
      totalPorCobrar,
      totalOrders,
      recent
    }

  } catch (error) {
    console.error('Error cargando estadísticas de hoy:', error)
    return { 
      totalVentas: 0, 
      totalPagado: 0, 
      totalPorCobrar: 0, 
      totalOrders: 0, 
      recent: [] 
    }
  }
})