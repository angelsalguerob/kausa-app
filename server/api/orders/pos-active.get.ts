import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async () => {
  try {
    // 🚀 Sin tildes para que TypeScript no se queje
    const limiteTiempo = new Date()
    limiteTiempo.setHours(limiteTiempo.getHours() - 24)

    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: ['Pendiente', 'Listo']
        },
        createdAt: {
          gte: limiteTiempo
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    return orders
  } catch (error) {
    console.error('Error cargando ordenes activas para el POS:', error)
    return []
  }
})