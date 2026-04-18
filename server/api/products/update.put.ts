// server/api/products/update.put.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Actualizamos en la BD usando el ID
  const updated = await prisma.product.update({
    where: { id: body.id },
    data: {
      name: body.name,
      price: parseFloat(body.price),
      category: body.category,
      image: body.image
    }
  })
  
  return updated
})