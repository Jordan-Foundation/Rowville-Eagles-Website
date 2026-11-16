'use server'

import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { rateLimit } from '@/lib/form-guard'
import { answerCover, CoverError } from '@/academy/cover-requests'

/** Confirm / can't do it / I can take it — from the signed link. */
export async function coverAnswer(fd: FormData) {
  const token = String(fd.get('token') ?? '').slice(0, 100)
  const answer = String(fd.get('answer'))
  const back = (k: 'done' | 'error', m: string) => redirect(`/cover/${token}?${k}=${encodeURIComponent(m)}`)
  if (!['confirm', 'decline', 'take'].includes(answer)) return back('error', 'Unknown answer.')
  const p = await payload()
  const limited = await rateLimit(p, 'cover', { perIp: 30 })
  if (limited) return back('error', limited)
  let msg: string
  try {
    msg = await answerCover(p, token, answer as 'confirm' | 'decline' | 'take')
  } catch (e) {
    if (!(e instanceof CoverError)) p.logger.error(e)
    return back('error', e instanceof Error ? e.message : 'Something went wrong — please contact the Academy.')
  }
  back('done', msg)
}
