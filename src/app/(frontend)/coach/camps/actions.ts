'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { StaffingError, answerCampInvite, findCampCoachByToken } from '@/camps/staffing'

const done = (path: string, msg: string, key: 'done' | 'error' = 'done') => redirect(`${path}?${key}=${encodeURIComponent(msg)}`)

/** Coach portal: confirm or decline a camp. */
export async function answerCampAction(fd: FormData) {
  const user = await currentUser()
  if (!user) redirect('/login?next=/coach/camps')
  const p = await payload()
  const { docs } = await p.find({ pagination: false, collection: 'academy-coaches', where: { user: { equals: user.id } }, limit: 1, depth: 0, overrideAccess: true })
  if (!docs[0]) return done('/coach/camps', 'Coach profile not found.', 'error')
  const answer = fd.get('answer') === 'confirm' ? 'confirm' : 'decline'
  let msg: string
  try {
    const r = await answerCampInvite(p, { campCoachId: Number(fd.get('campCoach')), answer, reason: String(fd.get('reason') ?? '').trim(), coachId: docs[0].id })
    msg = r.status === 'confirmed' ? `Confirmed for ${r.program.title} — those days are blocked out of your 1-on-1 availability.` : `Declined ${r.program.title} — Management has been told. Thanks for letting us know.`
  } catch (e) {
    return done('/coach/camps', e instanceof StaffingError ? e.message : 'Something went wrong — please try again.', 'error')
  }
  revalidatePath('/coach/camps')
  done('/coach/camps', msg)
}

/** From the email/text link (no login needed). */
export async function answerByTokenAction(fd: FormData) {
  const token = String(fd.get('token') ?? '')
  const p = await payload()
  const cc = await findCampCoachByToken(p, token)
  if (!cc) return done(`/camp-coach/${token}`, 'This link isn’t valid any more.', 'error')
  const answer = fd.get('answer') === 'confirm' ? 'confirm' : 'decline'
  let msg: string
  try {
    const r = await answerCampInvite(p, { campCoachId: cc.id, answer, reason: String(fd.get('reason') ?? '').trim() })
    msg = r.status === 'confirmed' ? 'Confirmed — thanks! Those days are blocked out of your 1-on-1 availability.' : 'Declined — thanks for letting us know. Management has been told.'
  } catch (e) {
    return done(`/camp-coach/${token}`, e instanceof StaffingError ? e.message : 'Something went wrong — please try again.', 'error')
  }
  done(`/camp-coach/${token}`, msg)
}
