import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { id, paymentStatus } = body

  return await prisma.order.update({
    where: { id: Number(id) },
    data: { paymentStatus }
  })
})