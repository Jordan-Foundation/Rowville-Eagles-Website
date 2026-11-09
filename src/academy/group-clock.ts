import { after } from 'next/server'
import { payload } from '@/lib/payload'

/**
 * Small group reminders and deadlines also run once a day from cron; a page visit nudges them in
 * between (after the page has been sent, at most every few minutes), so a 48-hour deadline is honoured
 * to within minutes whenever coaches, families or Management are using the site.
 */
export function nudgeGroupClock() {
  after(async () => {
    const { sweepGroupsSoon } = await import('./group-decisions')
    await sweepGroupsSoon(await payload())
  })
}
