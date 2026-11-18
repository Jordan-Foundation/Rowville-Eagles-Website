import type { Media } from '@/payload-types'
import { requireCoach } from '@/academy/portal'
import { ProfileForm } from './ProfileForm'
import { AlertSettings, CalendarLink } from './CoachSettings'
import { payload } from '@/lib/payload'
import { siteBase } from '@/lib/seo'
import { coachStatus, STATUS_LABEL } from '@/lib/coach-signup'
import { localYmd } from '@/lib/time'
import { WwccForm } from './WwccForm'
import { PushToggle } from '@/components/coach/PushToggle'
import { pushKeys } from '@/push/send'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My profile' }

export default async function CoachProfilePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams
  const { coach, user } = await requireCoach('/coach/profile')
  const full = await (await payload()).findByID({ collection: 'academy-coaches', id: coach.id, depth: 0, overrideAccess: true, showHiddenFields: true })
  const a = full.alerts ?? {}
  const token = (full as { calendarToken?: string | null }).calendarToken
  const me = await (await payload()).findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true })
  const status = coachStatus(me, localYmd(new Date()))
  const w = me.wwcc ?? {}
  const photo = typeof coach.photo === 'object' ? (coach.photo as Media | null) : null
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">My profile</h1>
        <p className="mt-3 text-muted">Families swipe through coach profiles when they pick a time — make yours count.</p>
      </div>
      {welcome && <p role="status" className="border border-line bg-white/5 p-4 text-sm" data-welcome><strong>Welcome to the team!</strong> Your account is set up and your WWCC has gone to Management to check. Add a photo and a short bio below — families see your profile once you’re approved.</p>}
      <section id="wwcc" className="panel scroll-mt-24 border border-line p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold uppercase">Working With Children Check</h2>
          <span className="text-sm text-muted" data-wwcc-status>{status === 'to-check' ? 'Sent — Management is checking it' : status === 'ready' ? `Checked ✓ · expires ${w.expiry ? localYmd(new Date(w.expiry)) : ''}` : STATUS_LABEL[status]}</span>
        </div>
        <div className="mt-4"><WwccForm number={w.number} expiry={w.expiry ? localYmd(new Date(w.expiry)) : null} hasPhoto={Boolean(w.photo)} /></div>
      </section>
      <ProfileForm
        displayName={coach.displayName}
        bio={coach.bio ?? ''}
        specialties={(coach.specialties ?? []).map((s) => s.label)}
        photoUrl={photo?.url ?? null}
        active={Boolean(coach.active)}
      />
      <section id="alerts" className="panel scroll-mt-24 border border-line p-6">
        <h2 className="font-display text-2xl font-semibold uppercase">Alerts</h2>
        <p className="mt-1 text-sm text-muted">Choose how you hear about bookings, cancellations and parent messages.</p>
        <div className="mt-4"><PushToggle publicKey={(await pushKeys(await payload())).publicKey} /></div>
        <div className="mt-4">
          <AlertSettings hasPhone={Boolean(user.phone)} alerts={{ bookingEmail: a.bookingEmail !== false, bookingText: a.bookingText !== false, cancelEmail: a.cancelEmail !== false, cancelText: Boolean(a.cancelText), replyEmail: a.replyEmail !== false, replyText: Boolean(a.replyText) }} />
        </div>
      </section>
      <section className="panel border border-line p-6">
        <h2 className="font-display text-2xl font-semibold uppercase">Put the portal on your home screen</h2>
        <p className="mt-1 text-sm text-muted">iPhone: open this site in Safari → Share → <strong className="text-ink">Add to Home Screen</strong>. Android: Chrome menu ⋮ → <strong className="text-ink">Add to Home screen</strong>. Today’s training day and your groups stay readable at the ground even with no signal (once you’ve opened them with signal).</p>
      </section>
      <section id="calendar" className="panel scroll-mt-24 border border-line p-6">
        <h2 className="font-display text-2xl font-semibold uppercase">My calendar</h2>
        <p className="mt-1 text-sm text-muted">Your 1-on-1s, Academy groups, team training and fixtures in your phone’s calendar — it updates by itself.</p>
        <div className="mt-4"><CalendarLink url={token ? `${siteBase()}/calendar/coach/${token}` : null} /></div>
      </section>
    </div>
  )
}
