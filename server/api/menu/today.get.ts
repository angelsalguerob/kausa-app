// server/api/menu/today.get.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const now = new Date()
  const tzOffset = now.getTimezoneOffset() * 60000
  const localDate = new Date(now.getTime() - tzOffset).toISOString().split('T')[0]

  try {
    const menu = await prisma.dailyMenu.findUnique({
      where: { date: localDate }
    })
    // Si hay menú devuelve los datos, si no, devuelve nulo
    return menu ? menu.data : null
  } catch (error) {
    return null
  }
})