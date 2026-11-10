import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { payload } from '@/lib/payload'
import { findCampCoachByToken } from '@/camps/staffing'
import { campDayList } from '@/lib/camps'
import type { AcademyCoach, Program } from '@/payload-types'
import { answerByTokenAction } from '../../coach/camps/actions'
import { CampInvite } from '../../coach/camps/AnswerForms'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Camp coaching', robots: { index: false } }

/** The link in a coach's camp email/text: see the camp and confirm or decline (no login needed). */
export default async function CampCoachLink({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string; error?: string }> }) {
  const { token } = await params
  const sp = await searchParams
  const cc = await findCampCoachByToken(await payload(), token)
  if (!cc || typeof cc.program !== 'object' || !cc.program) notFound()
  const program = cc.program as Program
  const coach = cc.coach as AcademyCoach
  return (
    <div data-brand="academy" data-page-brand="academy" className="container-x max-w-2xl space-y-6 py-14">
      <p className="text-xs font-medium uppercase tracking-[0.35em] text-muted">Foundation Academy</p>
      <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">{program.title}</h1>
      <p className="text-muted">Hi {coach.displayName} — can you coach at this camp?</p>
      {(sp.done || sp.error) && <p role={sp.error ? 'alert' : 'status'} className={`border p-4 text-sm ${sp.error ? 'border-red-400/40 text-red-200' : 'border-emerald-400/40 text-emerald-200'}`}>{sp.error ?? sp.done}</p>}
      <CampInvite title={program.title} location={program.location} days={campDayList(program)} status={cc.status} action={answerByTokenAction} hidden={{ token }} />
    </div>
  )
}
