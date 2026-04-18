// server/api/auth/login.post.ts
import { createClient } from '@supabase/supabase-js'

// Usamos las variables de entorno que ya pusiste en tu archivo .env
const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body

  // 1. Le preguntamos al módulo nativo de Auth de Supabase si la clave es correcta
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  // 2. Si hay error (clave mal, no existe, etc.), rebotamos
  if (error) {
    throw createError({ 
      statusCode: 401, 
      statusMessage: 'Contraseña incorrecta o usuario no válido' 
    })
  }

  // 3. Como Supabase Auth no guarda el "rol" y el "nombre" en las columnas principales,
  // los deducimos del correo temporalmente para tu tienda.
  let role = 'Usuarios'
  let name = 'Salón'
  let id = 'Usuarios'

  if (email.includes('gerencia')) { role = 'Gerencia General'; name = 'Gloria Nora'; id = 'GloriaNora'; }
  if (email.includes('admin')) { role = 'Soporte TI'; name = 'Administrador'; id = 'admin'; }
  if (email.includes('cocina')) { role = 'Chef'; name = 'Cocina'; id = 'Chef'; }

  return {
    success: true,
    user: {
      id: id,
      name: name,
      role: role,
      email: data.user.email
    }
  }
})