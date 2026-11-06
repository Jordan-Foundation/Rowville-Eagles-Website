import type { Media } from '@/payload-types'
import { requireCoach } from '@/academy/portal'
import { ProfileForm } from './ProfileForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My profile' }

export default async function CoachProfilePage() {
  const { coach } = await requireCoach('/coach/profile')
  const photo = typeof coach.photo === 'object' ? (coach.photo as Media | null) : null
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">My profile</h1>
        <p className="mt-3 text-muted">Families swipe through coach profiles when they pick a time — make yours count.</p>
      </div>
      <ProfileForm
        displayName={coach.displayName}
        bio={coach.bio ?? ''}
        specialties={(coach.specialties ?? []).map((s) => s.label)}
        photoUrl={photo?.url ?? null}
        active={Boolean(coach.active)}
      />
    </div>
  )
}
