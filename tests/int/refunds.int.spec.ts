import { describe, expect, it } from 'vitest'
import { checkAmount, refundableLeft } from '@/refunds/service'

describe('refund amounts', () => {
  it('works out what is left to refund', () => {
    expect(refundableLeft(300, 0)).toBe(300)
    expect(refundableLeft(300, 50)).toBe(250)
    expect(refundableLeft(100, 120)).toBe(0)
    expect(refundableLeft(19.95, 9.98)).toBe(9.97)
  })
  it('refuses nothing, negatives and more than is left', () => {
    expect(checkAmount(0, 100)).toMatch(/above \$0/)
    expect(checkAmount(-5, 100)).toMatch(/above \$0/)
    expect(checkAmount(Number.NaN, 100)).toMatch(/above \$0/)
    expect(checkAmount(100.01, 100)).toMatch(/up to \$100/)
    expect(checkAmount(100, 100)).toBeNull()
    expect(checkAmount(0.01, 100)).toBeNull()
  })
})
