import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const targetDate = query.date as string

  if (!targetDate) return []

  try {
    //  BUG FIX HORARIO: Le agregamos "-05:00" para forzar la hora exacta de Lima/Perú
    // Así Vercel no usará la hora de Londres para los cortes de caja.
    const startOfDay = new Date(`${targetDate}T00:00:00-05:00`)
    const endOfDay = new Date(`${targetDate}T23:59:59-05:00`)

    // Buscamos usando PRISMA
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startOfDay, // Mayor o igual a las 00:00 de Perú
          lte: endOfDay,   // Menor o igual a las 23:59 de Perú
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