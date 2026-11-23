import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { formatDate } from '@/lib/format'
import { owingPlayers } from '@/imports/owing'
import { sendOwingAction } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Registration owing', robots: { index: false } }

/** Imported Eagles players who haven't paid this season's registration. Nothing is sent until you press Send. */
export default async function OwingPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  await requireManagement('/management/players/owing')
  const sp = await searchParams
  const kids = await owingPlayers(await payload())
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Registration owing</h1>
        <p className="mt-2 text-muted">Imported Eagles players marked “Not paid”. Tick players and send the registration payment email when you’re ready.</p>
      </div>
      {(sp.done || sp.error) && <p role={sp.error ? 'alert' : 'status'} className={`border p-3 text-sm ${sp.error ? 'border-red-400/40 text-red-200' : 'border-emerald-400/40 text-emerald-200'}`}>{sp.error ?? sp.done}</p>}
      <form action={sendOwingAction} className="space-y-4">
        <ul className="divide-y divide-line border border-line text-sm">
          {kids.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-3 p-3" data-owing={`${k.firstName} ${k.lastName}`}>
              <input type="checkbox" name="ids" value={k.id} aria-label={`Select ${k.firstName} ${k.lastName}`} />
              <span className="flex-1"><strong>{k.firstName} {k.lastName}</strong> <span className="text-muted">· {typeof k.team === 'object' && k.team ? k.team.name : 'no team'} · {typeof k.registrationOffer?.program === 'object' && k.registrationOffer.program ? k.registrationOffer.program.title : 'no registration program'} · {typeof k.account === 'object' && k.account ? k.account.email : ''}</span></span>
              <span className="text-xs text-muted">{k.imported?.owingEmailAt ? `Emailed ${formatDate(k.imported.owingEmailAt, { day: 'numeric', month: 'short' })}` : 'Not emailed'}</span>
            </li>
          ))}
          {kids.length === 0 && <li className="p-4 text-muted">Nobody owes registration.</li>}
        </ul>
        {kids.length > 0 && <button className="min-h-11 bg-white px-5 text-xs font-semibold uppercase tracking-[0.12em] text-black">Send payment email to ticked</button>}
      </form>
    </div>
  )
}
