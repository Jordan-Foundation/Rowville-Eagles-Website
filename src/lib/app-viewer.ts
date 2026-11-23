import { cache } from 'react'
import type { Metadata } from 'next'
import { payload } from './payload'
import { currentLogin, currentUser } from './auth'
import { appBrandOf } from './app-install'
import { appMetadata, type AppBrand } from './app-brand'

/** The signed-in person and which app they get (once per request). */
export const appViewer = cache(async () => {
  // The app and notifications are personal to whoever is signed in; the brand follows the family's players
  const [user, family] = await Promise.all([currentLogin(), currentUser()])
  const brand: AppBrand = family ? await appBrandOf(await payload(), family) : 'eagles'
  return { user, brand }
})

/** Page metadata for logged-in pages, so "Add to Home Screen" installs the family's own app. */
export async function appPageMetadata(base: Metadata): Promise<Metadata> {
  const { brand } = await appViewer()
  return { ...base, ...appMetadata(brand) }
}
