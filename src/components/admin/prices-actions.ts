'use server'

import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { hasRole } from '@/access'
import { EDITABLE, EDITABLE_GLOBAL } from './prices-data'

export type PricesState = { done?: string; error?: string; saved?: number }

/** Save only the prices that changed (fields arrive as "<collection>.<id>.<field>"). */
export async function savePrices(_prev: PricesState, fd: FormData): Promise<PricesState> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user || user.collection !== 'users' || !hasRole(user as never, 'admin', 'committee')) return { error: 'Only admins can change prices.' }

  const changes = new Map<string, { collection: string; id: number; data: Record<string, number | null> }>()
  const globals = new Map<string, Record<string, number>>()
  for (const [key, raw] of fd.entries()) {
    const g = /^g:([a-z-]+):([a-zA-Z]+)$/.exec(key)
    if (g && typeof raw === 'string') {
      const rule = EDITABLE_GLOBAL[g[1]]
      if (!rule?.fields.includes(g[2])) return { error: `“${g[2]}” can’t be changed here.` }
      const value = raw.trim()
      if (value === String(fd.get(`$orig:${key}`) ?? '')) continue
      if (!/^\d+(\.\d{1,2})?$/.test(value)) return { error: `“${value}” isn’t a valid amount — use numbers like 25 or 25.50.` }
      globals.set(g[1], { ...(globals.get(g[1]) ?? {}), [g[2]]: Number(value) })
      continue
    }
    const m = /^([a-z-]+)\.(\d+)\.([a-zA-Z]+)$/.exec(key)
    if (!m || typeof raw !== 'string') continue
    const [, collection, id, field] = m
    const rule = EDITABLE[collection]
    if (!rule?.fields.includes(field)) return { error: `“${field}” can’t be changed here.` }
    const before = String(fd.get(`$orig:${key}`) ?? '')
    const value = raw.trim()
    if (value === before) continue
    if (value === '') {
      if (!rule.nullable?.includes(field)) return { error: 'A price can’t be empty — enter 0 for free.' }
    } else if (!/^\d+(\.\d{1,2})?$/.test(value)) {
      return { error: `“${value}” isn’t a valid amount — use numbers like 25 or 25.50.` }
    }
    const k = `${collection}.${id}`
    const c = changes.get(k) ?? { collection, id: Number(id), data: {} }
    c.data[field] = value === '' ? null : Number(value)
    changes.set(k, c)
  }
  if (!changes.size && !globals.size) return { done: 'No changes to save.' }
  let saved = 0
  try {
    for (const [slug, values] of globals) {
      const rule = EDITABLE_GLOBAL[slug]
      const current = (await payload.findGlobal({ slug: slug as 'pdr-settings', depth: 0, overrideAccess: true })) as unknown as Record<string, Record<string, unknown>>
      await payload.updateGlobal({ slug: slug as 'pdr-settings', data: { [rule.group]: { ...(current[rule.group] ?? {}), ...values } } as never, user, overrideAccess: false })
      saved += Object.keys(values).length
    }
    for (const c of changes.values()) {
      await payload.update({ collection: c.collection as 'programs', id: c.id, data: c.data as never, user, overrideAccess: false })
      saved += Object.keys(c.data).length
    }
  } catch (e) {
    return { error: `Saved ${saved}, then failed: ${e instanceof Error ? e.message : String(e)}`, saved }
  }
  return { done: `Saved ${saved} price${saved === 1 ? '' : 's'}.`, saved }
}
