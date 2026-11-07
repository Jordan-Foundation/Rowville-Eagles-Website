import type { Payload } from 'payload'

/**
 * Every price the site charges, gathered for the admin Prices page. Each editable value is addressed as
 * "<collection>.<id>.<field>" so the page can save just the ones that changed.
 */
export type PriceField = { key: string; label: string; value: number | null; unit?: 'aud' | 'days'; placeholder?: string }
export type PriceRow = { title: string; note?: string; href: string; muted?: boolean; fields: PriceField[] }
export type PriceSection = { title: string; intro: string; rows: PriceRow[] }

/** Which fields may be edited from the Prices page (anything else is rejected). */
export const EDITABLE: Record<string, { fields: string[]; nullable?: string[] }> = {
  'academy-terms': { fields: ['pricePerSession', 'casualPrice', 'termMemberPrice', 'termMemberWindowDays'], nullable: ['termMemberPrice'] },
  programs: { fields: ['price', 'pricePerSession', 'twoNightPricePerSession', 'trialPrice'], nullable: ['pricePerSession', 'twoNightPricePerSession'] },
  'selection-rounds': { fields: ['fee'], nullable: ['fee'] },
  squads: { fields: ['fee'], nullable: ['fee'] },
  products: { fields: ['price'] },
}

const typeLabel: Record<string, string> = {
  registration: 'Season registration',
  'holiday-camp': 'Holiday camp',
  tournament: 'Tournament',
  'academy-trial': 'Academy trial session',
  'private-session': '1-on-1 (old)',
}

export async function loadPrices(payload: Payload): Promise<PriceSection[]> {
  const q = { depth: 0, overrideAccess: true } as const
  const [terms, groupPrograms, programs, rounds, squads, products] = await Promise.all([
    payload.find({ collection: 'academy-terms', sort: '-startDate', limit: 12, ...q }),
    payload.find({ collection: 'programs', where: { type: { equals: 'academy-term' } }, sort: '-startDate', limit: 30, ...q }),
    payload.find({ collection: 'programs', where: { type: { not_in: ['academy-term'] } }, sort: '-startDate', limit: 100, ...q }),
    payload.find({ collection: 'selection-rounds', where: { kind: { equals: 'tournament' } }, sort: '-createdAt', limit: 30, ...q }),
    payload.find({ collection: 'squads', sort: 'name', limit: 300, ...q }),
    payload.find({ collection: 'products', sort: 'name', limit: 300, ...q }),
  ])
  const done = (s?: string | null) => s === 'closed'
  const squadsByRound = new Map<number, typeof squads.docs>()
  for (const s of squads.docs) {
    const r = typeof s.round === 'object' ? s.round.id : s.round
    squadsByRound.set(r, [...(squadsByRound.get(r) ?? []), s])
  }
  return [
    {
      title: 'Foundation Academy 1-on-1s',
      intro: 'Per Academy term. Term bookings pay the term price × sessions left; casual sessions pay the casual price; families with an active term pay the term-member price for sessions within the window.',
      rows: terms.docs.map((t) => ({
        title: t.name,
        note: t.status,
        href: `/admin/collections/academy-terms/${t.id}`,
        muted: done(t.status),
        fields: [
          { key: `academy-terms.${t.id}.pricePerSession`, label: 'Term, per session', value: t.pricePerSession, unit: 'aud' },
          { key: `academy-terms.${t.id}.casualPrice`, label: 'Casual session', value: t.casualPrice, unit: 'aud' },
          { key: `academy-terms.${t.id}.termMemberPrice`, label: 'Term-member casual', value: t.termMemberPrice ?? null, unit: 'aud', placeholder: 'off' },
          { key: `academy-terms.${t.id}.termMemberWindowDays`, label: 'Member window', value: t.termMemberWindowDays ?? 14, unit: 'days' },
        ],
      })),
    },
    {
      title: 'Academy group training (terms)',
      intro: 'Families pay the price per session × the sessions left in their training time(s) (at least 2, booked 24h ahead). 2 nights a week uses its own per-session price on both nights; leave it empty to offer 1 night only. Trial sessions use the trial price (0 = free).',
      rows: groupPrograms.docs.map((p) => ({
        title: p.title,
        note: p.status ?? '',
        href: `/admin/collections/programs/${p.id}`,
        muted: done(p.status),
        fields: [
          { key: `programs.${p.id}.pricePerSession`, label: '1 night/wk, per session', value: p.pricePerSession ?? null, unit: 'aud', placeholder: 'flat price' },
          { key: `programs.${p.id}.twoNightPricePerSession`, label: '2 nights/wk, per session', value: p.twoNightPricePerSession ?? null, unit: 'aud', placeholder: 'off' },
          { key: `programs.${p.id}.trialPrice`, label: 'Trial session', value: p.trialPrice ?? 0, unit: 'aud' },
          ...(p.pricePerSession == null ? [{ key: `programs.${p.id}.price`, label: 'Flat term price', value: p.price ?? 0, unit: 'aud' as const }] : []),
        ],
      })),
    },
    {
      title: 'Programs, camps & registrations',
      intro: 'One price per booking.',
      rows: programs.docs.map((p) => ({
        title: p.title,
        note: [typeLabel[p.type] ?? p.type, p.status].filter(Boolean).join(' · '),
        href: `/admin/collections/programs/${p.id}`,
        muted: done(p.status),
        fields: [{ key: `programs.${p.id}.price`, label: p.type === 'tournament' ? 'Default fee' : 'Price', value: p.price ?? 0, unit: 'aud' }],
      })),
    },
    {
      title: 'Tournament fees (per selected player)',
      intro: 'Charged after selection. A team’s own fee overrides the tournament fee; leave it empty to use the tournament fee.',
      rows: rounds.docs.flatMap((r) => [
        {
          title: r.title,
          note: r.status,
          href: `/admin/collections/selection-rounds/${r.id}`,
          muted: r.status === 'closed',
          fields: [{ key: `selection-rounds.${r.id}.fee`, label: 'Tournament fee', value: r.fee ?? null, unit: 'aud' as const, placeholder: 'program price' }],
        },
        ...(squadsByRound.get(r.id) ?? []).map((s) => ({
          title: `↳ ${s.name}`,
          href: `/admin/collections/squads/${s.id}`,
          muted: r.status === 'closed',
          fields: [{ key: `squads.${s.id}.fee`, label: 'Team fee', value: s.fee ?? null, unit: 'aud' as const, placeholder: 'tournament fee' }],
        })),
      ]),
    },
    {
      title: 'Shop',
      intro: 'Product prices (incl. GST).',
      rows: products.docs.map((p) => ({
        title: p.name,
        note: p.status ?? '',
        href: `/admin/collections/products/${p.id}`,
        muted: p.status !== 'active',
        fields: [{ key: `products.${p.id}.price`, label: 'Price', value: p.price, unit: 'aud' }],
      })),
    },
  ]
}
