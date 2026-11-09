import { describe, expect, it } from 'vitest'
import { csvFilename, toCsv } from '@/lib/csv'

describe('CSV downloads', () => {
  it('quotes commas, quotes and new lines; Yes/No for booleans', () => {
    const csv = toCsv(['Name', 'Note', 'Paid'], [['Smith, Ava', 'said "hi"\nbye', true], ['Ben', null, false]])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('"Smith, Ava","said ""hi""\nbye",Yes')
    expect(csv).toContain('Ben,,No')
  })
  it('neutralises spreadsheet formulas but keeps negative numbers', () => {
    const csv = toCsv(['A', 'B', 'C'], [['=HYPERLINK("x")', '@cmd', -12.5]])
    expect(csv).toContain(`"'=HYPERLINK(""x"")",'@cmd,-12.5`)
  })
  it('file names', () => {
    expect(csvFilename('1-on-1 bookings', new Date('2026-11-09T00:00:00Z'))).toBe('1-on-1-bookings-2026-11-09.csv')
  })
})
