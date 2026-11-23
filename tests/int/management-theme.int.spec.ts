import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { contrastRatio } from '@/lib/contrast'

const css = readFileSync(path.join(process.cwd(), 'src/app/(frontend)/styles.css'), 'utf8')
const block = css.match(/\[data-portal='management'\],\s*\[data-portal='management'\] \[data-brand='academy'\] \{([\s\S]*?)\}/)![1]
const token = (name: string) => block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1]

describe('Management red theme', () => {
  it('is defined as tokens on the Management layout only', () => {
    expect(token('mgmt').toLowerCase()).toBe('#4a0b11')
    expect(token('surface').toLowerCase()).toBe('#2b070a')
    expect(css.match(/^:root \{[\s\S]*?\}/m)![0]).not.toContain('--mgmt')
  })
  it('meets WCAG AA contrast everywhere text sits', () => {
    for (const bg of [token('surface'), token('surface-2'), token('mgmt'), token('mgmt-hover')]) {
      expect(contrastRatio('#ffffff', bg)).toBeGreaterThanOrEqual(4.5) // text
      expect(contrastRatio(token('muted'), bg)).toBeGreaterThanOrEqual(4.5) // secondary text
      expect(contrastRatio(token('mgmt-tint'), bg)).toBeGreaterThanOrEqual(4.5) // red accents
    }
    expect(contrastRatio(token('surface'), '#ffffff')).toBeGreaterThanOrEqual(4.5) // buttons + active item: red text on white
  })
  it('is clearly darker than the crest red', () => {
    expect(contrastRatio('#ffffff', token('mgmt'))).toBeGreaterThan(contrastRatio('#ffffff', '#ca272c') + 5)
  })
})
