import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  // 🚀 BUG FIX HORARIO LIMA (UTC-5)
  const now = new Date()
  // Restamos exactamente 5 horas 
  const peruTime = new Date(now.getTime() - (5 * 60 * 60 * 1000))
  
  const yyyy = peruTime.getUTCFullYear()
  const mm = String(peruTime.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(peruTime.getUTCDate()).padStart(2, '0')
  // Armamos la fecha que coincida con la de guardado
  const localDate = `${yyyy}-${mm}-${dd}`

  try {
    const menu = await prisma.dailyMenu.findUnique({
      where: { date: localDate }
    })
    // Si hay menú devuelve los datos, si no, devuelve nulo
    return menu ? menu.data : null
  } catch (error) {
    console.error('Error buscando menú de hoy:', error)
    return null
  }
})