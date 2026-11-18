import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { hasRole } from '@/access'
import { ImportForm } from './ImportForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Import players', robots: { index: false } }

/** Admins: bring EOIs across from an old Google Form (.xlsx or .csv export). */
export default async function ImportEoisPage() {
  const me = await requireManagement('/management/selections/import')
  if (!hasRole(me, 'admin')) redirect('/no-access?area=management')
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Import EOIs &amp; trial lists</h1>
        <p className="mt-2 max-w-3xl text-muted">Bring expressions of interest across from an old Google Form. In the Google Sheet use File → Download → Microsoft Excel (.xlsx) or CSV, choose it below and check the preview. Players are placed in their age group by date of birth, duplicates are skipped, and a “Yes” to the news &amp; offers question is kept as their permission. Nobody is messaged — they wait for trial dates like any other EOI.</p>
        <p className="mt-2 max-w-3xl text-muted">Got a list of players who have <strong>already trialled</strong>? Import it the same way and answer “Yes” to “Have these players already trialled?” — they go straight onto this season’s Eagles selections ready for a decision.</p>
      </div>
      <ImportForm />
      <p className="text-sm"><Link href="/management/selections?kind=rowville" className="underline">← Eagles selections</Link></p>
    </div>
  )
}
