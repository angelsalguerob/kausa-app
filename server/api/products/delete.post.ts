// server/api/products/delete.post.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Borramos de la BD
  const deleted = await prisma.product.delete({
    where: { id: body.id }
  })
  
  return deleted
})