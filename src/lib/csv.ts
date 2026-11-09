/** CSV files for Management downloads (pure — unit tested). Opens cleanly in Excel and Google Sheets. */

export type CsvValue = string | number | boolean | null | undefined | Date

const cell = (v: CsvValue) => {
  if (v === null || v === undefined) return ''
  let s = v instanceof Date ? v.toISOString() : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)
  // Spreadsheets run cells that start with = + - @ as formulas: neutralise them (but keep negative numbers)
  if (/^[=+\-@\t\r]/.test(s) && !(typeof v === 'number')) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers: string[], rows: CsvValue[][]) {
  // Byte-order mark so Excel reads names with accents correctly
  return '﻿' + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

export const csvFilename = (name: string, now = new Date()) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${now.toISOString().slice(0, 10)}.csv`
