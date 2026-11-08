'use server'

import { revalidatePath } from 'next/cache'
import { currentUser } from '@/lib/auth'
import { payload } from '@/lib/payload'
import { assignToAccount, conversationFor, MessageError, staffReply, viewerFor } from './service'
import type { SendState } from '@/components/messaging/Thread'

const SENT = { sms: 'Texted to the family.', email: 'Couldn’t text this family (no mobile, texts turned off, or texting not set up) — emailed instead.', failed: 'Not delivered — this number can’t be texted right now.' } as const

export async function staffSendAction(_prev: SendState, fd: FormData): Promise<SendState> {
  const p = await payload()
  const v = await viewerFor(p, await currentUser())
  if (!v || v.side === 'family') return { error: 'Please log in again.' }
  try {
    const r = await staffReply(p, v, Number(fd.get('conversation')), String(fd.get('body') ?? ''))
    revalidatePath(v.side === 'coach' ? '/coach/messages' : '/staff/messages', 'layout')
    return r.delivery === 'failed' ? { error: SENT.failed } : { sent: SENT[r.delivery], key: Date.now() }
  } catch (e) {
    if (e instanceof MessageError) return { error: e.message }
    throw e
  }
}

export type AssignState = { error?: string }

export async function assignAction(_prev: AssignState, fd: FormData): Promise<AssignState> {
  const p = await payload()
  const v = await viewerFor(p, await currentUser())
  if (!v || v.side !== 'staff') return { error: 'Admins only.' }
  try {
    const target = await assignToAccount(p, Number(fd.get('conversation')), String(fd.get('email') ?? ''))
    revalidatePath('/staff/messages', 'layout')
    const { redirect } = await import('next/navigation')
    redirect(`/staff/messages/${target.id}`)
  } catch (e) {
    if (e instanceof MessageError) return { error: e.message }
    throw e
  }
  return {}
}

/** Coaches/admins start a conversation with a family (opens their thread). */
export async function startConversationAction(fd: FormData) {
  const p = await payload()
  const v = await viewerFor(p, await currentUser())
  if (!v || v.side === 'family') return
  const account = await p.findByID({ collection: 'users', id: Number(fd.get('account')), depth: 0, overrideAccess: true, disableErrors: true })
  if (!account) return
  const conv = await conversationFor(p, { account })
  const { redirect } = await import('next/navigation')
  if (v.side === 'coach' && !(conv.coaches ?? []).map((c) => (typeof c === 'object' ? c.id : c)).includes(v.coach!.id)) redirect('/coach/messages?error=not-yours')
  redirect(`${v.side === 'coach' ? '/coach' : '/staff'}/messages/${conv.id}`)
}
