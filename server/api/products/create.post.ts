// server/api/products/create.post.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // AQUÍ DEBE DECIR "product.create", NO "order.create"
  const newProduct = await prisma.product.create({
    data: {
      name: body.name,
      price: parseFloat(body.price),
      category: body.category,
      image: body.image || ''
    }
  })
  
  return newProduct
})