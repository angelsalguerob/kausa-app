import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  try {
    const settingsToUpdate = body.settings || []
    let count = 0

    // 🚀 Como ya arreglamos el schema, upsert funcionará a la perfección
    for (const setting of settingsToUpdate) {
      await prisma.systemSetting.upsert({
        where: { key: setting.key },
        update: { value: String(setting.value) },
        create: { key: setting.key, value: String(setting.value) }
      })
      count++
    }

    return { success: true, updatedCount: count }
  } catch (error) {
    console.error('Error actualizando configuraciones:', error)
    throw createError({ statusCode: 500, statusMessage: 'Error interno DB' })
  }
})