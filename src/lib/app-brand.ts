import type { MetadataRoute, Metadata } from 'next'

/**
 * The installed app ("Add to Home Screen") carries the family's brand:
 * players tagged Rowville Eagles → "Rowville Eagles"; Foundation Academy (RFA) only → "Foundation Academy".
 */
export type AppBrand = 'eagles' | 'academy'

export const APP = {
  eagles: { name: 'Rowville Eagles', short: 'Eagles', icon192: '/icons/eagles-192.png', icon512: '/icons/eagles-512.png', maskable: '/icons/eagles-maskable-512.png', apple: '/icons/eagles-apple-touch-icon.png', manifest: '/manifest.webmanifest' },
  academy: { name: 'Foundation Academy', short: 'Academy', icon192: '/icons/icon-192.png', icon512: '/icons/icon-512.png', maskable: '/icons/icon-512.png', apple: '/icons/apple-touch-icon.png', manifest: '/manifest-academy.webmanifest' },
} as const

/** Pure: which app a family gets from their players' tags (and roles). */
export function appBrandFor(o: { memberships?: string[]; roles?: string[] | null }): AppBrand {
  const tags = new Set(o.memberships ?? [])
  if (tags.has('rowville')) return 'eagles'
  if (tags.has('rfa') || tags.has('foundation-plus')) return 'academy'
  // Academy coaches (who aren't Management) use the Foundation Academy app
  const roles = o.roles ?? []
  if (roles.includes('coach') && !roles.some((r) => r === 'admin' || r === 'committee')) return 'academy'
  return 'eagles'
}

export function appManifest(brand: AppBrand): MetadataRoute.Manifest {
  const b = APP[brand]
  return {
    id: `/?app=${brand}`,
    name: b.name,
    short_name: b.short,
    description: brand === 'academy' ? 'Foundation Academy — sessions, bookings, progress and messages.' : 'Rowville Eagles FC — teams, fixtures, bookings and messages.',
    start_url: '/account?source=app',
    scope: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: b.icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: b.icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: b.maskable, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Messages', url: '/account/messages', icons: [{ src: b.icon192, sizes: '192x192' }] },
      { name: 'Training day (coaches)', url: '/coach/today', icons: [{ src: b.icon192, sizes: '192x192' }] },
    ],
  }
}

/** Page metadata so "Add to Home Screen" (iPhone and Android) uses the family's app name and icon. */
export const appMetadata = (brand: AppBrand): Pick<Metadata, 'manifest' | 'appleWebApp' | 'icons'> => ({
  manifest: APP[brand].manifest,
  appleWebApp: { capable: true, title: APP[brand].name, statusBarStyle: 'black-translucent' },
  icons: { icon: [{ url: '/favicon.ico', sizes: '48x48' }, { url: '/icons/favicon-32.png', type: 'image/png', sizes: '32x32' }], apple: APP[brand].apple },
})
