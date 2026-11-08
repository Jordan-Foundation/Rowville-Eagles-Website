import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload, formatMoney } from '@/lib/payload'
import { DATE_FIELDS, formatDateInput } from '@/lib/dates-edit'
import { loadPickables } from '@/promotions/pickables'
import { toLive } from '@/promotions/service'
import { PromotionForm, type PromoValues } from '../PromotionForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Promotion', robots: { index: false } }

const dt = (v?: string | null) => formatDateInput(DATE_FIELDS['programs.startDate'], v ?? null)

export default async function PromotionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params
  await requireManagement(`/management/promotions/${id}`)
  const sp = await searchParams
  const p = await payload()
  const pick = await loadPickables(p)
  let v: PromoValues = { name: '', status: 'draft', type: 'percent', value: '', usesPerFamily: '1', startsAt: '', endsAt: '', everything: false, programGroups: [], programs: [], oneOnOneAll: false, oneOnOneTerms: [], shopAll: false, products: [], tournamentsAll: false, tournamentRounds: [], foundationPlus: false, emails: '' }
  let stats: { uses: number; off: number; paid: number } | null = null
  let sent = false
  if (id !== 'new') {
    const d = await p.findByID({ collection: 'promotions', id: Number(id), depth: 1, overrideAccess: true, disableErrors: true })
    if (!d) notFound()
    const l = toLive(d)
    sent = !!d.sentAt
    v = {
      id: d.id, name: d.name, status: d.status, type: d.type, value: String(d.value), usesPerFamily: d.usesPerFamily ? String(d.usesPerFamily) : '', startsAt: dt(d.startsAt), endsAt: dt(d.endsAt),
      everything: !!l.everything, programGroups: l.programGroups ?? [], programs: l.programs ?? [], oneOnOneAll: !!l.oneOnOneAll, oneOnOneTerms: l.oneOnOneTerms ?? [], shopAll: !!l.shopAll, products: l.products ?? [],
      tournamentsAll: !!l.tournamentsAll, tournamentRounds: l.tournamentRounds ?? [], foundationPlus: !!l.foundationPlus,
      emails: (d.recipients ?? []).map((u) => (typeof u === 'object' ? u.email : '')).filter(Boolean).join('\n'),
    }
    const { docs: uses } = await p.find({ pagination: false, collection: 'promotion-uses', where: { promotion: { equals: d.id }, status: { equals: 'paid' } }, limit: 5000, depth: 0, overrideAccess: true })
    stats = { uses: uses.length, off: uses.reduce((n, u) => n + u.amountOff, 0), paid: uses.reduce((n, u) => n + (u.paidAmount ?? 0), 0) }
  }
  return (
    <div className="container-x max-w-5xl py-14">
      <Link href="/management/promotions" className="text-sm text-muted hover:text-ink">← Promotions</Link>
      <h1 className="mt-4 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">{id === 'new' ? 'New promotion' : v.name}</h1>
      {id !== 'new' && <p className="mt-2 text-muted"><strong className="text-ink">{v.status === 'live' ? 'Live' : v.status === 'ended' ? 'Ended' : v.status === 'scheduled' ? 'Scheduled' : 'Draft'}</strong>{stats ? ` · used ${stats.uses} time${stats.uses === 1 ? '' : 's'} · ${formatMoney(stats.off)} discount given · ${formatMoney(stats.paid)} paid` : ''}</p>}
      {sp.saved && <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{sp.saved === 'live' ? 'Live — these families now get the discount automatically when they pay.' : sp.saved === 'ended' ? 'Ended — nobody gets this discount any more.' : 'Saved.'}</p>}
      {id !== 'new' && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line p-4">
          <Link href={`/management/promotions/${id}/send`} className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white">{sent ? 'See what was sent' : 'Choose families & send'}</Link>
          <span className="text-sm text-muted">{sent ? 'Already sent.' : 'Pick the audience, write the email/text, preview it and approve.'}</span>
        </div>
      )}
      <div className="mt-8"><PromotionForm v={v} pick={pick} /></div>
    </div>
  )
}
