'use server'

import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { hasRole } from '@/access'
import { getAgeRules } from '@/lib/age-rules'
import { readSheet } from '@/selections/read-sheet'
import { importEois, markExisting, parseEoiSheet, type ImportRow } from '@/selections/import'

export type ImportState = { error?: string; rows?: ImportRow[]; wording?: string; fileName?: string; done?: { created: number; updated: number; skipped: number; trialled: boolean } }

const admin = async () => {
  const u = await currentUser()
  return u && hasRole(u, 'admin') ? u : null
}

/** Step 1: read the file and show what would be imported. Nothing is saved; the file isn't kept. */
export async function previewImport(_prev: ImportState, fd: FormData): Promise<ImportState> {
  if (!(await admin())) return { error: 'Admins only.' }
  const f = fd.get('file')
  if (!(f instanceof File) || !f.size) return { error: 'Choose the .xlsx or .csv file exported from the form.' }
  if (!/\.(xlsx|csv)$/i.test(f.name)) return { error: 'That needs to be an Excel (.xlsx) or CSV file.' }
  if (f.size > 2_000_000) return { error: 'That file is too big for an EOI list.' }
  let rows: unknown[][]
  try {
    rows = await readSheet({ name: f.name, data: Buffer.from(await f.arrayBuffer()) })
  } catch {
    return { error: 'That file couldn’t be read — try saving it again as .xlsx or .csv.' }
  }
  const parsed = parseEoiSheet(rows)
  if (parsed.columns.email === undefined || parsed.columns.player === undefined || parsed.columns.dob === undefined) return { error: 'Couldn’t find the email, player name and date of birth columns in the first row.' }
  const p = await payload()
  await markExisting(p, parsed.rows, (await getAgeRules(p)).season)
  return { rows: parsed.rows, wording: parsed.marketingWording, fileName: f.name }
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '')

/** Step 2: import the previewed rows (re-checked here). Nobody is messaged. */
export async function runImport(_prev: ImportState, fd: FormData): Promise<ImportState> {
  if (!(await admin())) return { error: 'Admins only.' }
  let raw: unknown
  try {
    raw = JSON.parse(String(fd.get('rows') ?? '[]'))
  } catch {
    return { error: 'Please preview the file again.' }
  }
  if (!Array.isArray(raw) || raw.length > 2000) return { error: 'Please preview the file again.' }
  // Rebuild each row from plain text fields and re-run the same checks as the preview
  const sheet = [['Timestamp', 'Parent name', 'Mobile', 'Email', 'Player name', 'Date of birth', 'Gender', 'Club', 'News and offers', 'Notes']]
  const notes: string[] = []
  for (const r of raw as Record<string, unknown>[]) {
    sheet.push([str(r.answeredAt), `${str(r.parentFirst)} ${str(r.parentLast)}`, str(r.phone, 20), str(r.email), `${str(r.playerFirst)} ${str(r.playerLast)}`, str(r.dob, 10), str(r.gender, 10), str(r.previousClub), r.marketing === true ? 'Yes' : 'No', ''])
    notes.push(str(r.notes, 500))
  }
  const parsed = parseEoiSheet(sheet)
  parsed.rows.forEach((row, i) => { row.notes = notes[i] || row.notes })
  const trialled = fd.get('trialled') === 'yes'
  const result = await importEois(await payload(), parsed.rows, str(fd.get('wording'), 300), { trialled })
  revalidatePath('/management', 'layout')
  return { done: { ...result, trialled } }
}
