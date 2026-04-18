import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  // 🚀 BUG FIX HORARIO LIMA (UTC-5)
  const now = new Date()
  // Restamos exactamente 5 horas (ignoramos el offset del servidor que en Vercel es 0)
  const peruTime = new Date(now.getTime() - (5 * 60 * 60 * 1000))
  
  const yyyy = peruTime.getUTCFullYear()
  const mm = String(peruTime.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(peruTime.getUTCDate()).padStart(2, '0')
  // Armamos la fecha: Ej. "2026-04-18"
  const localDate = `${yyyy}-${mm}-${dd}`

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