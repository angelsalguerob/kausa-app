// middleware/auth.global.ts
import { usePosStore } from '../stores/pos'

export default defineNuxtRouteMiddleware(async (to) => {
  const store = usePosStore()
  
  // 1. SOLUCIÓN TS: Le decimos a TypeScript exactamente qué forma tiene la cookie
  const userCookie = useCookie<{ id: string; name: string; role: string; icon: string } | null>('kausa_user').value
  
  // 2. El usuario es el que esté en el Store, O el que esté guardado en la Cookie
  const user = store.user || userCookie
  const rol = user?.role

  // LOG DE DEPURACIÓN
  console.log('Guardia:', to.path, '| Usuario:', user?.name || 'Invitado', '| Rol:', rol || 'Sin rol')

  // 3. Si definitivamente no hay usuario ni cookie, pal' login
  if (!user && to.path !== '/login') {
    return navigateTo('/login')
  }

  // 4. RESCATE DE F5: Si la cookie salvó el día, volvemos a meter al usuario al Store
  if (user && !store.user) {
    store.user = user
  }

  // 5. ZONAS PROHIBIDAS Y SEGURIDAD PIN
  if (user) {
    
    // 🚀 LÓGICA DE BLOQUEO POR PIN (SOLO MESEROS Y COCINA)
    const requierePin = rol === 'mesero' || rol === 'cocina'

    // Si requiere PIN y está intentando navegar a cualquier lado que NO sea Login o la pantalla de Bloqueo
    if (requierePin && to.path !== '/login' && to.path !== '/locked') {
      // Leemos la "huella" del PIN que el celular tiene guardada
      const devicePin = useCookie('kausa_device_pin').value

      try {
         // Le preguntamos al servidor (Prisma) cuál es el PIN real de ESTE preciso momento
         const data = await $fetch<any>('/api/settings/active-pin')
         
         // Si el celular no tiene PIN guardado o su PIN ya caducó (es distinto al del servidor)
         if (!devicePin || String(devicePin) !== String(data.pin)) {
            console.log('Bloqueando pantalla... PIN caducado o inexistente')
            return navigateTo('/locked') // ¡A LA CÁRCEL!
         }
      } catch (e) {
         console.error("Error verificando el PIN del turno", e)
      }
    }

    // Un Admin nunca debe quedarse atascado en la pantalla de bloqueo
    if (to.path === '/locked' && !requierePin) {
       return navigateTo('/') 
    }

    if (to.path === '/login') {
      if (rol === 'admin' || rol === 'glorianora') return navigateTo('/')
      if (rol === 'mesero') return navigateTo('/pos')
      if (rol === 'cocina') return navigateTo('/kitchen')
    }

    // Reglas de redirección básicas
    if (rol === 'cocina' && to.path !== '/kitchen' && to.path !== '/locked') {
      return navigateTo('/kitchen')
    }

    if (rol === 'mesero' && to.path !== '/pos' && to.path !== '/locked') {
      return navigateTo('/pos')
    }

    const rutasAdmin = ['/', '/reports', '/inventory', '/settings', '/today-menu']
    const esAdmin = rol === 'admin' || rol === 'glorianora'

    if (rutasAdmin.includes(to.path) && !esAdmin) {
      if (rol === 'mesero') return navigateTo('/pos')
      if (rol === 'cocina') return navigateTo('/kitchen')
    }
  }
})