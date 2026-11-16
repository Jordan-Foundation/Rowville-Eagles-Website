import ExcelJS from 'exceljs'
import { KIND_LABEL } from './rules'
import type { WeekPay } from './pay'

const hm = (iso: string) => new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))

/**
 * The week's pay as a spreadsheet: a summary per coach, every line, and a sheet laid out for keying into
 * Xero Payroll (ordinary hours per day per employee, plus the share-link bonus as a separate amount).
 * The portal calculates and reports pay — Xero handles PAYG tax and Single Touch Payroll.
 */
export async function payWorkbook(w: WeekPay): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Rowville Eagles website'
  const money = '"$"#,##0.00'

  const sum = wb.addWorksheet('Summary')
  sum.addRow([`Coach pay — week ${w.weekStart} to ${w.weekEnd}`]).font = { bold: true, size: 13 }
  sum.addRow([])
  const head = sum.addRow(['Coach', 'Hours', 'Base pay', 'Share-link bonus', 'Bonus reversed', 'Gross pay', 'Super', 'Total cost'])
  head.font = { bold: true }
  for (const c of w.coaches) sum.addRow([c.coach.name + (c.missingRate ? ' (NO RATE SET)' : ''), c.hours, c.base, c.bonus, c.bonusReversed ? -c.bonusReversed : 0, c.gross, c.super, c.total])
  const t = sum.addRow(['Total', w.totals.hours, w.totals.base, w.totals.bonus, null, w.totals.gross, w.totals.super, w.totals.total])
  t.font = { bold: true }
  sum.columns.forEach((col, i) => { col.width = i === 0 ? 30 : 15; if (i >= 2) col.numFmt = money })

  const lines = wb.addWorksheet('Lines')
  lines.addRow(['Coach', 'Date', 'Start', 'End', 'Type', 'Minutes', 'Hours', 'Rate', 'Pay', 'Client / program', 'Venue', 'Share link', 'Bonus', 'Note']).font = { bold: true }
  for (const c of w.coaches) for (const l of c.lines) lines.addRow([c.coach.name, l.date, hm(l.startsAt), hm(l.endsAt), KIND_LABEL[l.kind], l.minutes, Math.round((l.minutes / 60) * 100) / 100, l.rate, l.rate != null ? Math.round(((l.rate * l.minutes) / 60) * 100) / 100 : null, l.client ?? '', l.venue ?? '', l.shareLink ? 'Yes' : '', l.bonus || null, l.note ?? ''])
  lines.columns.forEach((col, i) => { col.width = [24, 12, 8, 8, 18, 9, 8, 10, 10, 30, 24, 10, 10, 30][i] ?? 12; if ([7, 8, 12].includes(i)) col.numFmt = money })

  const xero = wb.addWorksheet('Xero Payroll')
  xero.addRow(['Employee', 'Date', 'Earnings rate', 'Hours', 'Amount', 'Notes']).font = { bold: true }
  for (const c of w.coaches) {
    const byDay = new Map<string, number>()
    for (const l of c.lines) byDay.set(l.date, (byDay.get(l.date) ?? 0) + l.minutes)
    for (const [date, m] of [...byDay].sort()) xero.addRow([c.xeroName, date, 'Ordinary Hours', Math.round((m / 60) * 100) / 100, null, ''])
    const bonus = Math.round((c.bonus - c.bonusReversed) * 100) / 100
    if (bonus) xero.addRow([c.xeroName, w.weekEnd, 'Share-link bonus', null, bonus, c.bonusReversed ? `includes ${c.bonusReversed.toFixed(2)} reversed (refund)` : ''])
  }
  xero.addRow([])
  xero.addRow(['Super is calculated on top of gross pay at the rate in Finance settings — Xero calculates and pays it from these earnings.'])
  xero.columns.forEach((col, i) => { col.width = [28, 12, 20, 10, 12, 40][i] ?? 12 })
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/** The same week as CSV (summary per coach). */
export function payCsvRows(w: WeekPay) {
  return {
    headers: ['Coach', 'Week start', 'Week end', 'Hours', 'Base pay', 'Share-link bonus', 'Bonus reversed', 'Gross pay', 'Super', 'Total cost'],
    rows: w.coaches.map((c) => [c.coach.name, w.weekStart, w.weekEnd, c.hours, c.base, c.bonus, c.bonusReversed, c.gross, c.super, c.total]),
  }
}
