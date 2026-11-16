import type { Payload } from 'payload'
import { COACHED_KINDS, type LineKind } from './rules'

/** Finance settings with defaults filled in. */
export async function financeSettings(p: Payload) {
  const s = await p.findGlobal({ slug: 'finance-settings', depth: 0, overrideAccess: true }).catch(() => null)
  return {
    superRate: s?.superRate ?? 12,
    superOnBonus: s?.superOnBonus !== false,
    bonusPct: s?.bonusPct ?? 10,
    setupMinutes: s?.setupMinutes ?? 15,
    packupMinutes: s?.packupMinutes ?? 15,
    blockGapMinutes: s?.blockGapMinutes ?? 0,
    setupKinds: ((s?.setupKinds?.length ? s.setupKinds : COACHED_KINDS) as LineKind[]),
    eaglesSeasonStart: s?.eaglesSeasonStart ?? null,
    eaglesSeasonEnd: s?.eaglesSeasonEnd ?? null,
    eaglesGameMinutes: s?.eaglesGameMinutes ?? 90,
    reportRecipients: String(s?.reportRecipients ?? '').split(',').map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)),
    reportDay: Number(s?.reportDay ?? 1),
    reportHour: s?.reportHour ?? 9,
    gmail: { email: s?.gmail?.email ?? null, connectedAt: s?.gmail?.connectedAt ?? null, lastCheckedAt: s?.gmail?.lastCheckedAt ?? null, lastError: s?.gmail?.lastError ?? null },
  }
}
export type FinanceSettingsT = Awaited<ReturnType<typeof financeSettings>>
