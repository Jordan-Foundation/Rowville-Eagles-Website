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

/** Rows of the first sheet of an .xlsx, or of a .csv (first row = headings). */
export async function readSheet(file: { name: string; data: Buffer }): Promise<unknown[][]> {
  if (/\.csv$/i.test(file.name)) {
    return file.data.toString('utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim()).map(splitCsv)
  }
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(file.data as unknown as ArrayBuffer)
  const ws = wb.worksheets[0]
  if (!ws) return []
  const rows: unknown[][] = []
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals = (row.values as unknown[]).slice(1) // ExcelJS rows start at index 1
    rows.push(vals.map(cellValue))
  })
  return rows
}
