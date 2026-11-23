import { describe, expect, it } from 'vitest'
import { blocksOf, dueBlock } from '@/academy/wrap-up'

const s = (h1: string, h2: string) => ({ startsAt: `2026-12-01T${h1}:00.000Z`, endsAt: `2026-12-01T${h2}:00.000Z` })

describe('coach wrap-up', () => {
  it('back-to-back sessions (gaps ≤ 45 min) are one block', () => {
    expect(blocksOf([s('05:00', '06:00'), s('06:00', '07:00'), s('07:30', '08:30')])).toEqual([s('05:00', '08:30')])
  })
  it('a longer gap starts a new block', () => {
    expect(blocksOf([s('05:00', '06:00'), s('08:00', '09:00')])).toEqual([s('05:00', '06:00'), s('08:00', '09:00')])
  })
  it('overlapping sessions extend the block', () => {
    expect(blocksOf([s('05:00', '07:00'), s('05:30', '06:00')])).toEqual([s('05:00', '07:00')])
  })
  it('due 15 minutes after the block ends (not before, not hours later)', () => {
    const blocks = [s('05:00', '06:00'), s('08:00', '09:00')]
    expect(dueBlock(blocks, new Date('2026-12-01T06:10:00Z'))).toBeNull()
    expect(dueBlock(blocks, new Date('2026-12-01T06:15:00Z'))?.endsAt).toBe(blocks[0].endsAt)
    expect(dueBlock(blocks, new Date('2026-12-01T09:20:00Z'))?.endsAt).toBe(blocks[1].endsAt)
    expect(dueBlock(blocks, new Date('2026-12-01T13:00:00Z'))).toBeNull()
  })
})
