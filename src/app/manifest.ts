import type { MetadataRoute } from 'next'

/** "Add to home screen": opens straight into the coach / family dashboard like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rowville Eagles FC',
    short_name: 'Eagles',
    description: 'Rowville Eagles FC and Rowville Foundation Academy — bookings, teams and the coach portal.',
    start_url: '/account',
    scope: '/',
    display: 'standalone',
    background_color: '#0f2a55',
    theme_color: '#0f2a55',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Training day', url: '/coach/today', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Messages', url: '/account/messages' },
    ],
  }
}
