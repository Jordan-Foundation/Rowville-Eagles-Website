import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { isManagementRoles } from '@/lib/home'
import { campDayLabel, campHoursLabel } from '@/lib/camps'
import { agesLabel } from '@/lib/camp-groups'
import { canSeeCampSheets, loadCampSheets, type SheetKid } from '@/camps/sheets'
import { PrintButton } from '@/app/(frontend)/account/reports/[id]/PrintButton'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Camp sheet', robots: { index: false } }

const printed = () => new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const cell = 'border border-black/60 px-2 py-1.5 align-top'
const box = <span aria-hidden className="inline-block h-4 w-4 border border-black align-middle" />

/**
 * A4 sheets for a holiday camp (print or save as PDF): the daily attendance sheet by group, and the
 * emergency contacts sheet. Management and the camp's confirmed coaches only.
 */
export default async function CampSheet({ params, searchParams }: { params: Promise<{ id: string; sheet: string }>; searchParams: Promise<{ day?: string }> }) {
  const { id, sheet } = await params
  const { day } = await searchParams
  if (sheet !== 'attendance' && sheet !== 'emergency') notFound()
  const user = await currentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/camps/${id}/print/${sheet}${day ? `?day=${day}` : ''}`)}`)
  const p = await payload()
  const camp = await p.findByID({ collection: 'programs', id: Number(id), depth: 0, overrideAccess: true, disableErrors: true })
  if (!camp || camp.type !== 'holiday-camp') notFound()
  if (!(await canSeeCampSheets(p, user, camp.id))) redirect('/no-access?area=camp-sheets')
  const data = await loadCampSheets(p, camp)
  const dates = data.days.length ? `${campDayLabel(data.days[0].date)} – ${campDayLabel(data.days.at(-1)!.date)}` : ''
  const back = isManagementRoles(user.roles) ? `/management/camps/${camp.id}` : '/coach/camps'
  const theDay = sheet === 'attendance' ? data.days.find((d) => d.date === day) ?? data.days[0] : null

  const Header = ({ title, sub }: { title: string; sub?: string }) => (
    <header className="mb-3 flex items-end justify-between gap-4 border-b-2 border-black pb-2">
      <div>
        <p className="text-xs uppercase tracking-widest">Rowville Foundation Academy · {title}</p>
        <h1 className="text-2xl font-bold">{camp.title}</h1>
        <p className="text-sm">{dates}{camp.location ? ` · ${camp.location}` : ''}</p>
      </div>
      <div className="text-right text-xs">
        {sub && <p className="text-base font-bold">{sub}</p>}
        <p className="whitespace-nowrap">Printed {printed()}</p>
      </div>
    </header>
  )

  const groupsToPrint = sheet === 'attendance' ? (theDay ? data.forDay(theDay.date) : []) : data.groups.map((g) => ({ label: g.label, ages: [] as number[], kids: g.kids }))

  return (
    <div className="camp-sheet min-h-screen bg-white text-black" data-sheet={sheet}>
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print { .camp-sheet section + section { break-before: page; } .camp-sheet tr { break-inside: avoid; } }
        .camp-sheet table { border-collapse: collapse; width: calc(100% - 2px); margin-left: 1px; font-size: 11px; }
      `}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-black/20 bg-neutral-100 px-6 py-3 text-sm">
        <Link href={back} className="underline">← Back</Link>
        {sheet === 'attendance' && (
          <nav aria-label="Camp days" className="flex flex-wrap gap-2">
            {data.days.map((d) => (
              <Link key={d.date} href={`/camps/${camp.id}/print/attendance?day=${d.date}`} aria-current={d.date === theDay?.date ? 'page' : undefined} className={`border px-2 py-1 ${d.date === theDay?.date ? 'border-black bg-black text-white' : 'border-black/30'}`}>{campDayLabel(d.date)}</Link>
            ))}
          </nav>
        )}
        <PrintButton />
      </div>
      <div className="mx-auto max-w-[186mm] px-4 py-6 print:max-w-none print:p-0">
        {groupsToPrint.length === 0 && <p className="py-10 text-center">No children booked{theDay ? ` on ${campDayLabel(theDay.date)}` : ''} yet.</p>}
        {groupsToPrint.map((g) => (
          <section key={g.label} aria-label={g.label} className="mb-8">
            {sheet === 'attendance' ? (
              <>
                <Header title="Daily attendance" sub={`${campDayLabel(theDay!.date)} · ${campHoursLabel(theDay!)}`} />
                <h2 className="mb-2 text-lg font-bold">{g.label}{g.ages.length ? ` – ${agesLabel(g.ages)}` : ''} – {g.kids.length} kid{g.kids.length === 1 ? '' : 's'}</h2>
                <table>
                  <thead><tr className="bg-neutral-200 text-left"><th className={cell}>Child</th><th className={cell}>Age</th><th className={cell}>Signed in</th><th className={cell}>Time</th><th className={cell}>Signed out</th><th className={cell}>Time</th><th className={cell}>Parent / guardian</th><th className={cell}>Mobile</th></tr></thead>
                  <tbody>
                    {g.kids.map((k: SheetKid) => (
                      <tr key={k.name + k.dob}>
                        <td className={cell}><strong>{k.name}</strong>{k.hasMedical ? ' ✚' : ''}{!k.photoConsent ? ' 📷✗' : ''}</td>
                        <td className={cell}>{k.age ?? ''}</td>
                        <td className={`${cell} text-center`}>{box}</td>
                        <td className={`${cell} w-14`} />
                        <td className={`${cell} text-center`}>{box}</td>
                        <td className={`${cell} w-14`} />
                        <td className={cell}>{k.parent}</td>
                        <td className={`${cell} whitespace-nowrap`}>{k.mobile}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[10px]">✚ medical or allergy notes — see the emergency contacts sheet. 📷✗ no photos. Coach: ____________________</p>
              </>
            ) : (
              <>
                <Header title="Emergency contacts & medical" />
                <h2 className="mb-2 text-lg font-bold">{g.label}</h2>
                <table>
                  <thead><tr className="bg-neutral-200 text-left"><th className={cell}>Child</th><th className={cell}>Age</th><th className={cell}>Parent / guardian</th><th className={cell}>Emergency contact</th><th className={cell}>Medical, allergies, injuries</th></tr></thead>
                  <tbody>
                    {g.kids.map((k: SheetKid) => (
                      <tr key={k.name + k.dob}>
                        <td className={cell}><strong>{k.name}</strong><br /><span className="text-[10px]">Born {k.dob ? new Date(`${k.dob}T12:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'}</span></td>
                        <td className={cell}>{k.age ?? ''}</td>
                        <td className={cell}>{k.parent}<br /><span className="whitespace-nowrap">{k.mobile}</span></td>
                        <td className={cell}>{k.emergencyName}{k.emergencyRelationship ? ` (${k.emergencyRelationship})` : ''}<br /><span className="whitespace-nowrap">{k.emergencyPhone}</span></td>
                        <td className={`${cell} ${k.hasMedical ? 'font-bold' : ''}`}>{k.medical}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[10px]">Confidential — for the camp coaches only. Keep with the first aid kit and shred after the camp.</p>
              </>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
