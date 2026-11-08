import { redirect } from 'next/navigation'

/** The 1-on-1 dashboard now lives in Programs Overview (first view). */
export default async function OldDashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const q = new URLSearchParams({ program: '1on1', ...(await searchParams) })
  redirect(`/management/programs?${q.toString()}`)
}
