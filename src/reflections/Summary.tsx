import type { MatchReflection } from '@/payload-types'
import { FEELINGS } from './rules'

/** One submitted reflection, read-only, with coach notes. */
export function Summary({ r }: { r: MatchReflection }) {
  const f = FEELINGS.find((x) => x.value === r.feeling)
  const list = (type: 'great' | 'improve') => (r.moments ?? []).filter((m) => m.type === type).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  return (
    <div className="space-y-4">
      {f && <p className="text-lg">{f.emoji} {f.label}</p>}
      {(['great', 'improve'] as const).map((t) => (
        <div key={t}>
          <h3 className="font-semibold">{t === 'great' ? 'Did well' : 'To work on'}</h3>
          <ul className="mt-1 space-y-1 text-sm">{list(t).map((m, i) => <li key={i}><span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold">{m.pillarName}</span> {m.comment}</li>)}</ul>
        </div>
      ))}
      <p className="text-sm"><strong>Focus for next game:</strong> {r.focus}</p>
      {(r.feedback ?? []).filter((x) => x.comment || x.seenAt).map((x, i) => (
        <p key={i} className="rounded-xl border border-accent bg-accent/10 px-4 py-2 text-sm">
          {x.comment ? <>💬 <strong>{typeof x.coach === 'object' && x.coach ? x.coach.firstName : 'Coach'}:</strong> {x.comment}</> : <>👍 Seen by {typeof x.coach === 'object' && x.coach ? x.coach.firstName : 'your coach'}</>}
        </p>
      ))}
    </div>
  )
}
