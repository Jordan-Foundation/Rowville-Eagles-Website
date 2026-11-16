import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { TZ } from '@/lib/time'
import { SECTION, ORDER, type FeedKind } from '@/staff-feed/rules'
import { alertNumbers, digestRecipients } from '@/staff-feed/service'
import { sendSummaryNow } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Notifications', robots: { index: false } }

const when = (iso: string) => new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
const TEXT: Record<string, string> = { sent: '📱 texted', held: '🌙 text at 7am', failed: '⚠️ text failed' }

/** Everything that happened on the website (last 14 days), who is told, and how. */
export default async function Notifications({ searchParams }: { searchParams: Promise<{ kind?: string; done?: string; error?: string }> }) {
  await requireManagement('/management/notifications')
  const sp = await searchParams
  const p = await payload()
  const kind = ORDER.find((k) => k === sp.kind) as FeedKind | undefined
  const { docs } = await p.find({ collection: 'staff-feed', where: { and: [{ createdAt: { greater_than: new Date(Date.now() - 14 * 86_400_000).toISOString() } }, ...(kind ? [{ kind: { equals: kind } }] : [])] }, sort: '-createdAt', limit: 300, pagination: false, depth: 0, overrideAccess: true })
  const [numbers, emails] = await Promise.all([alertNumbers(p), digestRecipients(p)])
  const pending = docs.filter((d) => !d.digestedAt).length
  const chip = (on: boolean) => `px-3 py-1.5 text-sm ${on ? 'bg-ink text-surface' : 'border border-line'}`
  return (
    <div className="container-x py-14">
      <p className="eyebrow !text-brand">Management</p>
      <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Notifications</h1>
      <p className="mt-2 max-w-3xl text-muted">Every booking, payment, trial sign-up and problem on the website. Urgent ones (a session in the next 48 hours booked, cancelled or moved; cover needed; a trial sign-up) are texted straight away — between 9pm and 7am they’re held and sent together at 7am. Everything goes in the 8pm summary email (skipped when nothing happened).</p>
      {sp.done && <p role="status" className="mt-6 border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm">{sp.done}</p>}
      {sp.error && <p role="alert" className="mt-6 border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm">{sp.error}</p>}
      <div className="mt-6 grid gap-4 border border-line p-5 text-sm sm:grid-cols-2" data-recipients>
        <div><p className="font-semibold">Texts go to</p><p className="text-muted">{numbers.length ? numbers.map((n) => n.replace(/^\+61/, '0')).join(', ') : 'No numbers set'}</p></div>
        <div><p className="font-semibold">8pm summary goes to</p><p className="text-muted">{emails.length ? emails.join(', ') : 'No one yet'}</p></div>
        <p className="text-xs text-muted sm:col-span-2">Change these in Admin → Site settings (“Text alerts for new messages” and “Daily summary emails”). Test the texts from <Link href="/management/messages" className="underline">Messages</Link>.</p>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Filter">
          <Link href="/management/notifications" className={chip(!kind)}>All</Link>
          {ORDER.map((k) => <Link key={k} href={`/management/notifications?kind=${k}`} className={chip(kind === k)}>{SECTION[k]}</Link>)}
        </nav>
        <form action={sendSummaryNow}><button className="border border-line px-4 py-2 text-sm font-semibold">Send the summary now{pending ? ` (${pending} new)` : ''}</button></form>
      </div>
      <ul className="mt-4 divide-y divide-line border border-line" aria-label="Notifications">
        {docs.map((d) => (
          <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-2 p-4 text-sm" data-feed={d.kind}>
            <span>
              <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-semibold ${d.kind === 'problem' ? 'bg-red-600 text-white' : 'bg-surface-2'}`}>{SECTION[d.kind as FeedKind]}</span>
              {d.href ? <Link href={d.href} className="font-semibold underline">{d.title}</Link> : <strong>{d.title}</strong>}
              {d.detail && <span className="text-muted"> — {d.detail}</span>}
            </span>
            <span className="text-xs text-muted">{when(d.createdAt)}{d.urgent && TEXT[d.textStatus ?? ''] ? ` · ${TEXT[d.textStatus ?? '']}` : ''}{d.digestedAt ? ' · in summary' : ''}</span>
          </li>
        ))}
        {!docs.length && <li className="p-4 text-sm text-muted">Nothing in the last 14 days.</li>}
      </ul>
    </div>
  )
}
