import { describe, expect, it } from 'vitest'
import { teamTitle } from '@/teams/service'

describe('team pages', () => {
  it('names tournament teams "[Tournament] – [Team]"', () => {
    expect(teamTitle({ type: 'tournament', event: 'Eagles Autumn Cup', name: '2016s Red' })).toBe('Eagles Autumn Cup – 2016s Red')
    expect(teamTitle({ type: 'rowville', event: null, name: 'U9 Eagles 1' })).toBe('U9 Eagles 1')
  })
})
