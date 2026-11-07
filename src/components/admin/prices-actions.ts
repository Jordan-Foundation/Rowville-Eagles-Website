'use server'

import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { hasRole } from '@/access'
import { EDITABLE } from './prices-data'

export type PricesState = { done?: string; error?: string; saved?: number }

/** Save only the prices that changed (fields arrive as "<collection>.<id>.<field>"). */
export async function savePrices(_prev: PricesState, fd: FormData): Promise<PricesState> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user || user.collection !== 'users' || !hasRole(user as never, 'admin', 'committee')) return { error: 'Only admins can change prices.' }

  const changes = new Map<string, { collection: string; id: number; data: Record<string, number | null> }>()
  for (const [key, raw] of fd.entries()) {
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
  if (!changes.size) return { done: 'No changes to save.' }
  let saved = 0
  try {
    for (const c of changes.values()) {
      await payload.update({ collection: c.collection as 'programs', id: c.id, data: c.data as never, user, overrideAccess: false })
      saved += Object.keys(c.data).length
    }
  } catch (e) {
    return { error: `Saved ${saved}, then failed: ${e instanceof Error ? e.message : String(e)}`, saved }
  }
  return { done: `Saved ${saved} price${saved === 1 ? '' : 's'}.`, saved }
}
