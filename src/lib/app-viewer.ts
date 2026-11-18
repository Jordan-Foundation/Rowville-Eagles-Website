import { cache } from 'react'
import type { Metadata } from 'next'
import { payload } from './payload'
import { currentUser } from './auth'
import { appBrandOf } from './app-install'
import { appMetadata, type AppBrand } from './app-brand'

/** The signed-in person and which app they get (once per request). */
export const appViewer = cache(async () => {
  const user = await currentUser()
  const brand: AppBrand = user ? await appBrandOf(await payload(), user) : 'eagles'
  return { user, brand }
})

/** Page metadata for logged-in pages, so "Add to Home Screen" installs the family's own app. */
export async function appPageMetadata(base: Metadata): Promise<Metadata> {
  const { brand } = await appViewer()
  return { ...base, ...appMetadata(brand) }
}
