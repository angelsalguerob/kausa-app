// middleware/auth.global.ts

export default defineNuxtRouteMiddleware(async (to) => {
  const store = usePosStore()
  
  // 1. 🚀 SOLUCIÓN TS: Le decimos a TypeScript exactamente qué forma tiene la cookie
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

  // 5. Zonas prohibidas
  if (user) {
    if (to.path === '/login') {
      if (rol === 'admin' || rol === 'glorianora') return navigateTo('/')
      if (rol === 'mesero') return navigateTo('/pos')
      if (rol === 'cocina') return navigateTo('/kitchen')
    }

    if (rol === 'cocina' && to.path !== '/kitchen') {
      return navigateTo('/kitchen')
    }

    if (rol === 'mesero' && to.path !== '/pos') {
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