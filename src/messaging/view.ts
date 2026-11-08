import type { Message } from '@/payload-types'
import type { ThreadMessage } from '@/components/messaging/Thread'

const HOW: Record<string, string> = { sms: 'text', portal: 'portal', email: 'email' }
const DELIVERY: Record<string, string> = { sms: 'texted', email: 'emailed — couldn’t text', failed: 'not delivered' }

/** Messages for the thread view. `mine` = written by the viewer's side (family, or coach/admin). */
export function toThread(msgs: Message[], side: 'family' | 'management'): ThreadMessage[] {
  return msgs.map((m) => ({
    id: m.id,
    note: m.direction === 'note',
    mine: side === 'family' ? m.direction === 'in' : m.direction === 'out',
    author: m.authorName || (m.direction === 'in' ? 'Family' : 'Foundation Academy'),
    body: m.body,
    at: m.createdAt,
    how: m.direction === 'out' ? (side === 'management' ? DELIVERY[m.delivery ?? ''] ?? '' : '') : HOW[m.channel] ?? '',
  }))
}
