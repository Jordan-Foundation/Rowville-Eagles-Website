import { describe, expect, it } from 'vitest'
import { bonusFor, mondayOf, payForCoach, pctOf, perSession, previousWeek, rateOn, reportDue, withSetupPackup, DEFAULT_PAY, type HourLine } from '@/finance/rules'

const at = (ymd: string, hm: string) => new Date(`${ymd}T${hm}:00+11:00`).toISOString()
const line = (start: string, end: string, o: Partial<HourLine> = {}): HourLine => ({
  key: `s:${start}`, coachId: 1, date: '2026-11-17', startsAt: at('2026-11-17', start), endsAt: at('2026-11-17', end),
  minutes: (Date.parse(at('2026-11-17', end)) - Date.parse(at('2026-11-17', start))) / 60000, kind: 'one-on-one', venue: 'Parkridge', ...o,
})
const total = (ls: HourLine[]) => ls.reduce((n, l) => n + l.minutes, 0) / 60

describe('setup & pack-up blocks', () => {
  it('1 session of 1 hour = 1.5 paid hours', () => {
    const out = withSetupPackup([line('16:00', '17:00')])
    expect(total(out)).toBe(1.5)
    expect(out.filter((l) => l.kind === 'setup_packup')).toHaveLength(1)
  })
  it('3 back-to-back sessions = 3.5 hours (one block)', () => {
    const out = withSetupPackup([line('16:00', '17:00'), line('17:00', '18:00'), line('18:00', '19:00')])
    expect(total(out)).toBe(3.5)
    expect(new Set(out.map((l) => l.blockId)).size).toBe(1)
  })
  it('a gap splits the block; cancelling the middle session splits it too', () => {
    expect(total(withSetupPackup([line('16:00', '17:00'), line('17:30', '18:30')]))).toBe(3)
    expect(total(withSetupPackup([line('16:00', '17:00'), line('18:00', '19:00')]))).toBe(3) // middle one cancelled
    expect(total(withSetupPackup([line('16:00', '17:00'), line('17:10', '18:10')], { setupMinutes: 15, packupMinutes: 15, gapMinutes: 15, kinds: ['one-on-one'] }))).toBe(2.5)
  })
  it('different venue or coach = separate blocks; manual hours get no setup', () => {
    expect(total(withSetupPackup([line('16:00', '17:00'), line('17:00', '18:00', { venue: 'Other ground' })]))).toBe(3)
    expect(total(withSetupPackup([line('16:00', '17:00'), line('17:00', '18:00', { coachId: 2 })]))).toBe(3)
    expect(total(withSetupPackup([line('09:00', '11:00', { kind: 'manual' })]))).toBe(2)
  })
})

describe('rates, bonus and super', () => {
  const rates = [{ hourlyRate: 30, effectiveFrom: '2026-01-01' }, { hourlyRate: 35, effectiveFrom: '2026-11-19' }]
  it('rate change mid-week: earlier hours at the old rate, later at the new', () => {
    expect(rateOn(rates, '2026-11-18')).toBe(30)
    expect(rateOn(rates, '2026-11-19')).toBe(35)
    expect(rateOn(rates, '2025-12-31')).toBeNull()
    const ls = [line('16:00', '17:00', { date: '2026-11-18' }), line('16:00', '17:00', { date: '2026-11-20', key: 'b' })]
    expect(payForCoach(1, ls, rates, DEFAULT_PAY).base).toBe(65)
  })
  it('share-link bonus = 10% of what the customer paid for that session; terms split per session', () => {
    expect(perSession(400, 8)).toBe(50)
    expect(bonusFor({ shareLink: true, customerAmount: 85, kind: 'one-on-one' }, 10)).toBe(8.5)
    expect(bonusFor({ shareLink: true, customerAmount: 50, kind: 'setup_packup' }, 10)).toBe(0)
    expect(bonusFor({ shareLink: false, customerAmount: 85, kind: 'one-on-one' }, 10)).toBe(0)
  })
  it('super 12% on top of wages (+ bonus when on); a refund reverses the bonus', () => {
    const ls = [line('16:00', '17:00', { shareLink: true, customerAmount: 85 })] // 1h at $30 + $8.50 bonus
    const withBonus = payForCoach(1, ls, rates, DEFAULT_PAY)
    expect(withBonus).toMatchObject({ base: 30, bonus: 8.5, gross: 38.5, super: 4.62, total: 43.12 })
    expect(payForCoach(1, ls, rates, { ...DEFAULT_PAY, superOnBonus: false }).super).toBe(3.6)
    expect(payForCoach(1, ls, rates, DEFAULT_PAY, { superOn: false }).super).toBe(0)
    const reversed = payForCoach(1, [line('16:00', '17:00')], rates, DEFAULT_PAY, { reversals: 8.5 })
    expect(reversed).toMatchObject({ base: 30, bonusReversed: 8.5, gross: 21.5 })
    expect(payForCoach(1, ls, [], DEFAULT_PAY).missingRate).toBe(true)
  })
})

