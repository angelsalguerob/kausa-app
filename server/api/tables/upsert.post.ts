import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { tables } = body

  // Usamos una transacción para asegurarnos de que se guarden todas o ninguna
  const operations = tables.map((t: any) => 
    prisma.table.upsert({
      where: { id: t.id },
      update: { pos_x: t.pos_x, pos_y: t.pos_y, name: t.name, icon: t.icon, type: t.type },
      create: { id: t.id, name: t.name, icon: t.icon, type: t.type, pos_x: t.pos_x, pos_y: t.pos_y }
    })
  )

  return await prisma.$transaction(operations)
})