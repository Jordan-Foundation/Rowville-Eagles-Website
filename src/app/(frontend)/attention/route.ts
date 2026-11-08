import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/auth'
import { payload } from '@/lib/payload'
import { isCoachRoles, isManagementRoles } from '@/lib/home'
import { coachAttention, managementAttention } from '@/lib/attention'

export const dynamic = 'force-dynamic'

// Several open tabs (or people) asking within a short time share one answer per person (per server instance)
const memo = new Map<string, { at: number; body: Record<string, number> }>()
const TTL = 45_000
async function cached(key: string, work: () => Promise<Record<string, number>>) {
  const hit = memo.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.body
  const body = await work()
  memo.set(key, { at: Date.now(), body })
  if (memo.size > 500) memo.delete(memo.keys().next().value!)
  return body
}

/** Badge counts for the signed-in person's dashboard (?for=management|coach). */
export async function GET(req: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({}, { status: 401 })
  const which = new URL(req.url).searchParams.get('for')
  const p = await payload()
  if (which === 'management' && isManagementRoles(user.roles)) return NextResponse.json(await cached(`m:${user.id}`, () => managementAttention(p, user)), { headers: { 'cache-control': 'no-store' } })
  if (which === 'coach' && isCoachRoles(user.roles)) {
    const { docs } = await p.find({ pagination: false, collection: 'academy-coaches', where: { user: { equals: user.id } }, limit: 1, depth: 0, overrideAccess: true })
    if (docs[0]) return NextResponse.json(await cached(`c:${user.id}`, () => coachAttention(p, user, docs[0])), { headers: { 'cache-control': 'no-store' } })
  }
  return NextResponse.json({}, { status: 403 })
}
