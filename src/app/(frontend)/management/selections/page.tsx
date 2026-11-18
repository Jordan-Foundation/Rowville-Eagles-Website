import { redirect } from 'next/navigation'

/** Selections now start on the Trialists page (Eagles or RFA tournament teams). */
export default async function SelectionsIndex({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams
  redirect(`/management/selections/trialists?program=${kind === 'tournament' ? 'rfa' : 'eagles'}`)
}
