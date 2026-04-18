// server/api/menu/save.post.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  // Sacamos la fecha exacta de hoy en Perú (YYYY-MM-DD)
  const now = new Date()
  const tzOffset = now.getTimezoneOffset() * 60000
  const localDate = new Date(now.getTime() - tzOffset).toISOString().split('T')[0]

  try {
    // upsert es mágico: Si ya hay un menú hoy, lo actualiza. Si no hay, lo crea.
    const menu = await prisma.dailyMenu.upsert({
      where: { date: localDate },
      update: { data: body },
      create: { date: localDate, data: body }
    })
    return menu
  } catch (error) {
    console.error('Error guardando menú:', error)
    throw createError({ statusCode: 500, message: 'Error interno del servidor' })
  }
})