/**
 * Holiday packs (pure — unit tested): in the school holidays a family can book a pack of sessions
 * (3 or 5 by default) at the pack price ($80 each), choosing any free times with one coach across the
 * break — they don't have to be the same day or time. Paid upfront; each session follows the casual
 * cancellation rule.
 */
export const PACK_DEFAULTS = { sizes: [3, 5], price: 80 } as const

/** "3, 5" → [3, 5] (whole numbers 2–10, sorted, no repeats). */
export function parsePackSizes(text: string | null | undefined): number[] {
  const sizes = [...new Set(String(text ?? '').split(/[^0-9]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 2 && n <= 10))].sort((a, b) => a - b)
  return sizes.length ? sizes : [...PACK_DEFAULTS.sizes]
}

export const packSettings = (t: { packSizes?: string | null; packPricePerSession?: number | null }) => ({
  sizes: parsePackSizes(t.packSizes),
  price: t.packPricePerSession ?? PACK_DEFAULTS.price,
})

/** Check a family's chosen times. Returns the sorted times, or what's wrong. */
export function checkPack(o: { starts: string[]; sizes: number[]; isOpen: (iso: string) => boolean }): { ok: true; starts: string[] } | { ok: false; error: string } {
  const parsed = o.starts.map((s) => new Date(s)).filter((d) => !Number.isNaN(d.getTime())).map((d) => d.toISOString())
  const starts = [...new Set(parsed)].sort()
  if (starts.length !== o.starts.length) return { ok: false, error: 'Each time can only be chosen once.' }
  if (!o.sizes.includes(starts.length)) return { ok: false, error: `Choose exactly ${o.sizes.join(' or ')} sessions for a holiday pack.` }
  if (!starts.every(o.isOpen)) return { ok: false, error: 'Sorry — one of those times has just been booked. Please choose again.' }
  return { ok: true, starts }
}

export const packTotal = (sessions: number, price: number) => Math.round(sessions * price * 100) / 100
/** How much a pack saves against booking each session casually. */
export const packSaving = (sessions: number, price: number, casual: number) => Math.max(0, Math.round(sessions * (casual - price) * 100) / 100)
