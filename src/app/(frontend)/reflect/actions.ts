'use server'

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { gameContext, ownsPlayer, readReflectToken, saveReflection, findReflection, type SaveResult } from '@/reflections/service'
import { aiCheck, keywordCheck } from '@/reflections/welfare'
import type { MomentType } from '@/reflections/rules'

export type ReflectAuth = { kind: 'family'; participantId: number; teamId: number; fixtureId: string } | { kind: 'link'; token: string }
export type ReflectPayload = { feeling: number | null; moments: { type: MomentType; pillar: number | null; comment: string }[]; focus: string }

async function resolve(auth: ReflectAuth) {
  const p = await payload()
  if (auth.kind === 'link') {
    const t = readReflectToken(String(auth.token))
    if (!t) return { p, g: null, error: 'This link has expired or isn’t valid.' }
    const g = await gameContext(p, t.participantId, t.teamId, t.fixtureId)
    return { p, g, error: g ? null : 'This reflection isn’t available.' }
  }
  const user = await currentUser()
  if (!user) return { p, g: null, error: 'Please log in again.' }
  const g = await gameContext(p, Number(auth.participantId), Number(auth.teamId), String(auth.fixtureId))
  if (!g || !ownsPlayer(user, g.participant)) return { p, g: null, error: 'This reflection isn’t available.' }
  return { p, g, error: null }
}

/** Autosave (submit=false) or submit. Same rules whichever way the player got here. */
export async function saveReflectionAction(auth: ReflectAuth, input: ReflectPayload, submit: boolean): Promise<SaveResult> {
  try {
    const { p, g, error } = await resolve(auth)
    if (!g) return { ok: false, status: null, errors: [error ?? 'Not available.'] }
    const clean: ReflectPayload = {
      feeling: input?.feeling == null ? null : Number(input.feeling),
      moments: (Array.isArray(input?.moments) ? input.moments : []).slice(0, 12).map((m) => ({ type: m?.type === 'improve' ? 'improve' : 'great', pillar: m?.pillar ? Number(m.pillar) : null, comment: String(m?.comment ?? '').slice(0, 400) })),
      focus: String(input?.focus ?? '').slice(0, 300),
    }
    const res = await saveReflection(p, g, clean, { submit, source: auth.kind })
    if (res.ok && submit) {
      const r = await findReflection(p, g.participant.id, g.fixture.id)
      if (r) {
        // Keywords straight away (a hit is always emailed); the AI check runs after the page has responded
        try { await keywordCheck(p, r.id) } catch (e) { p.logger.error({ err: e, msg: 'Reflection keyword check failed' }) }
        after(async () => { try { await aiCheck(await payload(), r.id) } catch (e) { (await payload()).logger.warn({ err: e, msg: 'Reflection AI check failed — the hourly job will retry' }) } })
      }
      revalidatePath('/account')
    }
    return res
  } catch (e) {
    console.error(e)
    return { ok: false, status: null, errors: ['Something went wrong saving — please try again.'] }
  }
}
