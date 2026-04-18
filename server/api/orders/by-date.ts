// server/api/orders/by-date.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const targetDate = query.date as string

  if (!targetDate) return []

  try {
    // 1. Creamos los límites exactos del día usando el huso horario local
    const startOfDay = new Date(`${targetDate}T00:00:00`)
    const endOfDay = new Date(`${targetDate}T23:59:59`)

    // 2. Buscamos usando PRISMA (apuntando a tu modelo 'Order' y campo 'createdAt')
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startOfDay, // Mayor o igual a las 00:00
          lte: endOfDay,   // Menor o igual a las 23:59
        },
      },
      orderBy: {
        createdAt: 'desc', // Las ventas más recientes primero
      },
    })

    return orders || []
    
  } catch (error) {
    console.error('Error buscando ventas con Prisma:', error)
    return []
  }
})