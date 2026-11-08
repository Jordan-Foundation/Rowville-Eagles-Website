import { timingSafeEqual } from 'crypto'
import { payload } from '@/lib/payload'
import { cronJobs } from '@/lib/cron-jobs'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET
  const given = req.headers.get('authorization') ?? ''
  if (!secret) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(given)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** Vercel Cron calls GET /cron/<group> with "Authorization: Bearer $CRON_SECRET". */
export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  if (!authorised(req)) return new Response('Unauthorized', { status: 401 })
  const { job } = await params
  const group = cronJobs[job]
  if (!group) return new Response('Unknown job', { status: 404 })

  const p = await payload()
  const results: Record<string, unknown> = {}
  const started = Date.now()
  for (const [name, run] of Object.entries(group)) {
    // Leave room before the 300s limit: anything not started now runs on the next call
    if (Date.now() - started > 240_000) {
      results[name] = { skipped: 'out of time — runs next time' }
      continue
    }
    try {
      results[name] = await run(p)
    } catch (e) {
      p.logger.error({ err: e, msg: `cron ${job}/${name} failed` })
      results[name] = { error: e instanceof Error ? e.message : String(e) }
    }
  }
  return Response.json({ job, ranAt: new Date().toISOString(), results })
}
