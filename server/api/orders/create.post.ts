// server/api/orders/create.post.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  try {
    // 1. Calculamos el rango de HOY
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)

    // 2. Contamos cuántas ventas ya hay creadas el día de hoy
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
        dailyTicket: nextTicket, // <--- Guardamos el correlativo diario
        table: body.table || 'Caja'
      }
    })

    return newOrder

  } catch (error) {
    console.error('Error creando orden:', error)
    throw createError({ statusCode: 500, statusMessage: 'Error creando la venta' })
  }
})