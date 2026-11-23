import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { payload } from '@/lib/payload'
import { readFollowToken } from '@/lib/follow-up-token'
import { AcademyBackdrop } from '@/components/AcademyBackdrop'
import type { Program } from '@/payload-types'
import { TrialDetailsForm } from '../TrialDetailsForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Trial details', robots: { index: false } }

export default async function TrialDetailsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ref = readFollowToken(decodeURIComponent(token))
  if (!ref) notFound()
  const p = await payload()
  const { docs } = await p.find({ collection: 'bookings', where: { reference: { equals: ref }, bookingType: { equals: 'trial' } }, limit: 1, depth: 1, overrideAccess: true })
  const b = docs[0]
  if (!b) notFound()
  const prog = b.program as Program
  const academy = prog?.brand === 'academy' || b.payee === 'academy'
  const pl = b.player ?? {}
  const saved: Record<string, string> = {}
  if (pl.emergencyName) saved.emergencyName = pl.emergencyName
  if (pl.emergencyRelationship) saved.emergencyRelationship = pl.emergencyRelationship
  if (pl.emergencyPhone) saved.emergencyPhone = pl.emergencyPhone
  if (pl.medical) {
    saved.medicalAnswer = /^none\.?$/i.test(pl.medical.trim()) ? 'none' : 'yes'
    saved.medical = pl.medical
  }
  if (pl.photoConsent) saved.photoConsent = 'on'
  return (
    <div data-brand={academy ? 'academy' : undefined} data-page-brand={academy ? 'academy' : undefined} className="relative overflow-hidden">
      {academy && <AcademyBackdrop />}
      <div className="container-x relative max-w-2xl py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Before the trial</p>
        <h1 className={`mt-2 text-4xl uppercase ${academy ? 'font-display font-semibold' : 'font-[family-name:var(--font-barlow)] font-extrabold'}`}>{pl.firstName}’s details</h1>
        <p className="mt-3 text-muted">{prog?.title} · booking {b.reference}. Coaches need an emergency contact for every player on the field.</p>
        <div className="mt-8">
          <TrialDetailsForm token={decodeURIComponent(token)} player={pl.firstName || 'your child'} saved={saved} academy={academy} />
        </div>
      </div>
    </div>
  )
}
