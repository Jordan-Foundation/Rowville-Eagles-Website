import { describe, expect, it } from 'vitest'
import { deliveredBy, summaryProblem, type SummaryInput } from '@/academy/summaries/service'

const base: SummaryInput = { workedOn: ['First touch'], wentWell: 'Great touch', nextSteps: '', homework: '', effort: 4, privateNotes: '', playerNotes: {} }

describe('session summaries', () => {
  it('needs 1–3 things from the list and a line for went well or next steps', () => {
    expect(summaryProblem(base)).toBeNull()
    expect(summaryProblem({ ...base, workedOn: [] })).toMatch(/at least one/)
    expect(summaryProblem({ ...base, workedOn: ['First touch', 'Passing', 'Heading', 'Weak foot'] })).toMatch(/up to three/)
    expect(summaryProblem({ ...base, workedOn: ['Juggling knives'] })).toMatch(/from the list/)
    expect(summaryProblem({ ...base, wentWell: ' ', nextSteps: '' })).toMatch(/went well or the next steps/)
    expect(summaryProblem({ ...base, wentWell: '', nextSteps: 'Scan more' })).toBeNull()
    expect(summaryProblem({ ...base, effort: 7 })).toMatch(/1 to 5/)
    expect(summaryProblem({ ...base, effort: null })).toBeNull()
  })
  it('the cover coach writes it when there was one', () => {
    expect(deliveredBy({ coach: 3, coverCoach: null })).toBe(3)
    expect(deliveredBy({ coach: 3, coverCoach: 8 })).toBe(8)
    expect(deliveredBy({ coach: { id: 3 } as never, coverCoach: { id: 9 } as never })).toBe(9)
  })
})
