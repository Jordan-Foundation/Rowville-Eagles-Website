import type { Metadata } from 'next'
import Link from 'next/link'
import { requireCoach } from '@/academy/portal'
import { payload } from '@/lib/payload'
import { coachCamps, nudgeCampCoaches } from '@/camps/staffing'
import { campDayLabel } from '@/lib/camps'
import { answerCampAction } from './actions'
import { CampInvite } from './AnswerForms'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Holiday camps', robots: { index: false } }

/** Camps this coach has been asked to work: confirm or decline, and see the ones they're on. */
export default async function CoachCampsPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  const { coach } = await requireCoach('/coach/camps')
  const sp = await searchParams
  const p = await payload()
  await nudgeCampCoaches(p)
  const camps = await coachCamps(p, coach.id)
  const waiting = camps.filter((c) => c.cc.status === 'invited')
  const rest = camps.filter((c) => c.cc.status !== 'invited')
  return (
    <div className="space-y-8">
      <div>
        <Link href="/coach" className="text-sm text-muted hover:text-ink">← Overview</Link>
        <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-tight">Holiday camps</h1>
        <p className="mt-2 text-muted">Camps you’ve been asked to coach. Confirmed camp days are blocked out of your 1-on-1 availability.</p>
      </div>
      {(sp.done || sp.error) && <p role={sp.error ? 'alert' : 'status'} className={`border p-4 text-sm ${sp.error ? 'border-red-400/40 text-red-200' : 'border-emerald-400/40 text-emerald-200'}`}>{sp.error ?? sp.done}</p>}
      {camps.length === 0 && <p className="panel border border-line p-6 text-muted">No camps yet — when Management asks you to coach one, it shows here.</p>}
      {[...waiting, ...rest].map(({ cc, program, days }) => (
        <section key={cc.id} aria-label={program.title} className="panel border border-line p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">{program.title}</h2>
          <p className="mb-3 text-sm text-muted">{days.length ? `${campDayLabel(days[0].date)} – ${campDayLabel(days.at(-1)!.date)}` : ''}{cc.status === 'invited' ? ' · please answer' : ''}</p>
          <CampInvite title={program.title} location={program.location} days={days} status={cc.status} action={answerCampAction} hidden={{ campCoach: String(cc.id) }} />
          {cc.status === 'confirmed' && (
            <p className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link href={`/camps/${program.id}/print/attendance${days[0] ? `?day=${days[0].date}` : ''}`} className="underline">Attendance sheets</Link>
              <Link href={`/camps/${program.id}/print/emergency`} className="underline">Emergency contacts &amp; medical</Link>
            </p>
          )}
        </section>
      ))}
    </div>
  )
}
