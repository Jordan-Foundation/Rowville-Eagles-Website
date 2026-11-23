'use server'

import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { rateLimit } from '@/lib/form-guard'
import { respond, TournamentError } from '@/tournaments/service'

export async function answerInvite(fd: FormData) {
  const token = String(fd.get('token') ?? '')
  const answer = fd.get('answer') === 'decline' ? 'decline' : 'accept'
  const back = `/tournaments/invite/${encodeURIComponent(token)}`
  const p = await payload()
  const limited = await rateLimit(p, 'tournament-invite', { perIp: 30 })
  if (limited) redirect(`${back}?error=${encodeURIComponent(limited)}`)
  let to = back
  try {
    const r = await respond(p, token, answer)
    to = r.payUrl ?? `${back}?done=${r.status}`
  } catch (e) {
    if (!(e instanceof TournamentError)) throw e
    to = `${back}?error=${encodeURIComponent(e.message)}`
  }
  redirect(to)
}
