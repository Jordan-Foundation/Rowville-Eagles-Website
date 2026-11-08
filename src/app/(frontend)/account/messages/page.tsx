import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { payload } from '@/lib/payload'
import { academyBrand } from '@/academy/brand'
import { conversationFor, markRead, thread } from '@/messaging/service'
import { toThread } from '@/messaging/view'
import { Thread } from '@/components/messaging/Thread'
import { familySendAction } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Messages', robots: { index: false } }

export default async function FamilyMessages() {
  const user = await currentUser()
  if (!user) redirect('/login?next=/account/messages')
  const p = await payload()
  const conv = await conversationFor(p, { account: user })
  const msgs = await thread(p, conv)
  await markRead(p, conv, user.id)
  const number = process.env.TWILIO_FROM
  return (
    <div className="container-x max-w-3xl py-14">
      <Link href="/account" className="text-sm text-muted hover:text-ink">← My account</Link>
      <h1 className="mt-4 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Messages</h1>
      <p className="mt-2 text-muted">
        Your conversation with Foundation Academy coaches and staff. {number ? `Texts you send to ${number.replace(/^\+61/, '0').replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3')} appear here too, and replies come by text.` : 'Replies come by text or email.'}
      </p>
      {user.smsOptOut && <p className="mt-4 rounded-xl border border-line px-4 py-3 text-sm">You’ve turned texts off, so replies will be emailed to you. <Link href="/account/preferences" className="underline">Change this</Link>.</p>}
      <div className="mt-8">
        <Thread messages={toThread(msgs, 'family')} action={familySendAction} placeholder="Write to your coach…" hint={`Urgent? Call ${academyBrand.phone}.`} empty="No messages yet. Send one below and your coach will reply." />
      </div>
    </div>
  )
}