describe('weeks and the Monday report', () => {
  it('weeks run Monday–Sunday; Monday covers the previous week (DST changes don’t move it)', () => {
    expect(mondayOf('2026-11-22')).toBe('2026-11-16')
    expect(mondayOf('2026-11-16')).toBe('2026-11-16')
    expect(previousWeek('2026-11-16')).toEqual({ start: '2026-11-09', end: '2026-11-15' })
    expect(previousWeek('2026-10-05')).toEqual({ start: '2026-09-28', end: '2026-10-04' }) // DST starts 4 Oct
    expect(reportDue({ weekday: 1, hour: 9 }, { day: 1, hour: 9 })).toBe(true)
    expect(reportDue({ weekday: 1, hour: 8 }, { day: 1, hour: 9 })).toBe(false)
  })
  it('cost as % of revenue', () => {
    expect(pctOf(250, 1000)).toBe(25)
    expect(pctOf(5, 0)).toBeNull()
  })
})

describe('bank import and matching', async () => {
  const { bankDate, bestMatch, detectSource, isIncomeTransfer, parseCsv, parseOfx } = await import('@/finance/bank')
  const westpac = `Bank Account,Date,Narrative,Debit Amount,Credit Amount,Balance,Categories,Serial
032000123456,16/11/2026,"DEBIT CARD PURCHASE REBEL SPORT KNOX AUS",120.00,,5880.00,OTHER,
032000123456,16/11/2026,"DEPOSIT STRIPE PAYMENTS AUSTRALIA",,1500.00,7380.00,DEP,
032000123456,17/11/2026,"DEBIT CARD PURCHASE BUNNINGS 123",45.50,,7334.50,OTHER,
032000123456,17/11/2026,"DEBIT CARD PURCHASE BUNNINGS 123",45.50,,7334.50,OTHER,`
  it('reads Westpac CSV (debits, credits, day-first dates) and keeps identical rows distinct', () => {
    const rows = parseCsv(westpac)
    expect(rows).toHaveLength(4)
    expect(rows[0]).toMatchObject({ date: '2026-11-16', amount: 120, direction: 'debit', account: '032000123456' })
    expect(rows[1]).toMatchObject({ amount: 1500, direction: 'credit' })
    expect(rows[2].externalId).not.toBe(rows[3].externalId)
    expect(parseCsv(westpac).map((r) => r.externalId)).toEqual(rows.map((r) => r.externalId)) // re-import = same IDs
    expect(isIncomeTransfer(rows[1])).toBe(true)
  })
  it('reads a Date/Description/Amount CSV and OFX', () => {
    expect(parseCsv('Date,Description,Amount\n2026-11-18,Canva,-17.99\n2026-11-18,Refund in,5.00')).toMatchObject([{ amount: 17.99, direction: 'debit' }, { amount: 5, direction: 'credit' }])
    const ofx = '<OFX><ACCTID>032000123456<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261119<TRNAMT>-89.00<FITID>ABC123<NAME>OFFICEWORKS<MEMO>Card</STMTTRN></OFX>'
    expect(parseOfx(ofx)).toEqual([{ date: '2026-11-19', description: 'OFFICEWORKS Card', amount: 89, direction: 'debit', externalId: 'ofx:032000123456:ABC123', account: '032000123456' }])
    expect(detectSource('statement.ofx', ofx).name).toBe('ofx')
    expect(detectSource('statement.csv', westpac).name).toBe('csv')
    expect(bankDate('5/3/26')).toBe('2026-03-05')
    expect(() => parseCsv('Foo,Bar\n1,2')).toThrow(/doesn’t look like/)
  })
  it('matches by amount and date (±4 days), supplier words break ties', () => {
    const exps = [{ id: 1, date: '2026-11-15', amount: 120, supplier: 'Rebel Sport', linked: false }, { id: 2, date: '2026-11-16', amount: 120, supplier: 'Kmart', linked: false }, { id: 3, date: '2026-11-01', amount: 45.5, supplier: 'Bunnings', linked: false }]
    expect(bestMatch({ date: '2026-11-16', amount: 120, description: 'DEBIT CARD PURCHASE REBEL SPORT KNOX', direction: 'debit' }, exps)?.id).toBe(1)
    expect(bestMatch({ date: '2026-11-17', amount: 45.5, description: 'BUNNINGS', direction: 'debit' }, exps)).toBeNull() // 16 days apart
    expect(bestMatch({ date: '2026-11-16', amount: 99, description: 'x', direction: 'debit' }, exps)).toBeNull()
    expect(bestMatch({ date: '2026-11-16', amount: 120, description: 'x', direction: 'credit' }, exps)).toBeNull()
  })
})
