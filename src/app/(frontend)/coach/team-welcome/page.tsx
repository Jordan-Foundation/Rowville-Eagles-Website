import type { Metadata } from 'next'
import Link from 'next/link'
import { payload } from '@/lib/payload'
import { requireCoach } from '@/academy/portal'
import { groupLabel } from '@/lib/age-groups'
import type { SelectionRound } from '@/payload-types'
import { saveWelcomeAction } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Team welcome message' }

/** "Write a welcome message for your team" — it goes in the email families get when the team is finalised. */
export default async function TeamWelcomePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { user, coach } = await requireCoach('/coach/team-welcome')
  const sp = await searchParams
  const p = await payload()
  const { docs: squads } = await p.find({ collection: 'squads', where: { coaches: { contains: user.id } }, sort: '-createdAt', limit: 50, depth: 1, overrideAccess: true, pagination: false })
  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/coach" className="text-sm text-muted hover:text-ink">← Overview</Link>
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Team welcome message</h1>
        <p className="mt-2 text-muted">A short hello to your new team’s families (up to 600 characters). It goes in their team email with your name, photo and bio from <Link href="/coach/profile" className="underline">your profile</Link>{coach.photo ? '' : ' — add a photo there too'}.</p>
      </div>
      {sp.error && <p role="alert" className="border border-red-400/40 p-3 text-sm text-red-200">{sp.error}</p>}
      {squads.map((s) => {
        const round = s.round as SelectionRound
        const done = Boolean(s.finalisedAt)
        return (
          <form key={s.id} action={saveWelcomeAction} className="space-y-3 border border-line p-5" aria-label={`Welcome message for ${s.name}`} data-welcome={s.name}>
            <input type="hidden" name="squad" value={s.id} />
            <h2 className="font-display text-2xl font-semibold uppercase">{s.name}</h2>
            <p className="text-sm text-muted">{round?.title}{s.birthYears?.[0] ? ` · ${groupLabel(s.birthYears[0])}` : ''}{done ? ' · team finalised' : ''}{s.teamEmailSentAt ? ' · team email sent' : ''}</p>
            {sp.saved === String(s.id) && <p role="status" className="text-sm text-emerald-300">Saved — thanks!</p>}
            <textarea name="message" defaultValue={s.welcomeMessage ?? ''} maxLength={600} rows={5} disabled={Boolean(s.teamEmailSentAt)} aria-label={`Message for ${s.name}`} placeholder="Hi everyone — I’m Coach … and I can’t wait to get started with this group. At training we’ll focus on…" className="w-full border border-line bg-surface p-3 text-sm" />
            {s.teamEmailSentAt ? <p className="text-xs text-muted">The team email has gone. Ask Management if something needs changing.</p> : <button className="min-h-11 bg-white px-5 text-xs font-semibold uppercase tracking-[0.15em] text-black">Save message</button>}
          </form>
        )
      })}
      {squads.length === 0 && <p className="border border-line p-6 text-muted">You haven’t been given a team yet. Management will let you know.</p>}
    </div>
  )
}
