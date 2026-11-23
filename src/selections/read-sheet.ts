import ExcelJS from 'exceljs'
import { splitCsv } from '../finance/bank'

/** A cell's plain value: Excel links, rich text and formulas are unwrapped to their text/result. */
function cellValue(v: unknown): unknown {
  if (v === null || v === undefined) return ''
  if (v instanceof Date || typeof v !== 'object') return v
  const o = v as { text?: unknown; richText?: { text: string }[]; result?: unknown; hyperlink?: string }
  if (Array.isArray(o.richText)) return o.richText.map((t) => t.text).join('')
  if (o.result !== undefined) return cellValue(o.result)
  if (o.text !== undefined) return cellValue(o.text)
  return String(v)
}

/**
 * Rows of the first sheet of an .xlsx (or the sheet named `sheet`, if it exists), or of a .csv (first row = headings).
 * `keepLines`: row i of the result is spreadsheet line i+1 (empty lines kept as []), so line numbers match Excel.
 */
export async function readSheet(file: { name: string; data: Buffer }, o: { sheet?: string; keepLines?: boolean } = {}): Promise<unknown[][]> {
  if (/\.csv$/i.test(file.name)) {
    return file.data.toString('utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim()).map(splitCsv)
  }
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(file.data as unknown as ArrayBuffer)
  const ws = (o.sheet && wb.worksheets.find((w) => w.name.trim().toLowerCase() === o.sheet!.toLowerCase())) || wb.worksheets[0]
  if (!ws) return []
  const rows: unknown[][] = []
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals = (row.values as unknown[]).slice(1).map(cellValue) // ExcelJS rows start at index 1
    if (o.keepLines) {
      while (rows.length < row.number - 1) rows.push([])
      rows[row.number - 1] = vals
    } else rows.push(vals)
  })
  return rows
}
