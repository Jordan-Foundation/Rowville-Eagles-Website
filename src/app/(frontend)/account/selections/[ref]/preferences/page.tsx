import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { entryForFamily } from '@/selections/prefs'
import { prefsEditable, SURVEY_WORDING } from '@/selections/flow'
import type { Squad } from '@/payload-types'
import { savePrefsAction } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Training preferences', robots: { index: false } }

const NIGHTS = [
  { value: 'mon_wed', label: 'Monday & Wednesday' },
  { value: 'tue_thu', label: 'Tuesday & Thursday' },
  { value: 'none', label: 'No preference' },
]
const DAYS = [
  { value: 'sat', label: 'Saturday' },
  { value: 'sun', label: 'Sunday' },
  { value: 'none', label: 'No preference' },
]

/** After paying the Eagles registration: preferred training nights and game day (can't be guaranteed). */
export default async function PreferencesSurvey({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { ref } = await params
  const sp = await searchParams
  const user = await currentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/account/selections/${ref}/preferences`)}`)
  const e = await entryForFamily(await payload(), decodeURIComponent(ref), user.id)
  if (!e) notFound()
  const editable = prefsEditable(e.squad && typeof e.squad === 'object' ? (e.squad as Squad) : null)
  const radio = 'flex min-h-12 items-center gap-3 rounded-xl border border-line px-4 has-[:checked]:border-brand has-[:checked]:bg-brand/10'
  return (
    <div className="container-x max-w-2xl py-14">
      <Link href="/account" className="text-sm text-muted hover:text-ink">← My account</Link>
      <p className="eyebrow mt-6 !text-brand">{e.player.firstName} {e.player.lastName}</p>
      <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Training preferences</h1>
      <p className="mt-6 rounded-2xl border-2 border-accent bg-accent/10 p-5 text-base leading-relaxed" data-survey-wording>
        {SURVEY_WORDING.split('can’t be guaranteed').map((part, i) => (i === 0 ? <span key={i}>{part}</span> : <span key={i}><strong>can’t be guaranteed</strong>{part}</span>))}
      </p>
      {sp.saved && <p role="status" className="mt-6 rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-4 font-semibold" data-prefs-saved>Thanks — saved. {editable ? 'You can change these until teams are finalised.' : ''} <Link href="/account" className="underline">Back to my account</Link></p>}
      {sp.error && <p role="alert" className="mt-6 rounded-xl border border-red-500/50 p-4 text-red-700">{sp.error}</p>}
      <form action={savePrefsAction} className="mt-8 space-y-8" aria-label="Training preferences">
        <input type="hidden" name="ref" value={e.reference ?? ''} />
        <fieldset disabled={!editable} className="space-y-2">
          <legend className="mb-3 text-lg font-semibold">1. Preferred training nights</legend>
          {NIGHTS.map((o) => <label key={o.value} className={radio}><input type="radio" name="trainingNights" value={o.value} required defaultChecked={e.prefs?.trainingNights === o.value} /> {o.label}</label>)}
        </fieldset>
        <fieldset disabled={!editable} className="space-y-2">
          <legend className="mb-3 text-lg font-semibold">2. Preferred game day</legend>
          {DAYS.map((o) => <label key={o.value} className={radio}><input type="radio" name="gameDay" value={o.value} required defaultChecked={e.prefs?.gameDay === o.value} /> {o.label}</label>)}
        </fieldset>
        {editable ? (
          <button className="w-full rounded-full bg-brand px-6 py-3.5 font-semibold text-white hover:brightness-110">{e.prefs?.answeredAt ? 'Update preferences' : 'Save preferences'}</button>
        ) : (
          <p className="text-sm text-muted">{e.player.firstName}’s team has been finalised, so these can’t be changed here. Please contact the club if something has changed.</p>
        )}
      </form>
    </div>
  )
}
