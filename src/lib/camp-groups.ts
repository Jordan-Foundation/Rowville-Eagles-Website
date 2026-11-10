/**
 * Holiday camp age groups (pure — unit tested).
 *
 * - Groups of 8–12 (settings), children of similar ages together, as few groups as possible.
 *   Fewer than the minimum → one group.
 * - Group 1 is the youngest.
 * - A child keeps the same group every day of the camp.
 * - Children placed by hand (locked) stay where they were put.
 * - Brothers and sisters booked together, and "keep with" requests, are kept together.
 */

export type CampKid = {
  id: number
  name: string
  /** YYYY-MM-DD */
  dob: string
  /** Bookings made together (siblings) share this */
  checkoutGroup?: string | null
  /** "Keep with" text from the booking */
  keepWith?: string | null
  /** Placed by hand: stays in this group */
  lockedGroup?: number | null
}

export type GroupRules = { min: number; max: number }
export const GROUP_RULES: GroupRules = { min: 8, max: 12 }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

/** Which other child a "keep with" request means: a full-name match, or a first name only one child has. */
export function matchKeepWith(text: string | null | undefined, kids: Pick<CampKid, 'id' | 'name'>[], selfId: number): number[] {
  const t = norm(text ?? '')
  if (!t) return []
  const others = kids.filter((k) => k.id !== selfId)
  const full = others.filter((k) => norm(k.name) && t.includes(norm(k.name)))
  if (full.length) return full.map((k) => k.id)
  const out: number[] = []
  for (const word of new Set(t.split(' '))) {
    if (word.length < 2) continue
    const firsts = others.filter((k) => norm(k.name).split(' ')[0] === word)
    if (firsts.length === 1) out.push(firsts[0].id)
  }
  return out
}

/** Children who must stay together: siblings booked in one checkout, and keep-with requests (both ways). */
export function keepTogetherUnits(kids: CampKid[]): CampKid[][] {
  const parent = new Map(kids.map((k) => [k.id, k.id]))
  const find = (x: number): number => (parent.get(x) === x ? x : find(parent.get(x)!))
  const join = (a: number, b: number) => parent.set(find(a), find(b))
  const byCheckout = new Map<string, number>()
  for (const k of kids) {
    if (k.checkoutGroup) {
      const first = byCheckout.get(k.checkoutGroup)
      if (first != null) join(k.id, first)
      else byCheckout.set(k.checkoutGroup, k.id)
    }
    for (const other of matchKeepWith(k.keepWith, kids, k.id)) join(k.id, other)
  }
  const units = new Map<number, CampKid[]>()
  for (const k of kids) units.set(find(k.id), [...(units.get(find(k.id)) ?? []), k])
  return [...units.values()]
}

/** Fewest groups so no group has more than the maximum (one group below the minimum). */
export const groupCount = (n: number, r: GroupRules = GROUP_RULES) => (n < r.min ? 1 : Math.max(1, Math.ceil(n / r.max)))

/**
 * Work out every child's group. Locked children stay put; everyone else is filled in age order
 * (youngest first) so the groups come out as even as possible. A keep-together unit moves as one
 * (and follows any locked member).
 */
export function planCampGroups(kids: CampKid[], r: GroupRules = GROUP_RULES): Map<number, number> {
  const out = new Map<number, number>()
  if (!kids.length) return out
  const lockedMax = Math.max(0, ...kids.map((k) => k.lockedGroup ?? 0))
  const count = Math.max(groupCount(kids.length, r), lockedMax)
  // Even target sizes: the younger groups take any extra
  const base = Math.floor(kids.length / count)
  const extra = kids.length % count
  const room = Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0))

  const units = keepTogetherUnits(kids)
  const free: CampKid[][] = []
  for (const u of units) {
    const anchor = u.find((k) => k.lockedGroup)?.lockedGroup
    if (anchor) {
      for (const k of u) out.set(k.id, k.lockedGroup ?? anchor)
      room[anchor - 1] -= u.length
    } else free.push(u)
  }
  // Youngest first: latest date of birth (a unit sorts by its youngest member)
  const youngest = (u: CampKid[]) => u.map((k) => k.dob).sort().at(-1)!
  free.sort((a, b) => youngest(b).localeCompare(youngest(a)) || a[0].id - b[0].id)
  let g = 0
  for (const u of free) {
    // Move on once this group is full — but never past the last group
    while (g < count - 1 && room[g] <= 0) g++
    // A unit that would push a group past the maximum goes to the next group if it has room
    if (g < count - 1 && room[g] < u.length && room[g + 1] >= u.length) g++
    for (const k of u) out.set(k.id, g + 1)
    room[g] -= u.length
  }
  return out
}

/**
 * Groups for one day: a group with fewer than the minimum that day is joined with its nearest
 * age neighbour (younger/older), so nobody is in a tiny group. Returns the group numbers run together.
 * Groups with nobody that day are left out.
 */
export function dayGroups(counts: Map<number, number>, r: GroupRules = GROUP_RULES): number[][] {
  const groups = [...counts.entries()].filter(([, n]) => n > 0).sort((a, b) => a[0] - b[0])
  if (groups.length <= 1) return groups.map(([g]) => [g])
  const out: { groups: number[]; n: number }[] = []
  let cur: { groups: number[]; n: number } | null = null
  for (const [g, n] of groups) {
    if (!cur) cur = { groups: [g], n }
    else { cur.groups.push(g); cur.n += n }
    if (cur.n >= r.min) { out.push(cur); cur = null }
  }
  if (cur) {
    // The oldest leftover joins the group before it
    if (out.length) { const last = out.at(-1)!; last.groups.push(...cur.groups); last.n += cur.n } else out.push(cur)
  }
  return out.map((x) => x.groups)
}

/** "ages 8–9" / "age 8" */
export function agesLabel(ages: number[]) {
  if (!ages.length) return ''
  const lo = Math.min(...ages)
  const hi = Math.max(...ages)
  return lo === hi ? `age ${lo}` : `ages ${lo}–${hi}`
}

/** "Group 2 – ages 8–9 – 11 kids" */
export const groupLabelText = (n: number, ages: number[], kids: number) => `Group ${n} – ${agesLabel(ages)} – ${kids} kid${kids === 1 ? '' : 's'}`
