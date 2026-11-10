import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Announcements', robots: { index: false } }

const STATUS: Record<string, string> = { 'needs-approval': 'Waiting for your approval', scheduled: 'Scheduled', sending: 'Sending', sent: 'Sent', cancelled: 'Not sent' }

/** "Registrations are open" messages and the reminders a week later. */
export default async function AnnouncementsPage() {
  await requireManagement('/management/announcements')
  const { docs } = await (await payload()).find({ pagination: false, collection: 'announcements', sort: '-createdAt', limit: 100, depth: 1, overrideAccess: true })
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Announcements</h1>
        <p className="mt-2 max-w-3xl text-muted">When an Academy term opens for registrations, every family opted in to marketing gets an email and text. The first one each year waits for you to check and approve it; after that they go automatically. A week later, families who haven’t registered get a reminder.</p>
      </div>
      <ul className="divide-y divide-line border border-line">
        {docs.map((a) => (
          <li key={a.id}>
            <Link href={`/management/announcements/${a.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-white/5">
              <span><span className="font-semibold">{a.subject}</span><span className="block text-sm text-muted">{a.kind === 'reminder' ? 'Reminder' : 'Registrations open'} · {a.sentAt ? `sent ${formatDate(a.sentAt, { day: 'numeric', month: 'short' })}` : a.scheduledFor ? `due ${formatDate(a.scheduledFor, { day: 'numeric', month: 'short' })}` : ''}</span></span>
              <span className={`text-sm ${a.status === 'needs-approval' ? 'font-semibold text-amber-300' : 'text-muted'}`}>{STATUS[a.status]}</span>
            </Link>
          </li>
        ))}
        {docs.length === 0 && <li className="p-4 text-sm text-muted">Nothing yet — announcements are created when an Academy term opens.</li>}
      </ul>
    </div>
  )
}
