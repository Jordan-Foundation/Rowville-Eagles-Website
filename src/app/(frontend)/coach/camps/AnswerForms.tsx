import { campDayLabel, campHoursLabel, type CampDay } from '@/lib/camps'

/** Days list + Confirm / Decline (with an optional reason). Works with or without a login (token). */
export function CampInvite({ title, location, days, status, action, hidden }: { title: string; location?: string | null; days: CampDay[]; status: string; action: (fd: FormData) => Promise<void>; hidden: Record<string, string> }) {
  const fields = Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)
  return (
    <div className="space-y-4">
      <ul className="space-y-1 text-sm">
        {days.map((d) => <li key={d.date} className="flex justify-between gap-4 border-b border-line py-1"><span>{campDayLabel(d.date)}</span><span className="text-muted">{campHoursLabel(d)}</span></li>)}
      </ul>
      {location && <p className="text-sm text-muted">Where: {location}</p>}
      {status === 'invited' && (
        <div className="flex flex-wrap items-start gap-3">
          <form action={action}>{fields}<input type="hidden" name="answer" value="confirm" /><button className="min-h-11 bg-white px-5 text-sm font-semibold uppercase tracking-[0.12em] text-black">Confirm — I’ll coach {title}</button></form>
          <form action={action} className="flex flex-wrap items-center gap-2">{fields}<input type="hidden" name="answer" value="decline" />
            <input name="reason" aria-label="Reason (optional)" placeholder="Reason (optional)" className="min-h-11 border border-line bg-surface px-3 text-sm" />
            <button className="min-h-11 border border-line px-5 text-sm font-semibold uppercase tracking-[0.12em]">Decline</button>
          </form>
        </div>
      )}
      {status === 'confirmed' && <p className="text-sm text-emerald-300">You’re confirmed. These days are blocked out of your 1-on-1 availability.</p>}
      {status === 'declined' && <p className="text-sm text-muted">You declined this camp.</p>}
      {status === 'removed' && <p className="text-sm text-muted">You’re no longer needed for this camp.</p>}
    </div>
  )
}
