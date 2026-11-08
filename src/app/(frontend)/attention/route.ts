import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/auth'
import { payload } from '@/lib/payload'
import { isCoachRoles, isManagementRoles } from '@/lib/home'
import { coachAttention, managementAttention } from '@/lib/attention'

export const dynamic = 'force-dynamic'

/** Badge counts for the signed-in person's dashboard (?for=management|coach). */
export async function GET(req: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({}, { status: 401 })
  const which = new URL(req.url).searchParams.get('for')
  const p = await payload()
  if (which === 'management' && isManagementRoles(user.roles)) return NextResponse.json(await managementAttention(p, user), { headers: { 'cache-control': 'no-store' } })
  if (which === 'coach' && isCoachRoles(user.roles)) {
    const { docs } = await p.find({ collection: 'academy-coaches', where: { user: { equals: user.id } }, limit: 1, depth: 0, overrideAccess: true })
    if (docs[0]) return NextResponse.json(await coachAttention(p, user, docs[0]), { headers: { 'cache-control': 'no-store' } })
  }
  return NextResponse.json({}, { status: 403 })
}
