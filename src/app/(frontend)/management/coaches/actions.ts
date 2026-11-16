'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { CoachSignupError, inviteCoach, markWwccChecked, sendCoachInvite } from '@/lib/coach-signup'

const back = (kind: 'done' | 'error', msg: string): never => redirect(`/management/coaches?${kind}=${encodeURIComponent(msg)}`)

/** Management adds a coach: name, mobile, email → sign-up link by email and text. */
export async function addCoach(fd: FormData) {
  const me = await managementOrNull()
  if (!me) back('error', 'Please log in as Management.')
  const s = (k: string) => String(fd.get(k) ?? '')
  let msg: string
  try {
    const u = await inviteCoach(await payload(), { firstName: s('firstName'), lastName: s('lastName'), email: s('email'), mobile: s('mobile') })
    msg = `Sign-up link sent to ${u.firstName} by email and text.`
  } catch (e) {
    msg = ''
    back('error', e instanceof CoachSignupError ? e.message : 'Couldn’t add the coach — please try again.')
  }
  revalidatePath('/management', 'layout')
  back('done', msg)
}

export async function coachAction(fd: FormData) {
  const me = await managementOrNull()
  if (!me) back('error', 'Please log in as Management.')
  const p = await payload()
  const id = Number(fd.get('user'))
  const op = String(fd.get('op'))
  let msg = ''
  try {
    const user = await p.findByID({ collection: 'users', id, depth: 0, overrideAccess: true })
    if (!user.roles?.includes('coach')) throw new CoachSignupError('That account isn’t a coach.')
    if (op === 'resend') {
      await sendCoachInvite(p, user)
      msg = `New sign-up link sent to ${user.firstName || user.email}.`
    } else if (op === 'checked') {
      await markWwccChecked(p, id, me!)
      msg = `WWCC marked as checked — ${user.firstName || 'the coach'} can now be booked by families.`
    } else throw new CoachSignupError('Unknown action.')
  } catch (e) {
    back('error', e instanceof CoachSignupError ? e.message : 'Something went wrong — please try again.')
  }
  revalidatePath('/management', 'layout')
  back('done', msg)
}
