import type { Payload } from 'payload'
import type { Media } from '@/payload-types'
import { DIFFERENCE } from './difference'

type Img = { url: string; alt: string; width?: number; height?: number } | null
const img = (v: unknown, fallbackAlt: string): Img => (v && typeof v === 'object' && (v as Media).url ? { url: (v as Media).url!, alt: (v as Media).alt || fallbackAlt, width: (v as Media).width ?? undefined, height: (v as Media).height ?? undefined } : null)
/** Draft types are literal; admin copy is any string. */
type W<T> = T extends string ? string : T extends readonly (infer U)[] ? W<U>[] : { -readonly [K in keyof T]: W<T[K]> }
const pick = <T,>(v: T | null | undefined, d: T): T => (v === null || v === undefined || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0) ? d : v)

/** Page copy from the admin, falling back to the draft for anything left empty. */
export async function differenceContent(payload: Payload) {
  const g = await payload.findGlobal({ slug: 'difference-page', depth: 1, overrideAccess: true }).catch(() => null)
  const D = DIFFERENCE
  const sec = <K extends keyof typeof D>(k: K) => {
    const src = (g?.[k as keyof typeof g] ?? {}) as Record<string, unknown>
    const def = D[k] as Record<string, unknown>
    return Object.fromEntries(Object.keys(def).map((f) => [f, pick(src[f] as never, def[f] as never)])) as unknown as W<(typeof D)[K]>
  }
  return {
    hero: { ...sec('hero'), image: img(g?.hero?.image, 'Rowville coaches with players') },
    coaches: { ...sec('coaches'), image: img(g?.coaches?.image, 'A Rowville coach leading a session') },
    curriculum: { ...sec('curriculum'), image: img(g?.curriculum?.image, 'Players working on a drill') },
    sessions: sec('sessions'),
    reports: { ...sec('reports'), image: img(g?.reports?.image, 'Sample player report') },
    year: sec('year'),
    pathways: { ...sec('pathways'), image: img(g?.pathways?.image, 'Rowville and RFA players training') },
    community: { ...sec('community'), photos: ((g?.community?.photos ?? []) as unknown[]).map((p) => img(p, 'Families at Friday Community Night')).filter(Boolean) as NonNullable<Img>[] },
    fplus: sec('fplus'),
    cta: sec('cta'),
  }
}
export type Difference = Awaited<ReturnType<typeof differenceContent>>
