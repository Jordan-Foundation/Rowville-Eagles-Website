import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'

export const metadata: Metadata = { title: 'How to run a term', robots: { index: false } }

const STEPS: { when: string; title: string; body: string; links: [string, string][] }[] = [
  { when: '8 weeks before', title: 'Set the term dates', body: 'Add the new term’s first and last day and the date coaches must give their 1-on-1 availability by (about 6 weeks before the term). Group programs and Mini Ballers linked to the term follow its dates.', links: [['Set dates', '/management/dates']] },
  { when: '8 weeks before', title: 'Check the prices', body: 'Casual and term 1-on-1 prices, 1 and 2 nights a week, Mini Ballers and camps. New prices only apply to new bookings.', links: [['Set prices', '/management/prices']] },
  { when: '6–4 weeks before', title: 'Coach availability', body: 'Coaches are reminded automatically at 2 weeks, 1 week, 3 days and 1 day before the deadline. The dashboard shows who hasn’t submitted.', links: [['Payments, cover & availability', '/management/academy']] },
  { when: '4 weeks before', title: 'Training times and groups', body: 'Add each weekly training time (day, time, age groups, capacity) and its coaches. Split big times into groups and give each group a coach.', links: [['Academy terms', '/management/academy/terms'], ['Add a training time', '/admin/collections/academy-term-slots/create']] },
  { when: '4 weeks before', title: 'Open bookings', body: 'Set the term program (and Mini Ballers) to “Open” so families can register, book trials and pay. Families waiting for a place show on the Academy terms board — offer places from there.', links: [['Programs Overview', '/management/programs'], ['Programs in the admin', '/admin/collections/programs']] },
  { when: 'Optional', title: 'Tell families', body: 'A promotion for returning families (with consent to marketing), or an everyday notice to a group or team.', links: [['Promotions', '/management/promotions'], ['Email a group', '/management/broadcast']] },
  { when: 'Each week', title: 'During the term', body: 'Coaches take attendance on their Training day screen. Watch the dashboard for cover needed, overdue weekly payments, cancellations and messages.', links: [['Dashboard', '/management'], ['Bookings & cancellations', '/management/academy/bookings']] },
  { when: 'Week 6–8', title: 'Player reports', body: 'Start a report round with a due date. Coaches are reminded automatically. Review, return or approve, then release — families are emailed.', links: [['Player reports', '/management/reports']] },
  { when: 'End of term', title: 'Wrap up', body: 'Check the term’s money against Stripe, download any lists you keep, and set up next term’s dates.', links: [['Money summary', '/management/money'], ['Activity log', '/management/activity']] },
]

/** A one-page checklist for running an Academy term from start to finish. */
export default async function TermGuide() {
  await requireManagement('/management/guide')
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">How to run a term</h1>
        <p className="mt-2 text-muted">The whole term in nine steps. Each step links to the page where you do it.</p>
      </div>
      <ol className="space-y-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="panel flex gap-4 border border-line p-5">
            <span className="grid h-9 w-9 shrink-0 place-items-center bg-white font-display text-lg font-semibold text-black">{i + 1}</span>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">{s.when}</p>
              <h2 className="mt-0.5 font-display text-xl font-semibold uppercase">{s.title}</h2>
              <p className="mt-1 text-sm">{s.body}</p>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">{s.links.map(([label, href]) => <Link key={href} href={href} className="font-semibold underline">{label} →</Link>)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
