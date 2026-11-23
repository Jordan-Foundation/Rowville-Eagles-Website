'use client'

import { useMemo, useState } from 'react'
import { eventsOn, googleEventLink, monthGrid, shiftMonth, type PublicEvent } from '@/site/calendar'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const CAT: Record<string, string> = { club: 'bg-brand text-white', juniors: 'bg-accent text-accent-ink', seniors: 'bg-[#0f2a55] text-white', academy: 'bg-black text-white', social: 'bg-emerald-600 text-white' }
const monthName = (ym: string) => new Date(`${ym}-15T00:00:00Z`).toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Month calendar: tap an event to see more underneath. */
export function EventsCalendar({ events, today }: { events: PublicEvent[]; today: string }) {
  const [ym, setYm] = useState(today.slice(0, 7))
  const firstWithEvents = useMemo(() => events.find((e) => e.endYmd >= today)?.uid ?? null, [events, today])
  const [selected, setSelected] = useState<string | null>(null)
  const weeks = monthGrid(ym)
  const sel = events.find((e) => e.uid === selected) ?? null
  const monthEvents = events.filter((e) => e.startYmd.slice(0, 7) <= ym && e.endYmd.slice(0, 7) >= ym)
  const pick = (uid: string) => {
    setSelected(uid)
    requestAnimationFrame(() => document.getElementById('event-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setYm((m) => shiftMonth(m, -1))} className="grid h-10 w-10 place-items-center rounded-full border border-line hover:bg-surface-2" aria-label="Previous month">‹</button>
        <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase sm:text-3xl" aria-live="polite" data-month={ym}>{monthName(ym)}</h2>
        <button type="button" onClick={() => setYm((m) => shiftMonth(m, 1))} className="grid h-10 w-10 place-items-center rounded-full border border-line hover:bg-surface-2" aria-label="Next month">›</button>
      </div>
      {ym !== today.slice(0, 7) && <p className="mt-1 text-center"><button type="button" onClick={() => setYm(today.slice(0, 7))} className="text-sm text-muted underline">Back to this month</button></p>}

      {/* Month grid (tablet and up) */}
      <div className="mt-4 hidden overflow-hidden rounded-2xl border border-line sm:block">
        <div className="grid grid-cols-7 bg-surface-2 text-center text-xs font-semibold uppercase tracking-wider text-muted">
          {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        {weeks.map((w) => (
          <div key={w[0]} className="grid grid-cols-7 border-t border-line">
            {w.map((d) => {
              const list = eventsOn(d, events)
              const out = d.slice(0, 7) !== ym
              return (
                <div key={d} className={`min-h-28 border-l border-line p-1.5 first:border-l-0 ${out ? 'bg-surface-2/50 text-muted' : ''}`} data-day={d}>
                  <span className={`inline-grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-semibold ${d === today ? 'bg-brand text-white' : ''}`}>{Number(d.slice(8))}</span>
                  <ul className="mt-1 space-y-1">
                    {list.slice(0, 3).map((e) => (
                      <li key={e.uid}>
                        <button type="button" onClick={() => pick(e.uid)} aria-pressed={selected === e.uid} className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-semibold leading-4 ${CAT[e.category] ?? CAT.club} ${selected === e.uid ? 'ring-2 ring-offset-1 ring-brand' : ''}`} title={e.title} data-event={e.uid}>
                          {!e.allDay && e.startYmd === d && <span className="font-normal opacity-80">{e.timeLabel.split(' – ')[0]} </span>}{e.title}
                        </button>
                      </li>
                    ))}
                    {list.length > 3 && <li className="px-1 text-[11px] text-muted">+{list.length - 3} more</li>}
                  </ul>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Phones: this month's events as a list */}
      <ul className="mt-4 space-y-2 sm:hidden">
        {monthEvents.length ? monthEvents.map((e) => (
          <li key={e.uid}>
            <button type="button" onClick={() => pick(e.uid)} aria-pressed={selected === e.uid} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selected === e.uid ? 'border-brand' : 'border-line'}`} data-event={e.uid}>
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg text-center text-xs font-bold leading-tight ${CAT[e.category] ?? CAT.club}`}>{new Date(`${e.startYmd}T12:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
              <span><span className="block font-semibold">{e.title}</span><span className="text-sm text-muted">{e.timeLabel}</span></span>
            </button>
          </li>
        )) : <li className="rounded-xl border border-line p-4 text-sm text-muted">No events this month.</li>}
      </ul>

      <div id="event-detail" className="mt-6 scroll-mt-24" aria-live="polite">
        {sel ? (
          <article className="rounded-2xl border-2 border-brand p-6" data-event-detail={sel.uid}>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">{sel.dateLabel} · {sel.timeLabel}</p>
            <h3 className="mt-1 font-[family-name:var(--font-barlow)] text-3xl font-bold uppercase">{sel.title}</h3>
            {sel.location && <p className="mt-1 text-muted">📍 {sel.location}</p>}
            {(sel.details || sel.summary) && <p className="mt-3 whitespace-pre-line">{sel.details || sel.summary}</p>}
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              {sel.link && <a href={sel.link} className="rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink hover:brightness-110">{sel.linkLabel || 'Find out more'}</a>}
              <a href={`/events/ics/${sel.uid}`} className="rounded-full border border-line px-5 py-2.5 font-semibold hover:bg-surface-2">Add to my calendar</a>
              <a href={googleEventLink(sel)} target="_blank" rel="noopener" className="rounded-full border border-line px-5 py-2.5 font-semibold hover:bg-surface-2">Add to Google Calendar</a>
            </div>
          </article>
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-muted">
            Tap an event to see more about it.{' '}
            {firstWithEvents && <button type="button" onClick={() => { const e = events.find((x) => x.uid === firstWithEvents)!; setYm(e.startYmd.slice(0, 7)); pick(e.uid) }} className="font-semibold text-brand underline">Show the next event</button>}
          </p>
        )}
      </div>
    </div>
  )
}
