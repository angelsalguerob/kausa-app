// server/api/orders/kitchen.get.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  // Buscamos las órdenes que NO están listas (Pendientes y Canceladas sin leer)
  return await prisma.order.findMany({
    where: {
      status: {
        in: ['Pendiente', 'Cancelado'] //  AHORA TRAE AMBOS
      }
    },
    orderBy: {
      createdAt: 'asc' // Las más viejas primero (FIFO)
    }
  })
})