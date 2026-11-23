import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { contrastRatio } from '@/lib/contrast'

const css = readFileSync(path.join(process.cwd(), 'src/app/(frontend)/styles.css'), 'utf8')
const block = css.match(/\[data-portal='management'\] \{([\s\S]*?)\}/)![1]
const token = (name: string) => block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1]

describe('Management dark red theme', () => {
  it('is defined as tokens on the Management layout only', () => {
    expect(token('mgmt').toLowerCase()).toBe('#7a1219')
    expect(css.match(/^:root \{[\s\S]*?\}/m)![0]).not.toContain('--mgmt')
  })
  it('meets WCAG AA contrast', () => {
    expect(contrastRatio('#ffffff', token('mgmt'))).toBeGreaterThanOrEqual(4.5) // text on the red bar and buttons
    expect(contrastRatio('#ffffff', token('mgmt-hover'))).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(token('mgmt-tint'), '#000000')).toBeGreaterThanOrEqual(4.5) // accent text on black
    expect(contrastRatio(token('mgmt'), '#ffffff')).toBeGreaterThanOrEqual(4.5) // active menu item: red text on white
  })
  it('is clearly darker than the crest red', () => {
    expect(contrastRatio('#ffffff', token('mgmt'))).toBeGreaterThan(contrastRatio('#ffffff', '#ca272c') + 3)
  })
})
