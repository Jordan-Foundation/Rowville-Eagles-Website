import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'

/** Old round links → the round's Trialists page. */
export default async function RoundRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const round = await (await payload()).findByID({ collection: 'selection-rounds', id: Number(id), depth: 0, overrideAccess: true, disableErrors: true })
  redirect(`/management/selections/trialists?program=${round?.kind === 'tournament' ? 'rfa' : 'eagles'}${round ? `&round=${round.id}` : ''}`)
}
