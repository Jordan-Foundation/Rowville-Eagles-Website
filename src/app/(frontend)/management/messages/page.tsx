import { requireManagement } from '@/lib/management'
import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { inbox } from '@/messaging/service'
import { InboxList } from '@/components/messaging/InboxList'
import { AutoRefresh } from '@/components/messaging/AutoRefresh'
import { formatDate } from '@/lib/payload'
import { toE164 } from '@/lib/sms'
import { SmsTest } from './SmsTest'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Messages', robots: { index: false } }

export default async function StaffMessages({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireManagement('/management/messages')
  const filter = (await searchParams).filter === 'unassigned' ? 'unassigned' : 'all'
  const p = await payload()
  const items = await inbox(p, { user, side: 'management' }, { filter })
  const unassigned = filter === 'all' ? items.filter((i) => !i.conv.account).length : items.length
  // Text alerts: who gets them, a test button, and the latest text problems (from the message log)
  const site = await p.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })
  const alertNumbers = String(site.smsAlertNumbers ?? '').split(',').map((x) => toE164(x)).filter(Boolean) as string[]
  const { docs: problems } = await p.find({ collection: 'message-log', where: { and: [{ channel: { in: ['sms', 'sms_in'] } }, { status: { equals: 'failed' } }] }, sort: '-createdAt', limit: 5, depth: 0, overrideAccess: true })
  return (
    <div className="container-x py-14">
      <AutoRefresh />
      <p className="eyebrow !text-brand">Management</p>
      <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Messages</h1>
      <p className="mt-2 max-w-2xl text-muted">Every conversation with families — texts to the Foundation Academy number, portal messages, and coach replies.</p>
      <div className="mt-6 flex gap-2 text-sm">
        <Link href="/management/messages" className={`px-4 py-2 ${filter === 'all' ? 'bg-ink text-surface' : 'border border-line'}`}>All</Link>
        <Link href="/management/messages?filter=unassigned" className={`px-4 py-2 ${filter === 'unassigned' ? 'bg-ink text-surface' : 'border border-line'}`}>Unassigned{unassigned ? ` (${unassigned})` : ''}</Link>
      </div>
      <div className="mt-6"><InboxList items={items} base="/management/messages" empty="No messages yet." /></div>
      <details className="mt-10 border border-line p-5" open={problems.length > 0} data-sms-alerts>
        <summary className="cursor-pointer font-semibold">Urgent text alerts {alertNumbers.length ? `(${alertNumbers.map((n) => n.replace(/^\+61/, '0')).join(', ')})` : '— no numbers set'}</summary>
        <p className="mt-2 text-sm text-muted">New messages now come as free notifications on Management phones (turn them on in Management → Notifications). These mobiles only get texts for urgent events — a session in the next 48 hours cancelled or moved, and cover needed. Change them in Admin → Site settings → “Urgent text alerts”.</p>
        <div className="mt-3"><SmsTest /></div>
        {problems.length > 0 && (
          <div className="mt-5">
            <h2 className="text-sm font-semibold">Latest text problems</h2>
            <ul className="mt-1 space-y-1 text-xs">{problems.map((m) => <li key={m.id}><span className="text-muted">{formatDate(m.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {m.channel === 'sms_in' ? 'incoming' : `to ${m.to}`}:</span> {m.subject?.slice(0, 80)} — <strong>{m.error}</strong></li>)}</ul>
          </div>
        )}
      </details>
    </div>
  )
}
