import Link from 'next/link'
import { formatDate } from '@/lib/payload'
import type { LastTime as Last } from '@/academy/coach-players'

/** "Last time": the player's most recent session summary, shown on an upcoming session. */
export function LastTime({ last, participantId, firstName }: { last: Last; participantId: number | null; firstName: string }) {
  return (
    <section aria-label={`Last time with ${firstName}`} className="border-l-4 border-white/60 bg-white/5 p-4 text-sm" data-last-time>
      {last ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Last time · {formatDate(last.at, { weekday: 'short', day: 'numeric', month: 'short' })}{last.coach ? ` · ${last.coach}` : ''}</p>
          {last.workedOn.length > 0 && <p className="mt-2"><span className="text-muted">Worked on: </span>{last.workedOn.join(', ')}</p>}
          {last.note && <p className="mt-1"><span className="text-muted">About {firstName}: </span>{last.note}</p>}
          {last.wentWell && <p className="mt-1"><span className="text-muted">Went well: </span>{last.wentWell}</p>}
          {last.nextSteps && <p className="mt-1"><span className="text-muted">Next steps: </span>{last.nextSteps}</p>}
          {last.homework && <p className="mt-1"><span className="text-muted">Practise at home: </span>{last.homework}</p>}
        </>
      ) : (
        <p className="font-semibold" data-first-session>First session together</p>
      )}
      {participantId && <p className="mt-2"><Link href={`/coach/players/${participantId}#summaries`} className="text-xs underline">See all summaries →</Link></p>}
    </section>
  )
}
