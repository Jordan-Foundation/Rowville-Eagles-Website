import Link from 'next/link'
import type { Metadata } from 'next'
import { payload, formatDate } from '@/lib/payload'
import { requireManagement } from '@/lib/management'
import { trialInvitesDue } from '@/lib/trials'
import { groupLabel } from '@/lib/age-groups'
import { sendInvitesAction } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Send trial dates', robots: { index: false } }

/** Preview, then Send: families waiting for a trial whose age group already has trial nights but who haven't been told (e.g. imported EOIs). */
export default async function TrialInvitesPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  await requireManagement('/management/selections/trial-invites')
  const { sent } = await searchParams
  const due = await trialInvitesDue(await payload())
  const byGroup = new Map<string, number>()
  for (const d of due) byGroup.set(groupLabel(d.reg.birthYear!), (byGroup.get(groupLabel(d.reg.birthYear!)) ?? 0) + 1)
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Send trial dates</h1>
        <p className="mt-2 text-muted">Families waiting for a trial whose age group already has trial nights set, but who haven’t been sent the dates yet — usually EOIs brought across from the old form. Each gets an email and a text with a one-tap “Confirm my trial spot” link, and one reminder 3 days later if they haven’t confirmed. Families who register from now on, or whose dates are set later, are sent the dates automatically.</p>
      </div>
      {sent && <p role="status" className="border border-line bg-white/5 p-3 text-sm">Sent to {sent} famil{sent === '1' ? 'y' : 'ies'}.</p>}
      {due.length ? (
        <form action={sendInvitesAction} className="space-y-4" aria-label="Send trial dates">
          <p className="text-sm">{due.length} famil{due.length === 1 ? 'y' : 'ies'} to send · {[...byGroup].map(([g, n]) => `${g}: ${n}`).join(' · ')}</p>
          <ul className="divide-y divide-line border border-line" aria-label="Families to send">
            {due.map(({ reg, session }) => (
              <li key={reg.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm" data-invite={reg.reference}>
                <label className="flex items-start gap-3">
                  <input type="checkbox" name="id" value={reg.id} defaultChecked className="mt-1" />
                  <span>
                    <span className="font-semibold">{reg.player.firstName} {reg.player.lastName}</span> · {groupLabel(reg.birthYear!)}
                    <span className="block text-muted">{reg.contact.firstName} {reg.contact.lastName} · {reg.contact.email} · {reg.contact.phone}{reg.source === 'import' ? ' · imported' : ''}</span>
                  </span>
                </label>
                <span className="text-muted">First night {formatDate(session.start, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
          <button className="min-h-11 bg-white px-5 text-xs font-semibold uppercase tracking-[0.12em] text-black">Send email + text to ticked families</button>
        </form>
      ) : (
        <p className="text-sm text-muted">Nobody is waiting — every family whose age group has trial nights has been sent the dates.</p>
      )}
      <p className="text-sm"><Link href="/management/selections?kind=rowville" className="underline">← Eagles selections</Link></p>
    </div>
  )
}
