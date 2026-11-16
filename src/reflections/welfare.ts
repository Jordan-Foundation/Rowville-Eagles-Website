import { createHash } from 'node:crypto'
import type { Payload } from 'payload'
import type { MatchReflection } from '@/payload-types'
import { sendEmail } from '../lib/email'
import { emailLayout, esc } from '../lib/email-templates'
import { siteUrl } from '../lib/payments'
import { aiConfigured, aiErrorMessage, classifyWelfare } from './ai'
import { keywordHits, parseKeywords, redact, reflectionTexts } from './rules'
import { reflectionSettings, relId } from './service'

/**
 * Safeguarding check on every submitted reflection: an editable keyword list (instant) and an AI check (anonymised).
 * Anything flagged goes straight to the safeguarding contact — it is never only mentioned in a report.
 * A keyword hit is always emailed, even if the AI check fails.
 */

const hashOf = (r: MatchReflection) => createHash('sha256').update(JSON.stringify(reflectionTexts(r))).digest('hex').slice(0, 24)

async function safeguardingTo(payload: Payload, configured: string | null) {
  if (configured) return configured
  const site = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch(() => null)
  return (site as { email?: string | null } | null)?.email || 'refc.secretary@outlook.com'
}

async function raise(payload: Payload, r: MatchReflection, flag: { source: 'keyword' | 'ai'; reason: string; excerpt: string; severity?: 'low' | 'medium' | 'high' }, to: string) {
  const doc = await payload.create({
    collection: 'welfare-flags',
    data: { reflection: r.id, participant: relId(r.participant), team: relId(r.team), excerpt: flag.excerpt.slice(0, 2000), reason: flag.reason.slice(0, 300), source: flag.source, severity: flag.severity ?? 'medium', status: 'open' },
    depth: 0,
    overrideAccess: true,
  })
  const player = await payload.findByID({ collection: 'participants', id: relId(r.participant) as number, depth: 0, overrideAccess: true }).catch(() => null)
  const team = await payload.findByID({ collection: 'teams', id: relId(r.team) as number, depth: 0, overrideAccess: true }).catch(() => null)
  const ok = await sendEmail(payload, {
    to,
    subject: `Welfare flag: please review a player reflection${player ? ` (${player.firstName} ${player.lastName})` : ''}`,
    sender: 'club',
    kind: 'service',
    html: emailLayout('club', [{
      heading: 'A match reflection needs a look',
      intro: 'Something a player wrote in their match reflection was flagged by the safeguarding check. Please read it and follow the club’s safeguarding procedure. This alert is private to the safeguarding contact.',
      rows: [
        ['Player', player ? esc(`${player.firstName} ${player.lastName}`) : '—'],
        ['Team', esc(team?.name ?? '—')],
        ['Game', esc(`vs ${r.opponent ?? ''}`)],
        ['Why', esc(flag.reason)],
        ['What they wrote', esc(flag.excerpt).replace(/\n/g, '<br>')],
      ],
      cta: { label: 'Open the welfare queue', href: `${siteUrl()}/management/reflections?tab=welfare` },
    }]),
  })
  if (ok) await payload.update({ collection: 'welfare-flags', id: doc.id, data: { notifiedAt: new Date().toISOString() }, depth: 0, overrideAccess: true })
  return doc
}

/** Keyword step: runs straight away on submit. */
export async function keywordCheck(payload: Payload, reflectionId: number) {
  const r = await payload.findByID({ collection: 'match-reflections', id: reflectionId, depth: 0, overrideAccess: true })
  if (r.status !== 'submitted') return { flagged: false }
  const hash = hashOf(r)
  if (r.welfareCheckedHash?.startsWith(hash)) return { flagged: false, skipped: true }
  const s = await reflectionSettings(payload)
  const keywords = parseKeywords(s.keywords)
  const hits = reflectionTexts(r).map((t) => ({ ...t, hits: keywordHits(t.text, keywords) })).filter((t) => t.hits.length)
  if (hits.length) {
    await raise(payload, r, {
      source: 'keyword',
      reason: `Contains: ${[...new Set(hits.flatMap((h) => h.hits))].map((k) => `“${k}”`).join(', ')}`,
      excerpt: hits.map((h) => `${h.where}: ${h.text}`).join('\n'),
    }, await safeguardingTo(payload, s.safeguardingEmail))
  }
  await payload.update({ collection: 'match-reflections', id: r.id, data: { welfareCheckedHash: `${hash}:kw${hits.length ? ':hit' : ''}`, welfareCheckedAt: null }, depth: 0, overrideAccess: true })
  return { flagged: hits.length > 0 }
}

/** AI step: runs after the response (and again from the hourly job if it failed). */
export async function aiCheck(payload: Payload, reflectionId: number) {
  const r = await payload.findByID({ collection: 'match-reflections', id: reflectionId, depth: 0, overrideAccess: true })
  if (r.status !== 'submitted') return { done: false }
  const hash = hashOf(r)
  if (!r.welfareCheckedHash?.startsWith(hash)) await keywordCheck(payload, reflectionId)
  const fresh = await payload.findByID({ collection: 'match-reflections', id: reflectionId, depth: 0, overrideAccess: true })
  if (fresh.welfareCheckedHash?.endsWith(':all')) return { done: true }
  const s = await reflectionSettings(payload)
  const keywordFlagged = fresh.welfareCheckedHash?.includes(':hit')
  if (s.aiWelfareCheck && aiConfigured() && !keywordFlagged) {
    const player = await payload.findByID({ collection: 'participants', id: relId(r.participant) as number, depth: 1, overrideAccess: true }).catch(() => null)
    const parent = player && typeof player.account === 'object' ? player.account : null
    const names = [player?.firstName, player?.lastName, parent?.firstName, parent?.lastName].filter((x): x is string => Boolean(x))
    const texts = reflectionTexts(fresh)
    const result = await classifyWelfare(redact(texts.map((t) => `${t.where}: ${t.text}`).join('\n'), names))
    if (result.concern) {
      await raise(payload, fresh, { source: 'ai', reason: result.reason || 'The AI check suggested a person reads this.', excerpt: texts.map((t) => `${t.where}: ${t.text}`).join('\n'), severity: result.severity === 'none' ? 'low' : result.severity }, await safeguardingTo(payload, s.safeguardingEmail))
    }
  }
  await payload.update({ collection: 'match-reflections', id: r.id, data: { welfareCheckedHash: `${hash}:all`, welfareCheckedAt: new Date().toISOString() }, depth: 0, overrideAccess: true })
  return { done: true }
}

/** Hourly: finish any AI checks that didn't complete (e.g. the AI service was down). */
export async function retryWelfareChecks(payload: Payload) {
  const { docs } = await payload.find({
    collection: 'match-reflections',
    where: { and: [{ status: { equals: 'submitted' } }, { welfareCheckedAt: { exists: false } }, { updatedAt: { less_than: new Date(Date.now() - 10 * 60_000).toISOString() } }] },
    depth: 0, limit: 50, overrideAccess: true,
  })
  let done = 0
  let failed = 0
  for (const r of docs) {
    try {
      await aiCheck(payload, r.id)
      done++
    } catch (e) {
      failed++
      payload.logger.warn({ msg: `Reflection welfare check failed: ${aiErrorMessage(e)}`, reflection: r.id })
    }
  }
  return { checked: done, failed }
}
