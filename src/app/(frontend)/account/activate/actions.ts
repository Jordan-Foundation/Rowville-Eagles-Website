'use server'

import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { inviteOwner } from '@/lib/invites'

/** "Email me a new link" from an expired activation (or short) link. */
export async function newLinkAction(fd: FormData) {
  const p = await payload()
  const { rateLimit } = await import('@/lib/form-guard')
  const limited = await rateLimit(p, 'new-link', { perIp: 5 })
  if (limited) redirect(`/account/activate?expired=1&error=${encodeURIComponent(limited)}`)
  const token = String(fd.get('invite') ?? '')
  const code = String(fd.get('code') ?? '')
  let userId = token ? await inviteOwner(p, token) : null
  if (!userId && /^[A-Za-z0-9]{4,12}$/.test(code)) userId = (await p.find({ collection: 'users', where: { 'launch.shortCode': { equals: code } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]?.id ?? null
  if (userId) await (await import('@/launch/service')).emailNewLink(p, userId)
  // Same message either way, so the page can't be used to find out who has an account
  redirect('/account/activate?sent=1')
}
