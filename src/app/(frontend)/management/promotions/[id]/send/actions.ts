'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { managementOrNull } from '@/lib/management'
import { payload } from '@/lib/payload'
import { DATE_FIELDS, parseDateInput } from '@/lib/dates-edit'
import { localYmd } from '@/lib/time'
import { SMS_MAX, type Audience } from '@/promotions/audience'
import { audiencePreview, continuePromotionSend, sendPromotion } from '@/promotions/send'
import { scopeEmpty } from '@/promotions/rules'
import { toLive } from '@/promotions/service'

export type SendState = { error?: string; ok?: string }
const MEMBERSHIPS = new Set(['rowville', 'rfa', 'foundation-plus'])

function readAudience(fd: FormData): Audience {
  const mode = String(fd.get('mode')) as Audience['mode']
  return {
    mode: mode === 'all' || mode === 'picked' ? mode : 'filter',
    memberships: fd.getAll('memberships').map(String).filter((m) => MEMBERSHIPS.has(m)),
    history: fd.getAll('history').map(String).filter((h) => /^(1on1|shop|program:\d+)$/.test(h)),
    birthYears: fd.getAll('birthYears').map(Number).filter((y) => y > 1990 && y < 2100),
    teams: fd.getAll('teams').map(Number).filter((t) => Number.isInteger(t) && t > 0),
    emails: String(fd.get('emails') ?? '').slice(0, 20000),
  }
}

/** Save the audience + message (draft) and come back to the preview. */
export async function saveSendAction(_prev: SendState, fd: FormData): Promise<SendState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Management only.' }
  const id = Number(fd.get('id'))
  const audience = readAudience(fd)
  const channels = fd.getAll('channels').map(String).filter((c) => c === 'email' || c === 'sms') as ('email' | 'sms')[]
  const subject = String(fd.get('subject') ?? '').trim().slice(0, 120)
  const message = String(fd.get('message') ?? '').trim().slice(0, 3000)
  const smsText = String(fd.get('smsText') ?? '').trim().slice(0, SMS_MAX)
  const ctaPath = String(fd.get('ctaPath') ?? '').trim()
  if (ctaPath && !/^\/[\w\-/?=&#.%]*$/.test(ctaPath)) return { error: 'The button link must be a page on this website, starting with “/”, e.g. /programs.' }
  if (channels.includes('email') && (!subject || !message)) return { error: 'Write the email subject and message (or untick Email).' }
  if (channels.includes('sms') && !smsText) return { error: 'Write the text message (or untick Text message).' }
  const p = await payload()
  const preview = await audiencePreview(p, audience)
  if (preview.unknown.length) return { error: `No account found for: ${preview.unknown.slice(0, 5).join(', ')}${preview.unknown.length > 5 ? '…' : ''}` }
  await p.update({ collection: 'promotions', id, user, overrideAccess: false, data: { audience, channels, subject, message, smsText, ctaPath: ctaPath || null, brand: fd.get('brand') === 'club' ? 'club' : 'academy' } })
  revalidatePath(`/management/promotions/${id}/send`)
  redirect(`/management/promotions/${id}/send?preview=1#preview`)
}

async function readyToSend(id: number) {
  const p = await payload()
  const d = await p.findByID({ collection: 'promotions', id, depth: 0, overrideAccess: true })
  if (d.sentAt) return { p, d, error: 'This promotion has already been sent.' }
  if (d.status === 'ended') return { p, d, error: 'This promotion has ended.' }
  if (scopeEmpty(toLive(d))) return { p, d, error: 'Choose what the promotion applies to first (on the promotion page).' }
  if (d.endsAt && Date.parse(d.endsAt) < Date.now()) return { p, d, error: 'The promotion’s end date has passed.' }
  const pv = await audiencePreview(p, (d.audience ?? { mode: 'picked' }) as Audience)
  if (!pv.families) return { p, d, error: 'Nobody matches the audience yet.' }
  return { p, d, error: null as string | null }
}

export async function approveSendAction(_prev: SendState, fd: FormData): Promise<SendState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Management only.' }
  const id = Number(fd.get('id'))
  const { p, error } = await readyToSend(id)
  if (error) return { error }
  try {
    const c = await sendPromotion(p, id, user.id)
    revalidatePath('/management/promotions')
    return { ok: `${c.finished ? 'Sent' : 'Sending'} — ${c.audience} famil${c.audience === 1 ? 'y gets' : 'ies get'} the discount · ${c.email.sent} emailed · ${c.sms.sent} texted · ${c.email.skipped + c.sms.skipped} skipped (no marketing consent)${c.finished ? '' : ` · ${c.remaining} still to go`}.` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not send.' }
  }
}

export async function scheduleAction(_prev: SendState, fd: FormData): Promise<SendState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Management only.' }
  const id = Number(fd.get('id'))
  if (fd.get('cancel') === '1') {
    await (await payload()).update({ collection: 'promotions', id, user, overrideAccess: false, data: { status: 'draft', scheduledFor: null } })
    revalidatePath(`/management/promotions/${id}/send`)
    return { ok: 'Schedule cancelled — it’s a draft again.' }
  }
  const { p, error } = await readyToSend(id)
  if (error) return { error }
  let when: string | null
  try {
    // Sent by the daily morning job (about 6am Melbourne) on that day
    when = parseDateInput(DATE_FIELDS['academy-terms.startDate'], String(fd.get('date') ?? '')) as string | null
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Choose a date.' }
  }
  if (!when) return { error: 'Choose a date.' }
  if (localYmd(new Date(when)) <= localYmd(new Date())) return { error: 'Choose tomorrow or later — to send today, use “Approve & send now”.' }
  await p.update({ collection: 'promotions', id, user, overrideAccess: false, data: { status: 'scheduled', scheduledFor: when, approvedBy: user.id } })
  revalidatePath(`/management/promotions/${id}/send`)
  revalidatePath('/management/promotions')
  return { ok: 'Scheduled — it goes out at about 6am that day.' }
}

/** Carry on a send that ran out of time (it also carries on by itself each morning). */
export async function continueSendAction(fd: FormData) {
  const user = await managementOrNull()
  if (!user) return
  const id = Number(fd.get('id'))
  await continuePromotionSend(await payload(), id)
  revalidatePath(`/management/promotions/${id}/send`)
}
