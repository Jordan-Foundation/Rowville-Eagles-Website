import { describe, expect, it } from 'vitest'
import { makeUnsubscribeToken, readUnsubscribeToken } from '@/lib/unsubscribe-token'
import { canMarket } from '@/lib/consent'
import { htmlToText } from '@/lib/email'
import { CONSENT_WORDING } from '@/lib/consent-wording'

describe('unsubscribe tokens', () => {
  it('round-trips a user id', () => {
    const t = makeUnsubscribeToken(42)
    expect(readUnsubscribeToken(t)).toEqual({ userId: 42, channel: 'email' })
  })
  it('rejects a token edited to target another user', () => {
    const [, channel, sig] = makeUnsubscribeToken(42).split('.')
    expect(readUnsubscribeToken(`43.${channel}.${sig}`)).toBeNull()
  })
  it('rejects garbage and truncated signatures', () => {
    expect(readUnsubscribeToken('nope')).toBeNull()
    expect(readUnsubscribeToken(makeUnsubscribeToken(7).slice(0, -3))).toBeNull()
    expect(readUnsubscribeToken('7.sms.abc')).toBeNull()
  })
})

describe('marketing guard', () => {
  it('only allows email marketing when opted in', () => {
    expect(canMarket({ marketingEmail: true }, 'email')).toBe(true)
    expect(canMarket({ marketingEmail: false }, 'email')).toBe(false)
    expect(canMarket({ marketingEmail: null }, 'email')).toBe(false)
  })
  it('never texts someone who replied STOP, even if marketing SMS is on', () => {
    expect(canMarket({ marketingSms: true, smsOptOut: false }, 'sms')).toBe(true)
    expect(canMarket({ marketingSms: true, smsOptOut: true }, 'sms')).toBe(false)
    expect(canMarket({ marketingSms: false, smsOptOut: false }, 'sms')).toBe(false)
  })
})

describe('consent wording', () => {
  it('matches the wording agreed for the service checkbox', () => {
    expect(CONSENT_WORDING.service).toBe('I agree to receive service messages about my bookings, sessions, payments and account by email and SMS.')
  })
})

describe('plain-text email', () => {
  it('keeps links readable and drops markup', () => {
    const text = htmlToText('<h1>Hi</h1><p>Book <a href="https://x.test/a?b=1&amp;c=2">here</a></p>')
    expect(text).toContain('Hi')
    expect(text).toContain('here: https://x.test/a?b=1&c=2')
    expect(text).not.toContain('<')
  })
})
