/**
 * Local testing only: record a weekly charge outcome for a weekly-paid booking, exactly as the Stripe webhook
 * would (paid or failed), without needing Stripe. Refuses to run against Postgres (production).
 *   npx payload run scripts/simulate-weekly-charge.ts -- <reference> <failed|paid>
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { recordWeeklyFailed, recordWeeklyPaid } from '../src/academy/weekly-payments'

if (process.env.DATABASE_URL?.startsWith('postgres')) throw new Error('Local testing only — not against Postgres.')
const [reference, outcome] = process.argv.slice(-2)
if (!reference || !['failed', 'paid'].includes(outcome)) throw new Error('Usage: -- <reference> <failed|paid>')
const payload = await getPayload({ config })
const invoiceId = `in_sim_${reference}_week2`
const r = outcome === 'failed'
  ? await recordWeeklyFailed(payload, { reference, invoiceId, amount: 0, payUrl: `https://invoice.stripe.com/i/${invoiceId}` })
  : await recordWeeklyPaid(payload, { reference, invoiceId, amount: 0 })
console.log('RESULT', r.ok, r.ok ? r.booking.status : r.reason)
process.exit(0)
