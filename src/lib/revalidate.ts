import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook } from 'payload'

/**
 * Public pages are kept ready-made (fast and cheap); when content they show is edited in the admin, refresh them all
 * straight away. Outside a web request (seed scripts, jobs) there's nothing to refresh, so it quietly does nothing.
 */
export async function refreshSite() {
  try {
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/', 'layout')
  } catch {
    /* not in a request (e.g. seed script) */
  }
}

export const refreshAfterChange: CollectionAfterChangeHook = async ({ doc }) => {
  await refreshSite()
  return doc
}
export const refreshAfterDelete: CollectionAfterDeleteHook = async ({ doc }) => {
  await refreshSite()
  return doc
}
export const refreshGlobal: GlobalAfterChangeHook = async ({ doc }) => {
  await refreshSite()
  return doc
}
