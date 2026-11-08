import { requireManagement } from '@/lib/management'
import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { markRead, thread } from '@/messaging/service'
import { toThread } from '@/messaging/view'
import { staffSendAction } from '@/messaging/management-actions'
import { Thread } from '@/components/messaging/Thread'
import { AssignForm } from '@/components/messaging/AssignForm'
import type { AcademyCoach, User } from '@/payload-types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Conversation', robots: { index: false } }

export default async function StaffThread({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireManagement('/management/messages')
  const { id } = await params
  const p = await payload()
  const conv = await p.findByID({ collection: 'conversations', id: Number(id), depth: 1, overrideAccess: true, disableErrors: true })
  if (!conv) notFound()
  const msgs = await thread(p, conv)
  await markRead(p, conv, user.id)
  const family = conv.account as User | null
  const coaches = (conv.coaches ?? []).filter((c): c is AcademyCoach => typeof c === 'object').map((c) => c.displayName)
  return (
    <div className="container-x max-w-3xl space-y-6 py-14">
      <Link href="/management/messages" className="text-sm text-muted hover:text-ink">← Messages</Link>
      <div>
        <h1 className="font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase">{conv.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {family ? <>{family.email}{family.phone ? ` · ${family.phone}` : ''}{family.smsOptOut ? ' · texts off' : ''} · <Link href={`/admin/collections/users/${family.id}`} className="underline">account</Link></> : conv.phone}
          {' · '}Coaches: {coaches.length ? coaches.join(', ') : 'none'}
        </p>
      </div>
      {!family && <AssignForm conversation={conv.id} />}
      <Thread messages={toThread(msgs, 'management')} action={staffSendAction} hidden={{ conversation: conv.id }} placeholder={`Reply to ${conv.title}…`} hint="Signed with your first name." empty="No messages yet." />
    </div>
  )
}
