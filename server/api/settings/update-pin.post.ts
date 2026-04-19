import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  try {
    const newPin = body.pin || '0000'

    // 'upsert' es mágico: si ya existe el registro "active_pin", lo actualiza. 
    // Si no existe, lo crea por primera vez.
    const setting = await prisma.systemSetting.upsert({
      where: { key: 'active_pin' },
      update: { value: newPin },
      create: { key: 'active_pin', value: newPin }
    })

    return { success: true, pin: setting.value }

  } catch (error) {
    console.error('Error actualizando el PIN:', error)
    throw createError({ statusCode: 500, statusMessage: 'Error al actualizar el PIN de seguridad' })
  }
})