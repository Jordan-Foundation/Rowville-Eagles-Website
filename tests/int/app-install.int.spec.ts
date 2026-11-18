import { describe, expect, it } from 'vitest'
import { appProgress, appReminderDue, APP_BENEFITS } from '@/lib/app-install'
import { appBrandFor, appManifest } from '@/lib/app-brand'
import { detectDevice } from '@/components/app/device'

const now = new Date('2026-11-18T00:00:00Z')
const days = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()

describe('homepage "Get the app" card', () => {
  it('shows until both steps are done', () => {
    expect(appProgress({ app: {} }, now)).toMatchObject({ installed: false, push: false, done: false, showCard: true })
    expect(appProgress({ app: { installedAt: days(1) } }, now)).toMatchObject({ installed: true, push: false, showCard: true })
    expect(appProgress({ app: { pushEnabledAt: days(1) } }, now).showCard).toBe(true)
    expect(appProgress({ app: { installedAt: days(1), pushEnabledAt: days(1) } }, now)).toMatchObject({ done: true, showCard: false })
  })
  it('"Remind me later" hides it for 7 days, then it comes back', () => {
    const snoozed = { app: { cardSnoozedUntil: new Date(now.getTime() + 7 * 86_400_000).toISOString() } }
    expect(appProgress(snoozed, now).showCard).toBe(false)
    expect(appProgress(snoozed, new Date(now.getTime() + 7 * 86_400_000 + 1000)).showCard).toBe(true)
  })
  it('existing accounts with nothing recorded see the card', () => {
    expect(appProgress({}, now).showCard).toBe(true)
  })
})

describe('app reminder email', () => {
  it('goes once, 3 days after the welcome, only if not done', () => {
    expect(appReminderDue({ app: { welcomeSentAt: days(2) } }, now)).toBe(false)
    expect(appReminderDue({ app: { welcomeSentAt: days(3) } }, now)).toBe(true)
    expect(appReminderDue({ app: { welcomeSentAt: days(5), reminderSentAt: days(1) } }, now)).toBe(false)
    expect(appReminderDue({ app: { welcomeSentAt: days(5), installedAt: days(4), pushEnabledAt: days(4) } }, now)).toBe(false)
    expect(appReminderDue({ app: { welcomeSentAt: days(5), installedAt: days(4) } }, now)).toBe(true)
    expect(appReminderDue({ app: {} }, now)).toBe(false) // never welcomed (older account) → no reminder
  })
  it('the guide lists every benefit', () => {
    expect(APP_BENEFITS).toHaveLength(7)
    expect(APP_BENEFITS.join(' ')).toMatch(/cancelled.*weather/)
  })
})

describe('app brand', () => {
  it('Rowville Eagles players → Rowville Eagles; Foundation Academy only → Foundation Academy', () => {
    expect(appBrandFor({ memberships: ['rowville'] })).toBe('eagles')
    expect(appBrandFor({ memberships: ['rowville', 'rfa'] })).toBe('eagles')
    expect(appBrandFor({ memberships: ['rfa'] })).toBe('academy')
    expect(appBrandFor({ memberships: [] })).toBe('eagles')
    expect(appBrandFor({ roles: ['coach'] })).toBe('academy')
    expect(appBrandFor({ roles: ['coach', 'admin'] })).toBe('eagles')
  })
  it('manifests are installable', () => {
    for (const b of ['eagles', 'academy'] as const) {
      const m = appManifest(b)
      expect(m.display).toBe('standalone')
      expect(m.start_url).toMatch(/^\/account/)
      expect(m.icons?.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
      expect(m.icons?.some((i) => i.purpose === 'maskable')).toBe(true)
    }
    expect(appManifest('academy').name).toBe('Foundation Academy')
  })
})

describe('install walkthrough device', () => {
  it('detects the right steps', () => {
    expect(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1')).toBe('iphone-safari')
    expect(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1')).toBe('iphone-other')
    expect(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0')).toBe('iphone-other')
    expect(detectDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15', 5)).toBe('iphone-safari') // iPad
    expect(detectDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36')).toBe('android')
    expect(detectDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36')).toBe('desktop')
  })
})
