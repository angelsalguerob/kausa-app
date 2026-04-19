// server/api/orders/create.post.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  try {
    // 🚀 BUG FIX HORARIO LIMA (UTC-5)
    const now = new Date()
    // Restamos 5 horas para sincronizar con la hora exacta de Perú
    const peruTime = new Date(now.getTime() - (5 * 60 * 60 * 1000))
    
    // Extraemos el día real en Perú
    const yyyy = peruTime.getUTCFullYear()
    const mm = String(peruTime.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(peruTime.getUTCDate()).padStart(2, '0')
    const peruDateString = `${yyyy}-${mm}-${dd}`

    // 1. Calculamos el rango de HOY forzando la zona horaria peruana
    const startOfDay = new Date(`${peruDateString}T00:00:00-05:00`)
    const endOfDay = new Date(`${peruDateString}T23:59:59-05:00`)

    // 2. Contamos cuántas ventas ya hay creadas el día de hoy (en Perú)
    const todayOrdersCount = await prisma.order.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    })

    // 3. El nuevo ticket es la cantidad actual + 1
    const nextTicket = todayOrdersCount + 1

    // 4. Guardamos en la base de datos
    const newOrder = await prisma.order.create({
      data: {
        total: parseFloat(body.total),
        status: 'Pendiente', // Para que la cocina lo vea
        description: body.description || "ERROR: NO LLEGÓ",
        dailyTicket: nextTicket, 
        table: body.table || 'Caja',
        // 🚀 NUEVA LÍNEA: Guardamos el turno. Si por alguna razón no llega, le ponemos 1 por defecto.
        turno: Number(body.turno) || 1 
      }
    })

    return newOrder

  } catch (error) {
    console.error('Error creando orden:', error)
    throw createError({ statusCode: 500, statusMessage: 'Error creando la venta' })
  }
})