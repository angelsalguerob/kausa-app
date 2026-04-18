import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { id, paymentStatus } = body

  if (!id || !paymentStatus) {
    throw createError({ statusCode: 400, statusMessage: 'Faltan datos' })
  }

  // Actualizamos SOLO el estado financiero, sin tocar lo que hizo cocina
  const updatedOrder = await prisma.order.update({
    where: { id: Number(id) },
    data: { paymentStatus: paymentStatus }
  })

  return updatedOrder
})