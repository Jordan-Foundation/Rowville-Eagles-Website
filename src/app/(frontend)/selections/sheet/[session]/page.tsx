import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { formatDate } from '@/lib/format'
import { getAgeRules } from '@/lib/age-rules'
import { sheetGroups, BLANK_ROWS, type SheetEntry } from '@/selections/sheet'
import type { SelectionEntry } from '@/payload-types'
import { PrintButton } from '@/app/(frontend)/account/reports/[id]/PrintButton'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Selection sheet', robots: { index: false } }

const NAVY = '#0f2a55'
const GOLD = '#f1cb22'
const printed = () => new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const cell = 'border border-[#0f2a55]/40 px-2 py-2 align-middle'
const box = <span aria-hidden className="inline-block h-5 w-5 rounded-[3px] border-2 border-[#0f2a55] align-middle" />

/**
 * Eagles selection trial sheet (A4 landscape, print or save as PDF), one page per age group: player, year of birth,
 * a 1 / 2 / 3 tick, room for notes, and the parent's name and mobile. Management only.
 */
export default async function SelectionSheet({ params, searchParams }: { params: Promise<{ session: string }>; searchParams: Promise<{ back?: string }> }) {
  const { session: sid } = await params
  await requireManagement(`/selections/sheet/${sid}`)
  const { back } = await searchParams
  const p = await payload()
  const session = await p.findByID({ collection: 'trial-sessions', id: Number(sid), depth: 0, overrideAccess: true, disableErrors: true })
  if (!session) notFound()
  const rules = await getAgeRules(p)
  const { docs } = await p.find({ collection: 'trial-invites', where: { session: { equals: session.id } }, limit: 2000, depth: 1, overrideAccess: true, pagination: false })
  const entries: SheetEntry[] = docs
    .map((i) => i.entry)
    .filter((e): e is SelectionEntry => !!e && typeof e === 'object')
    .map((e) => ({ firstName: e.player.firstName, lastName: e.player.lastName, dateOfBirth: e.player.dateOfBirth, birthYear: e.birthYear, playingBirthYear: e.playingBirthYear, parentFirst: e.contact.firstName, parentLast: e.contact.lastName, phone: e.contact.phone }))
  const groups = sheetGroups(entries, rules)
  // An empty trial still prints a blank sheet for each of its age groups
  const toPrint = groups.length ? groups : (session.birthYears ?? []).map((y) => ({ ...sheetGroups([{ firstName: '', lastName: '', playingBirthYear: y }], rules)[0], rows: [] }))
  const when = formatDate(session.start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  const backHref = back?.startsWith('/management/') ? back : '/management/selections/sessions'

  return (
    <div className="sel-sheet min-h-screen bg-white text-[#0b1730]" data-sheet="selection">
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        .sel-sheet { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print { .sel-sheet section + section { break-before: page; } .sel-sheet tr { break-inside: avoid; } }
        .sel-sheet table { border-collapse: collapse; width: calc(100% - 2px); margin-left: 1px; font-size: 12px; }
      `}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-neutral-100 px-6 py-3 text-sm">
        <Link href={backHref} className="underline">← Back</Link>
        <span className="text-muted">{toPrint.length} age group{toPrint.length === 1 ? '' : 's'} · each prints on its own page</span>
        <PrintButton />
      </div>
      <div className="mx-auto max-w-[277mm] px-4 py-6 print:max-w-none print:p-0">
        {toPrint.length === 0 && <p className="py-10 text-center">No players invited to this trial yet.</p>}
        {toPrint.map((g) => (
          <section key={g.playingYear} aria-label={g.title} data-group={g.playingYear} className="mb-10">
            <header className="mb-3 flex items-center gap-4 rounded-md px-4 py-3 text-white" style={{ background: NAVY, borderBottom: `4px solid ${GOLD}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/rowville-eagles-crest-sm.png" alt="Rowville Eagles" className="h-14 w-auto" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: GOLD }}>Rowville Eagles FC · Selection trial</p>
                <h1 className="text-xl font-extrabold uppercase leading-tight">{session.title}</h1>
                <p className="text-xs opacity-90">{when}{session.location ? ` · ${session.location}` : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-extrabold uppercase" style={{ color: GOLD }}>{g.title}</p>
                <p className="text-[10px] opacity-80">{g.rows.length} player{g.rows.length === 1 ? '' : 's'} · printed {printed()}</p>
              </div>
            </header>
            <table>
              <thead>
                <tr className="text-left text-white" style={{ background: NAVY }}>
                  <th className={`${cell} w-8 text-center`}>#</th>
                  <th className={cell}>Player</th>
                  <th className={`${cell} w-16 text-center`}>Born</th>
                  <th className={`${cell} w-10 text-center`}>1</th>
                  <th className={`${cell} w-10 text-center`}>2</th>
                  <th className={`${cell} w-10 text-center`}>3</th>
                  <th className={`${cell} w-[30%]`}>Notes</th>
                  <th className={cell}>Parent / guardian</th>
                  <th className={`${cell} w-32`}>Contact number</th>
                </tr>
              </thead>
              <tbody>
                {[...g.rows, ...Array.from({ length: BLANK_ROWS }, () => null)].map((r, i) => (
                  <tr key={i} className={i % 2 ? 'bg-[#0f2a55]/[0.04]' : ''} data-row={r ? 'player' : 'blank'}>
                    <td className={`${cell} text-center text-[11px] text-[#0f2a55]/70`}>{i + 1}</td>
                    <td className={`${cell} font-semibold`}>{r?.name}</td>
                    <td className={`${cell} text-center`}>{r?.born ?? ''}</td>
                    <td className={`${cell} text-center`}>{box}</td>
                    <td className={`${cell} text-center`}>{box}</td>
                    <td className={`${cell} text-center`}>{box}</td>
                    <td className={`${cell} h-10`} />
                    <td className={cell}>{r?.parent}</td>
                    <td className={`${cell} whitespace-nowrap`}>{r?.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 flex justify-between text-[10px]">
              <span>Tick one box (1, 2 or 3) for each player. Blank rows are for walk-ins.</span>
              <span>Coach: ______________________ &nbsp; Confidential — contains contact details; shred after selections.</span>
            </p>
          </section>
        ))}
      </div>
    </div>
  )
}
