import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { DownloadCsv } from '@/components/management/DownloadCsv'
import { ProgramForm } from './ProgramForm'
import { localWeekdayTime, localYmd } from '@/lib/time'
import { releaseLabel } from '@/academy/release'
import { formatDate } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Program setup', robots: { index: false } }

export default async function ProgramSetup({ params }: { params: Promise<{ id: string }> }) {
  await requireManagement('/management/programs/setup')
  const prog = await (await payload()).findByID({ collection: 'programs', id: Number((await params).id), depth: 0, overrideAccess: true, disableErrors: true })
  if (!prog) notFound()
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">{prog.title}</h1>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {prog.type === 'holiday-camp' && <Link href={`/management/camps/${prog.id}`} className="font-semibold underline">Camp groups &amp; days</Link>}
          <Link href={`/programs/${prog.slug}`} className="underline">View the program page</Link>
          <Link href="/management/dates" className="underline">Dates</Link>
          <Link href="/management/prices" className="underline">Prices</Link>
          <Link href={`/admin/collections/programs/${prog.id}`} className="text-muted underline">Description &amp; photo (admin)</Link>
        </p>
        {(prog.type === 'academy-term' || prog.type === 'toddler' || prog.type === 'academy-year') && <p className="mt-2 text-sm"><strong>Registrations:</strong> {releaseLabel(prog, new Date(), (iso) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</p>}
        <div className="mt-3"><DownloadCsv list={prog.type === 'academy-term' || prog.type === 'toddler' || prog.type === 'academy-year' ? 'registrations' : 'bookings'} params={{ program: prog.id }} label="Download bookings (CSV)" /></div>
      </div>
      <ProgramForm prog={{ id: prog.id, type: prog.type, opensAtLocal: prog.opensAt ? `${localYmd(new Date(prog.opensAt))}T${localWeekdayTime(prog.opensAt).time}` : '', autoOpen: prog.autoOpen === false ? 'off' : 'on', title: prog.title, status: prog.status, capacity: prog.capacity, summary: prog.summary, location: prog.location, scheduleNote: prog.scheduleNote, ageRange: prog.ageRange, minAge: prog.minAge, maxAge: prog.maxAge, whatToBring: prog.whatToBring, dropOffPickUp: prog.dropOffPickUp, priceNote: prog.priceNote }} />
    </div>
  )
}
