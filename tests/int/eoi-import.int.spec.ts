import { describe, expect, it } from 'vitest'
import { mapHeadings, parseEoiSheet, toYmd } from '@/selections/import'

const HEAD = ['Timestamp', 'Parent/Guardian Name(First and Last)', 'Mobile Number', 'Email Address', 'Player Name', 'Player Date of Birth', 'What Age Group Do You Want To Play In for 2027?', 'Male/Female', 'Current club? (if any)', 'Current level', 'Would you like to receive news, program updates and special offers from REFC by email or SMS?']

describe('old form import', () => {
  it('finds each column by its heading (the news question isn’t mistaken for the email column)', () => {
    expect(mapHeadings(HEAD)).toEqual({ timestamp: 0, parent: 1, phone: 2, email: 3, player: 4, dob: 5, wantGroup: 6, gender: 7, club: 8, level: 9, marketing: 10 })
  })
  it('reads dates however Excel or Sheets gives them', () => {
    expect(toYmd(new Date('2020-10-14T00:00:00Z'))).toBe('2020-10-14')
    expect(toYmd(44118)).toBe('2020-10-14') // Excel day number
    expect(toYmd('14/10/2020')).toBe('2020-10-14')
    expect(toYmd('2020-10-14')).toBe('2020-10-14')
    expect(toYmd('soon')).toBeNull()
  })
  it('maps a row, borrows a missing surname, keeps the age group asked for, and catches duplicates and problems', () => {
    const at = new Date('2026-10-01T09:00:00Z')
    const { rows } = parseEoiSheet([
      HEAD,
      [at, 'pat example', '412 345 678', 'Pat@Example.com ', 'Sam', new Date('2018-01-04T00:00:00Z'), 'U10', 'Male', 'Knox City', 'Div 2', 'Yes'],
      [at, 'Pat Example', '0412345678', 'pat@example.com', 'Sam', '04/01/2018', 'U10', 'Male', '', '', 'Yes'],
      [at, 'Lee', '0400000000', 'not-an-email', 'Kim Lee', '2017-05-05', 'U10', 'Female', '', '', 'No'],
      ['', '', '', '', '', '', '', '', '', '', ''],
    ])
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ line: 2, parentFirst: 'Pat', parentLast: 'Example', email: 'pat@example.com', phone: '0412345678', playerFirst: 'Sam', playerLast: 'Example', dob: '2018-01-04', gender: 'male', previousClub: 'Knox City', marketing: true, answeredAt: at.toISOString() })
    expect(rows[0].notes).toMatch(/Asked to play in U10 · Current level: Div 2/)
    expect(rows[1].duplicate).toBe('Same as line 2')
    expect(rows[2]).toMatchObject({ parentLast: 'Lee', problem: 'No valid email', marketing: false })
  })
})
