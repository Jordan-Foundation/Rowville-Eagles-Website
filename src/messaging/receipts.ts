/** Read receipts and typical reply time for message threads (pure — unit tested). */

type Msg = { id: number; direction: string; createdAt: string; conversation?: unknown }
type Read = { user: number; at: string }

/**
 * "Seen" under the viewer's latest message, once someone on the other side has opened the conversation since it was sent.
 * Family view: "Seen by Coach Sam · 3:42 pm"; coach/management view: "Seen".
 */
export function seenReceipt(msgs: Msg[], reads: Read[], o: { side: 'family' | 'management'; familyUserId: number | null; names?: Record<number, string> }) {
  const mineDir = o.side === 'family' ? 'in' : 'out'
  const last = [...msgs].reverse().find((m) => m.direction !== 'note')
  if (!last || last.direction !== mineDir) return null // the other side has already answered
  const sent = Date.parse(last.createdAt)
  const others = reads.filter((r) => (o.side === 'family' ? r.user !== o.familyUserId : r.user === o.familyUserId) && Date.parse(r.at) >= sent)
  if (!others.length) return null
  const first = others.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0]
  const who = o.side === 'family' ? o.names?.[first.user] : null
  return { id: last.id, at: first.at, text: who ? `Seen by ${who}` : 'Seen' }
}

/**
 * Typical time to the first coach/staff reply after a family message, over recent messages (median, minutes).
 * Null when there are fewer than `min` replies to go on.
 */
export function typicalReplyMinutes(msgs: Msg[], min = 5) {
  const byConv = new Map<string, Msg[]>()
  for (const m of msgs) {
    const k = String(typeof m.conversation === 'object' && m.conversation ? (m.conversation as { id: number }).id : m.conversation)
    byConv.set(k, [...(byConv.get(k) ?? []), m])
  }
  const waits: number[] = []
  for (const list of byConv.values()) {
    list.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    let waitingSince: number | null = null
    for (const m of list) {
      if (m.direction === 'in' && waitingSince === null) waitingSince = Date.parse(m.createdAt)
      else if (m.direction === 'out' && waitingSince !== null) {
        waits.push((Date.parse(m.createdAt) - waitingSince) / 60_000)
        waitingSince = null
      }
    }
  }
  if (waits.length < min) return null
  waits.sort((a, b) => a - b)
  return waits[Math.floor(waits.length / 2)]
}

/** "Usually replies within an hour" / "within 3 hours" / "within a day" / "within 2 days". */
export function replyTimeLabel(minutes: number | null) {
  if (minutes === null) return null
  if (minutes <= 60) return 'Usually replies within an hour'
  const h = Math.ceil(minutes / 60)
  if (h <= 12) return `Usually replies within ${h} hours`
  if (h <= 24) return 'Usually replies within a day'
  return `Usually replies within ${Math.ceil(h / 24)} days`
}
