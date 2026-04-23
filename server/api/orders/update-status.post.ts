// server/api/orders/update-status.post.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { orderId, newStatus } = body

  try {
    const updatedOrder = await prisma.order.update({
      where: { id: Number(orderId) },
      data: { status: newStatus }
    })
    return updatedOrder
  } catch (error) {
    throw createError({ statusCode: 500, statusMessage: 'Error actualizando el pedido' })
  }
})