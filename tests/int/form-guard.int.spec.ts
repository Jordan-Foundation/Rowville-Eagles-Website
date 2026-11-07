import { describe, expect, it } from 'vitest'
import { checkStamp, formStamp, hashKey, validEmail } from '@/lib/form-guard'

describe('public form protection', () => {
  it('accepts a real person’s timing and rejects bots, forgeries and stale forms', () => {
    const t = 1_800_000_000_000
    const s = formStamp(t)
    expect(checkStamp(s, t + 10_000)).toBe('ok')
    expect(checkStamp(s, t + 500)).toBe('too_fast')
    expect(checkStamp(s, t + 7 * 3_600_000)).toBe('expired')
    expect(checkStamp(`${t}.forgedmacforgedmacforg`, t + 10_000)).toBe('forged')
    expect(checkStamp(`${t - 60_000}.${s.split('.')[1]}`, t + 10_000)).toBe('forged')
    expect(checkStamp('', t)).toBe('missing')
  })
  it('validates emails', () => {
    expect(validEmail('sam@example.com.au')).toBe(true)
    expect(validEmail('sam@example')).toBe(false)
    expect(validEmail('sam @example.com')).toBe(false)
    expect(validEmail('<script>@x.com')).toBe(false)
  })
  it('hashes keys (no raw IPs or emails stored)', () => {
    expect(hashKey('ip', '1.2.3.4')).toMatch(/^ip:[\w-]{32}$/)
    expect(hashKey('ip', '1.2.3.4')).not.toContain('1.2.3.4')
  })
})
