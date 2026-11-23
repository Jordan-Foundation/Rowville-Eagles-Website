import { describe, expect, it } from 'vitest'
import { createHmac } from 'crypto'
import { COLUMNS, checkRows, parsePlayerSheet, toDob, toMobile, toYesNo, type ImportContext } from '@/imports/players'
import { DEFAULT_COPY, fillText, followUpDue, nonGsmChars, numbersList, playerNames, smsSegments, toEmailHtml, toGsm } from '@/launch/render'
import { verifySvix } from '@/launch/resend-webhook'
import { localToUtc, localYmd } from '@/lib/time'

const head = COLUMNS.map((c) => `${c.header}${'required' in c && c.required ? ' *' : ''}`)
const row = (o: Partial<Record<(typeof COLUMNS)[number]['key'], unknown>>) => COLUMNS.map((c) => o[c.key] ?? '')
const base = { parent1First: 'Kim', parent1Last: 'Lee', parent1Email: 'Kim.Lee@Example.com ', parent1Mobile: '412345678', playerFirst: 'Liam', playerLast: 'Lee', dob: '03/04/2015', eagles: 'Yes', team: 'U12 Gold', position: 'Outfield', rfa: 'No', number: 7, registration: 'Paid' }
const ctx = (o: Partial<ImportContext> = {}): ImportContext => ({ today: '2026-11-23', teams: new Map([['u12 gold', 'U12 Gold']]), numbers: new Map(), accounts: new Map(), range: () => ({ start: 2, end: 50 }), oldestBirthYear: 2008, sizes: {}, ...o })
const parse = (...rows: Partial<Record<(typeof COLUMNS)[number]['key'], unknown>>[]) => checkRows(parsePlayerSheet([head, ...rows.map(row)]).rows, ctx())

describe('cleaning', () => {
  it('mobiles to E.164', () => {
    expect(toMobile('412345678')).toBe('+61412345678')
    expect(toMobile(412345678)).toBe('+61412345678')
    expect(toMobile('0412 345 678')).toBe('+61412345678')
    expect(toMobile('(04) 1234-5678')).toBe('+61412345678')
    expect(toMobile('+61412345678')).toBe('+61412345678')
    expect(toMobile('61412345678')).toBe('+61412345678')
    expect(toMobile('9876 5432')).toBeNull()
  })
  it('dates are day first, never US', () => {
    expect(toDob('03/04/2015')).toBe('2015-04-03')
    expect(toDob(new Date('2015-04-03T00:00:00Z'))).toBe('2015-04-03')
    expect(toDob(42097)).toBe('2015-04-03') // Excel serial
    expect(toDob('2015-04-03')).toBe('2015-04-03')
    expect(toDob('31/02/2015')).toBeNull()
  })
  it('yes/no', () => {
    expect(toYesNo('Y')).toBe(true)
    expect(toYesNo('false')).toBe(false)
    expect(toYesNo('')).toBeNull()
    expect(toYesNo('maybe')).toBe('bad')
  })
})

describe('reading the sheet', () => {
  it('matches headings by name in any order and rejects a file missing a required column', () => {
    const reordered = [[...head].reverse(), row(base).reverse()]
    const r = parsePlayerSheet(reordered)
    expect(r.missing).toEqual([])
    expect(r.rows[0].parent1.email).toBe('kim.lee@example.com')
    expect(r.rows[0].parent1.mobile).toBe('+61412345678')
    expect(r.rows[0].player.dob).toBe('2015-04-03')
    expect(parsePlayerSheet([head.filter((h) => !/Shirt number/.test(h)), []]).missing).toEqual(['Shirt number'])
  })
  it('skips empty rows and ignores Birth year / Check', () => {
    const r = parsePlayerSheet([[...head, 'Birth year', 'Check'], [...row(base), 2015, ''], [], [...COLUMNS.map(() => ''), 2015, '']])
    expect(r.rows).toHaveLength(1)
  })
  it('keeps names as typed', () => {
    expect(parse({ ...base, playerLast: 'de Silva' })[0].player.last).toBe('de Silva')
  })
})

