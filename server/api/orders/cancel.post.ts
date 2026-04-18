// server/api/orders/cancel.post.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  try {
    // Actualizamos el estado del pedido a "Cancelado"
    const cancelledOrder = await prisma.order.update({
      where: { id: body.id },
      data: { status: 'Cancelado' }
    })
    
    return cancelledOrder
  } catch (error) {
    console.error('Error cancelando la orden:', error)
    throw createError({ statusCode: 500, message: 'Error interno al cancelar' })
  }
})