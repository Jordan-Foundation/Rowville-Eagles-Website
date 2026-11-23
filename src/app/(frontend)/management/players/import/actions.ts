'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { readSheet } from '@/selections/read-sheet'
import { previewImport, runImport, undoBatch, type Preview } from '@/imports/run'
import { buildReport } from '@/imports/template'

export type ImportState = { error?: string; missing?: string[]; preview?: Preview; sheet?: unknown[][]; fileName?: string; report?: string; done?: { batch: number; counts: Record<string, unknown> } }

/** Plain JSON values only (dates become ISO strings) so the sheet can travel back for the import step. */
const plain = (rows: unknown[][]) => JSON.parse(JSON.stringify(rows)) as unknown[][]

/** Step 1: read the file and show what would happen. Nothing is saved. */
export async function previewAction(_prev: ImportState, fd: FormData): Promise<ImportState> {
  if (!(await managementOrNull())) return { error: 'Management only.' }
  const f = fd.get('file')
  if (!(f instanceof File) || !f.size) return { error: 'Choose the filled-in template (.xlsx or .csv).' }
  if (!/\.(xlsx|csv)$/i.test(f.name)) return { error: 'That needs to be the Excel template (.xlsx) or a .csv.' }
  if (f.size > 5_000_000) return { error: 'That file is too big.' }
  let sheet: unknown[][]
  try {
    sheet = plain(await readSheet({ name: f.name, data: Buffer.from(await f.arrayBuffer()) }, { sheet: 'Players', keepLines: true }))
  } catch {
    return { error: 'That file couldn’t be read — save it again as .xlsx and try again.' }
  }
  const p = await payload()
  const preview = await previewImport(p, sheet)
  if ('missing' in preview) return { error: `This file is missing ${preview.missing.length === 1 ? 'a required column' : 'required columns'}: ${preview.missing.join(', ')}. Use the template’s headings.`, missing: preview.missing }
  const report = (await buildReport(sheet, preview.rows)).toString('base64')
  return { preview, sheet, fileName: f.name, report }
}

/** Step 2: import the valid rows (the file is checked again first). */
export async function importAction(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const me = await managementOrNull()
  if (!me) return { error: 'Management only.' }
  let sheet: unknown[][]
  try {
    sheet = JSON.parse(String(fd.get('sheet') ?? '[]'))
  } catch {
    return { error: 'Please preview the file again.' }
  }
  if (!Array.isArray(sheet) || sheet.length > 3000) return { error: 'Please preview the file again.' }
  try {
    const r = await runImport(await payload(), { sheet, fileName: String(fd.get('fileName') ?? 'players.xlsx'), by: me })
    revalidatePath('/management', 'layout')
    return { done: r }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'The import failed — please try again.' }
  }
}

export async function undoAction(fd: FormData) {
  const me = await managementOrNull()
  const back = '/management/players/import'
  if (!me) redirect(`${back}?error=${encodeURIComponent('Management only.')}`)
  let msg = 'Import undone — everything it created has been removed and changed players put back.'
  try {
    await undoBatch(await payload(), Number(fd.get('batch')), me)
  } catch (e) {
    redirect(`${back}?error=${encodeURIComponent(e instanceof Error ? e.message : 'Couldn’t undo.')}`)
  }
  revalidatePath('/management', 'layout')
  redirect(`${back}?done=${encodeURIComponent(msg)}`)
}
