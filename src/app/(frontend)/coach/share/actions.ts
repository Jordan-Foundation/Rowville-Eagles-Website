'use server'

import { revalidatePath } from 'next/cache'
import { coachOrNull } from '@/academy/portal'
import { payload } from '@/lib/payload'
import { cancelShareLink, createShareLink, resendShareLink, ShareLinkError } from '@/academy/share-links'
import { HOLD_CHOICES } from '@/academy/share-rules'

export type ShareState = { error?: string; url?: string; sent?: string }

const MOBILE = /^(\+?61|0)4\d{8}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function createShareAction(_prev: ShareState, fd: FormData): Promise<ShareState> {
  const c = await coachOrNull()
  if (!c) return { error: 'Please log in as a coach.' }
  const s = (k: string) => String(fd.get(k) ?? '').trim()
  const slot = s('slot')
  const mode = slot.startsWith('term|') ? 'term' : 'casual'
  const [, a, b] = slot.split('|')
  const client = { firstName: s('firstName'), lastName: s('lastName'), email: s('email').toLowerCase(), mobile: s('mobile').replace(/\s+/g, ''), playerFirstName: s('playerFirstName') }
  if (!slot) return { error: 'Choose a time.' }
  if (!client.firstName || !client.lastName) return { error: 'Enter the parent’s first and last name.' }
  if (!EMAIL.test(client.email)) return { error: 'Enter the parent’s email address.' }
  if (client.mobile && !MOBILE.test(client.mobile)) return { error: 'Enter an Australian mobile, e.g. 0412 345 678 (or leave it empty).' }
  const holdHours = Number(s('holdHours'))
  if (!HOLD_CHOICES.includes(holdHours)) return { error: 'Choose how long to hold the time.' }
  try {
    const r = await createShareLink(await payload(), {
      coach: c.coach,
      user: c.user,
      mode,
      ...(mode === 'term' ? { weekday: a, startTime: b } : { startsAt: a }),
      client,
      message: s('message').slice(0, 500),
      holdHours,
      viaEmail: fd.get('viaEmail') === 'on',
      viaSms: fd.get('viaSms') === 'on' && Boolean(client.mobile),
    })
    revalidatePath('/coach/share')
    const how = [r.sentEmail && 'emailed', r.sentSms && 'texted'].filter(Boolean).join(' and ')
    return { url: r.url, sent: how ? `Link ${how} to ${client.firstName}.` : 'Link created — copy it below to send it yourself.' }
  } catch (e) {
    if (e instanceof ShareLinkError) return { error: e.message }
    throw e
  }
}

export async function linkAction(_prev: ShareState, fd: FormData): Promise<ShareState> {
  const c = await coachOrNull()
  if (!c) return { error: 'Please log in as a coach.' }
  const p = await payload()
  const id = Number(fd.get('id'))
  try {
    if (fd.get('do') === 'cancel') await cancelShareLink(p, c.coach.id, id)
    else await resendShareLink(p, c.coach, id)
  } catch (e) {
    if (e instanceof ShareLinkError) return { error: e.message }
    throw e
  }
  revalidatePath('/coach/share')
  return { sent: fd.get('do') === 'cancel' ? 'Link cancelled and the time released.' : 'Sent again with a fresh link.' }
}
