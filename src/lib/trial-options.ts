import type { Payload } from 'payload'
import { formatDate } from './format'
import { trialPlacesTaken } from './trials'

const label = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** All upcoming published club trial sessions, with places left per age group (for the Join form). */
export async function clubTrialOptions(payload: Payload) {
  const { docs } = await payload.find({
    collection: 'trial-sessions',
    where: { status: { equals: 'published' }, start: { greater_than: new Date().toISOString() } },
    sort: 'start',
    limit: 50,
    depth: 0,
  })
  return Promise.all(
    docs.map(async (s) => ({
      id: s.id,
      label: `${label(s.start)} · ${s.title}`,
      ageGroups: s.ageGroups as string[],
      remaining: Object.fromEntries(
        await Promise.all(
          (s.ageGroups as string[]).map(async (g) => [g, Math.max(0, (s.capacityPerAgeGroup ?? 20) - (await trialPlacesTaken(payload, s.id, g)))] as const),
        ),
      ),
    })),
  )
}
