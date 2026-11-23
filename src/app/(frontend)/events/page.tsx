import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { localYmd } from '@/lib/time'
import { siteBase } from '@/lib/seo'
import { lookingAhead } from '@/site/calendar'
import { publicEvents } from '@/site/events'
import { EventsCalendar } from './EventsCalendar'
import { SyncButtons } from './SyncButtons'

export const revalidate = 300
export const metadata: Metadata = {
  title: 'Events',
  description: 'Rowville Eagles club events — Friday night football, holiday camps, presentation nights and more. Sync the calendar to your phone in one tap.',
}

/** Events: month calendar (tap for details), "Looking ahead" list, and one-tap calendar sync. */
export default async function EventsPage() {
  const events = await publicEvents(await payload())
  const today = localYmd(new Date())
  const ahead = lookingAhead(events, today)
  return (
    <>
      <section className="pitch-lines bg-[#0f2a55] text-white">
        <div className="container-x py-14 md:py-16">
          <p className="eyebrow">What’s on</p>
          <h1 className="mt-3 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase leading-none sm:text-7xl">Club <span className="text-accent">events</span></h1>
          <p className="mt-5 max-w-xl text-lg text-white/75">Friday night football, holiday camps, presentation nights and everything else happening at the Eagles.</p>
        </div>
      </section>
      <div className="container-x grid gap-8 py-12 lg:grid-cols-[1fr_20rem]">
        <EventsCalendar events={events} today={today} />
        <aside className="space-y-6">
          <SyncButtons feed={`${siteBase()}/events/calendar.ics`} />
          <section className="rounded-2xl border border-line p-5" data-looking-ahead>
            <h2 className="font-[family-name:var(--font-barlow)] text-xl font-bold uppercase">Looking ahead</h2>
            <p className="text-sm text-muted">More than a month away</p>
            {ahead.length ? (
              <ul className="mt-3 divide-y divide-line">
                {ahead.map((e) => (
                  <li key={e.uid} className="py-3" data-ahead={e.uid}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand">{e.dateLabel}</p>
                    <p className="font-semibold">{e.link ? <a href={e.link} className="hover:underline">{e.title}</a> : e.title}</p>
                    {e.summary && <p className="text-sm text-muted">{e.summary}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">Nothing further out yet — sync the calendar and new events will appear automatically.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  )
}