describe('checks', () => {
  it('number 1 on an outfield player is an error; on a goalkeeper it is fine', () => {
    expect(parse({ ...base, number: 1 })[0].errors.join()).toMatch(/goalkeepers only/)
    expect(parse({ ...base, number: 1, position: 'Goalkeeper' })[0].errors).toEqual([])
  })
  it('two 2015 players both #7 → error; a 2015 #7 and a 2017 #7 → both fine', () => {
    const clash = parse(base, { ...base, playerFirst: 'Mia', dob: '05/06/2015' })
    expect(clash.every((r) => r.errors.some((e) => /#7 is used by another 2015 player/.test(e)))).toBe(true)
    const ok = parse(base, { ...base, playerFirst: 'Ava', dob: '05/06/2017' })
    expect(ok.every((r) => r.errors.length === 0)).toBe(true)
  })
  it('a 2015 #7 already in the portal → error (unless it’s the same player)', () => {
    const rows = checkRows(parsePlayerSheet([head, row(base)]).rows, ctx({ numbers: new Map([['2015-7', 'someone|else|2015-01-01']]) }))
    expect(rows[0].errors.join()).toMatch(/already worn by another 2015 player in the portal/)
    const same = checkRows(parsePlayerSheet([head, row(base)]).rows, ctx({ numbers: new Map([['2015-7', 'liam|lee|2015-04-03']]) }))
    expect(same[0].errors).toEqual([])
  })
  it('missing / unknown team, bad email or mobile, future DOB, duplicate player', () => {
    expect(parse({ ...base, team: '' })[0].errors.join()).toMatch(/no Eagles team/)
    expect(parse({ ...base, team: 'U99 Purple' })[0].errors.join()).toMatch(/doesn’t exist/)
    expect(parse({ ...base, parent1Email: 'nope' })[0].errors.join()).toMatch(/valid email/)
    expect(parse({ ...base, parent1Mobile: '98765432' })[0].errors.join()).toMatch(/Australian mobile/)
    expect(parse({ ...base, dob: '01/01/2030' })[0].errors.join()).toMatch(/future/)
    expect(parse(base, base)[1].errors.join()).toMatch(/more than once/)
  })
  it('warnings: number outside the range, different name on an existing account, Parent 2 = Parent 1', () => {
    expect(parse({ ...base, number: 77 })[0].warnings.join()).toMatch(/Keeping existing number outside the 2015 range/)
    const named = checkRows(parsePlayerSheet([head, row(base)]).rows, ctx({ accounts: new Map([['kim.lee@example.com', 'Kerry Lee']]) }))
    expect(named[0].warnings.join()).toMatch(/different name/)
    expect(parse({ ...base, parent2First: 'Sam', parent2Email: 'kim.lee@example.com' })[0].warnings.join()).toMatch(/same as Parent 1/)
    expect(parse(base)[0].info).toContain('No Parent 2 contact')
  })
})

describe('launch messages', () => {
  it('siblings listed together; numbers one per line', () => {
    expect(playerNames(['Liam'])).toBe('Liam')
    expect(playerNames(['Liam', 'Mia'])).toBe('Liam and Mia')
    expect(playerNames(['Liam', 'Mia', 'Ava'])).toBe('Liam, Mia and Ava')
    expect(numbersList([{ name: 'Liam', number: 7, team: 'U10 Eagles Gold' }, { name: 'Mia', number: 12, team: null }])).toBe('Liam – #7 – U10 Eagles Gold\nMia – #12')
  })
  it('SMS templates are plain GSM-7 only', () => {
    expect(nonGsmChars(DEFAULT_COPY.launchSms)).toEqual([])
    expect(smsSegments(DEFAULT_COPY.launchSms).unicode).toBe(false)
    expect(nonGsmChars('Hi – it’s “here” 🎉')).toEqual(['–', '’', '“', '”', '🎉'])
    expect(toGsm('Hi – it’s “here”')).toBe('Hi - it\'s "here"')
    expect(smsSegments('a'.repeat(160)).segments).toBe(1)
    expect(smsSegments('a'.repeat(161)).segments).toBe(2)
    expect(smsSegments('’'.repeat(71)).segments).toBe(2)
  })
  it('activation block only for parents who haven’t activated', () => {
    const v = { activation_link: 'https://x/a', parent_first_name: 'Kim' }
    expect(fillText(DEFAULT_COPY.followUpBody, v, { activated: false })).toMatch(/You haven't opened your account yet/)
    expect(fillText(DEFAULT_COPY.followUpBody, v, { activated: true })).not.toMatch(/opened your account/)
  })
  it('buttons, lists and bold render to email HTML', () => {
    const html = toEmailHtml(fillText(DEFAULT_COPY.launchBody, { activation_link: 'https://x/act', parent_first_name: 'Kim' }))
    expect(html).toMatch(/<a href="https:\/\/x\/act"[^>]*>Open my account<\/a>/)
    expect(html).toMatch(/<ul/)
    expect(html).toMatch(/<ol/)
    expect(html).toMatch(/<strong>What you can do in the portal<\/strong>/)
  })
  it('follow-up is due at 6:30pm Melbourne, 7 days after the launch email', () => {
    const due = followUpDue('2026-11-23T08:00:00Z', 7, localToUtc, localYmd)
    expect(localYmd(due)).toBe('2026-11-30')
    expect(due.toISOString()).toBe('2026-11-30T07:30:00.000Z') // 6:30pm AEDT
  })
})

describe('Resend webhook signature', () => {
  const secret = `whsec_${Buffer.from('super-secret-key').toString('base64')}`
  const sign = (id: string, ts: string, body: string) => createHmac('sha256', Buffer.from('super-secret-key')).update(`${id}.${ts}.${body}`).digest('base64')
  it('accepts a correct signature and rejects a wrong or stale one', () => {
    const now = 1_800_000_000_000
    const ts = String(now / 1000)
    expect(verifySvix({ secret, id: 'm1', timestamp: ts, signature: `v1,${sign('m1', ts, '{}')}`, body: '{}', now })).toBe(true)
    expect(verifySvix({ secret, id: 'm1', timestamp: ts, signature: `v1,${sign('m1', ts, '{"x":1}')}`, body: '{}', now })).toBe(false)
    expect(verifySvix({ secret, id: 'm1', timestamp: String(now / 1000 - 3600), signature: `v1,${sign('m1', String(now / 1000 - 3600), '{}')}`, body: '{}', now })).toBe(false)
  })
})
