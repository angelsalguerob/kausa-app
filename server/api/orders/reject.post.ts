// server/api/orders/reject.post.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  try {
    // 🚀 El chef usa "Rechazado", no "Cancelado"
    const rejectedOrder = await prisma.order.update({
      where: { id: body.id },
      data: { status: 'Rechazado' }
    })
    
    return rejectedOrder
  } catch (error) {
    console.error('Error rechazando la orden:', error)
    throw createError({ statusCode: 500, message: 'Error interno al rechazar' })
  }
})