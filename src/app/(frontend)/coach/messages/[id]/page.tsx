import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireCoach } from '@/academy/portal'
import { payload } from '@/lib/payload'
import { canSee, markRead, receiptFor, thread } from '@/messaging/service'
import { toThread } from '@/messaging/view'
import { staffSendAction } from '@/messaging/management-actions'
import { Thread } from '@/components/messaging/Thread'
import type { User } from '@/payload-types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Conversation', robots: { index: false } }

export default async function CoachThread({ params }: { params: Promise<{ id: string }> }) {
  const { user, coach } = await requireCoach('/coach/messages')
  const { id } = await params
  const p = await payload()
  const conv = await p.findByID({ collection: 'conversations', id: Number(id), depth: 1, overrideAccess: true, disableErrors: true })
  if (!conv || !canSee({ user, side: 'coach', coach }, conv)) notFound()
  const msgs = await thread(p, conv)
  await markRead(p, conv, user.id)
  const seen = await receiptFor(p, conv, msgs, 'management')
  const family = conv.account as User | null
  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/coach/messages" className="text-sm text-muted hover:text-ink">← Messages</Link>
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase">{conv.title}</h1>
        <p className="mt-1 text-sm text-muted">{family?.smsOptOut ? 'This family has turned texts off — replies are emailed.' : family?.phone ? 'Replies are texted to the parent’s mobile.' : 'No mobile on file — replies are emailed.'}</p>
      </div>
      <Thread seen={seen} messages={toThread(msgs, 'management')} action={staffSendAction} hidden={{ conversation: conv.id }} placeholder={`Reply to ${conv.title}…`} hint="Signed with your name. Keep it about training — admins can see every message." empty="No messages yet." />
    </div>
  )
}
