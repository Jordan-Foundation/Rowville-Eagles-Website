import type { Payload } from 'payload'

const q = { overrideAccess: true } as const

/** Record that this person has just looked at a section. Never throws (it's only for badges). */
export async function markSeen(p: Payload, userId: number, key: string) {
  try {
    const at = new Date().toISOString()
    const { docs } = await p.find({ collection: 'seen-markers', where: { user: { equals: userId }, key: { equals: key } }, limit: 1, depth: 0, ...q })
    if (docs[0]) await p.update({ collection: 'seen-markers', id: docs[0].id, data: { at }, ...q })
    else await p.create({ collection: 'seen-markers', data: { user: userId, key, at }, ...q })
  } catch {
    // a lost race just means the badge is a little stale
  }
}

/** When each of these sections was last seen (missing → a week ago, so a first visit isn't flooded). */
export async function seenAt(p: Payload, userId: number, keys: string[]) {
  const { docs } = await p.find({ collection: 'seen-markers', where: { user: { equals: userId }, key: { in: keys } }, limit: keys.length, depth: 0, ...q })
  const fallback = new Date(Date.now() - 7 * 86_400_000).toISOString()
  return Object.fromEntries(keys.map((k) => [k, docs.find((d) => d.key === k)?.at ?? fallback])) as Record<string, string>
}
