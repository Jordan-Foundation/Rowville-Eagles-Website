'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { managementOrNull } from '@/lib/management'
import { payload } from '@/lib/payload'
import { DATE_FIELDS, parseDateInput } from '@/lib/dates-edit'
import { PROGRAM_GROUPS, scopeEmpty } from '@/promotions/rules'

export type PromoState = { error?: string; ok?: string }
const nums = (fd: FormData, k: string) => fd.getAll(k).map(Number).filter((n) => Number.isInteger(n) && n > 0)
const GROUPS = new Set<string>(PROGRAM_GROUPS.map((g) => g.value))

/** Save a promotion (draft, live or ended). Only these fields are written; the discount itself is always worked out at checkout. */
export async function savePromotionAction(_prev: PromoState, fd: FormData): Promise<PromoState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Management only.' }
  const id = fd.get('id') ? Number(fd.get('id')) : null
  const intent = String(fd.get('intent') ?? 'save')
  const name = String(fd.get('name') ?? '').trim().slice(0, 80)
  if (!name) return { error: 'Give the promotion a name families will see, e.g. “Winter special”.' }
  const type = fd.get('type') === 'amount' ? ('amount' as const) : ('percent' as const)
  const value = Number(fd.get('value'))
  if (!(value > 0) || (type === 'percent' && value > 100) || !/^\d+(\.\d{1,2})?$/.test(String(fd.get('value') ?? ''))) return { error: type === 'percent' ? 'Enter a percentage from 1 to 100.' : 'Enter the dollars off, e.g. 15.' }
  const usesRaw = String(fd.get('usesPerFamily') ?? '').trim()
  const usesPerFamily = usesRaw ? Number(usesRaw) : null
  if (usesPerFamily !== null && (!Number.isInteger(usesPerFamily) || usesPerFamily < 1 || usesPerFamily > 100)) return { error: 'Uses per family must be a whole number (or leave it empty for no limit).' }
  let startsAt: string | null, endsAt: string | null
  try {
    startsAt = parseDateInput(DATE_FIELDS['programs.startDate'], String(fd.get('startsAt') ?? '')) as string | null
    endsAt = parseDateInput(DATE_FIELDS['programs.endDate'], String(fd.get('endsAt') ?? '')) as string | null
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Check the dates.' }
  }
  if (startsAt && endsAt && endsAt <= startsAt) return { error: 'The end must be after the start.' }

  const scope = {
    everything: fd.get('everything') === 'on',
    programGroups: fd.getAll('programGroups').map(String).filter((g) => GROUPS.has(g)) as ('holiday-camp' | 'academy-term' | 'toddler' | 'academy-trial' | 'registration' | 'other')[],
    programs: nums(fd, 'programs'),
    oneOnOneAll: fd.get('oneOnOneAll') === 'on',
    oneOnOneTerms: nums(fd, 'oneOnOneTerms'),
    shopAll: fd.get('shopAll') === 'on',
    products: nums(fd, 'products'),
    tournamentsAll: fd.get('tournamentsAll') === 'on',
    tournamentRounds: nums(fd, 'tournamentRounds'),
    foundationPlus: fd.get('foundationPlus') === 'on',
  }

  // Families: hand-picked by email (the audience picker and sending come with the message step)
  const p = await payload()
  const emails = [...new Set(String(fd.get('emails') ?? '').toLowerCase().split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean))]
  const { docs: found } = emails.length ? await p.find({ collection: 'users', where: { email: { in: emails } }, limit: emails.length, depth: 0, overrideAccess: true, select: { email: true } }) : { docs: [] }
  const missing = emails.filter((e) => !found.some((u) => u.email.toLowerCase() === e))
  if (missing.length) return { error: `No account found for: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}` }

  const status: 'live' | 'ended' | 'draft' | undefined = intent === 'live' ? 'live' : intent === 'end' ? 'ended' : intent === 'draft' ? 'draft' : undefined
  if (status === 'live') {
    if (scopeEmpty(scope)) return { error: 'Choose what the promotion applies to.' }
    if (!found.length) return { error: 'Add at least one family before making it live.' }
    if (endsAt && Date.parse(endsAt) < Date.now()) return { error: 'The end date has already passed.' }
  }
  const data = { name, type, value, usesPerFamily, startsAt, endsAt, ...scope, recipients: found.map((u) => u.id), ...(status ? { status } : {}) }
  let savedId = id
  try {
    if (id) await p.update({ collection: 'promotions', id, data, user, overrideAccess: false })
    else savedId = (await p.create({ collection: 'promotions', data: { ...data, status: status ?? 'draft' }, user, overrideAccess: false })).id
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save.' }
  }
  revalidatePath('/management/promotions')
  redirect(`/management/promotions/${savedId}?saved=${status ?? 'saved'}`)
}
