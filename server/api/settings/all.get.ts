// server/api/settings/all.get.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async () => {
  try {
    const settings = await prisma.systemSetting.findMany()
    return settings
  } catch (error) {
    console.error('Error buscando configuraciones:', error)
    return []
  }
})