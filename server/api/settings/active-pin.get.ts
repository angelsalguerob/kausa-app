import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async () => {
  try {
    // Buscamos el PIN guardado en la base de datos
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'active_pin' }
    })
    
    // Si lo encuentra, lo devuelve. Si no (porque es la primera vez), devuelve '0000'
    return { pin: setting ? setting.value : '0000' }
    
  } catch (error) {
    console.error('Error buscando el PIN activo:', error)
    return { pin: '0000' }
  }
})