import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const updated = await prisma.order.update({
    where: { id: body.id },
    data: { status: 'Listo' }
  })
  
  return updated
})