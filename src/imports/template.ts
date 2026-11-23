import { COLUMNS, type ImportRow } from './players'

const LISTS: Record<string, string[]> = {
  'Parent 1 relationship': ['Mother', 'Father', 'Guardian', 'Grandparent', 'Other'],
  'Send messages to Parent 2?': ['Yes', 'No'],
  Gender: ['Male', 'Female', 'Non-binary', 'Prefer not to say'],
  'Rowville Eagles player?': ['Yes', 'No'],
  Position: ['Goalkeeper', 'Outfield'],
  'RFA player?': ['Yes', 'No'],
  'Registration status': ['Paid', 'Not paid', 'N/A'],
  'Paid for 1-on-1s, camps or academy before?': ['Yes', 'No'],
  'Photo consent?': ['Yes', 'No'],
}

/** The import template: Players (with Birth year + Check helper columns), How to fill in, and Lists (dropdown values). */
export async function buildTemplate(o: { teams: string[]; sizes: { shirt?: string[]; shorts?: string[]; jacket?: string[] } }) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Players', { views: [{ state: 'frozen', ySplit: 1 }] })
  const headers = [...COLUMNS.map((c) => `${c.header}${'required' in c && c.required ? ' *' : ''}`), 'Birth year', 'Check']
  ws.addRow(headers)
  ws.getRow(1).font = { bold: true }
  ws.columns.forEach((c, i) => { c.width = Math.max(14, Math.min(34, headers[i].length + 2)) })
  const col = (header: string) => COLUMNS.findIndex((c) => c.header === header) + 1
  const letter = (n: number) => ws.getColumn(n).letter
  const dobCol = letter(col('Date of birth'))
  const numCol = letter(col('Shirt number'))
  const posCol = letter(col('Position'))
  const lists = wb.addWorksheet('Lists')
  const listCols: Record<string, string> = {}
  const allLists: Record<string, string[]> = { ...LISTS, 'Eagles team': o.teams, 'Shirt size': o.sizes.shirt ?? [], 'Shorts size': o.sizes.shorts ?? [], 'Jacket size': o.sizes.jacket ?? [] }
  Object.entries(allLists).forEach(([name, values], i) => {
    const c = lists.getColumn(i + 1)
    c.width = 26
    lists.getCell(1, i + 1).value = name
    lists.getCell(1, i + 1).font = { bold: true }
    values.forEach((v, j) => { lists.getCell(j + 2, i + 1).value = v })
    listCols[name] = `Lists!$${c.letter}$2:$${c.letter}$${Math.max(2, values.length + 1)}`
  })
  for (let r = 2; r <= 500; r++) {
    for (const [name, range] of Object.entries(listCols)) {
      if (!allLists[name].length) continue
      ws.getCell(r, col(name)).dataValidation = { type: 'list', allowBlank: true, formulae: [range], showErrorMessage: name !== 'Eagles team' }
    }
    ws.getCell(r, col('Date of birth')).numFmt = 'dd/mm/yyyy'
    ws.getCell(r, headers.length - 1).value = { formula: `IF(${dobCol}${r}="","",YEAR(${dobCol}${r}))` }
    ws.getCell(r, headers.length).value = { formula: `IF(${numCol}${r}="","",IF(AND(${numCol}${r}=1,${posCol}${r}<>"Goalkeeper"),"Number 1 is for goalkeepers",""))` }
  }
  const help = wb.addWorksheet('How to fill in')
  help.getColumn(1).width = 34
  help.getColumn(2).width = 90
  help.addRow(['Column', 'How to fill it in']).font = { bold: true }
  const notes: Record<string, string> = {
    'Parent 1 email': 'Their login. One family per Parent 1 email — siblings share it.',
    'Parent 1 mobile': 'Australian mobile, e.g. 0412 345 678 (412345678 is fine too).',
    'Send messages to Parent 2?': 'Yes = Parent 2 gets their own login on the same family and gets the launch email/text.',
    'Date of birth': 'dd/mm/yyyy, e.g. 03/04/2015 = 3 April 2015.',
    'Eagles team': 'Required for Eagles players. Must match a team name in the portal exactly (see Lists).',
    'Position': 'Goalkeeper or Outfield. Only goalkeepers can wear number 1.',
    'Shirt number': '1–99. No two players born in the same year can share a number.',
    'Registration status': 'Paid = paid outside the portal. Not paid = shows on the “Registration owing” list (no email is sent automatically).',
    'Paid for 1-on-1s, camps or academy before?': 'Yes = an existing Academy client (coach share links won’t count them as new).',
    'Medical conditions / allergies': 'Seen only by Management and the player’s coaches.',
    'Notes (Management only)': 'Never shown to families.',
    'Birth year': 'Worked out for you — ignored by the import.',
    'Check': 'Worked out for you — ignored by the import.',
  }
  for (const h of [...COLUMNS.map((c) => c.header), 'Birth year', 'Check']) {
    const c = COLUMNS.find((x) => x.header === h)
    help.addRow([`${h}${c && 'required' in c && c.required ? ' *' : ''}`, notes[h] ?? (c && 'required' in c && c.required ? 'Required.' : 'Optional.')])
  }
  help.addRow([])
  help.addRow(['', '* = required. Headings are matched by name, so columns can be in any order. Empty rows are skipped.'])
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/** The uploaded rows with an "Import result" column added (errors and warnings per row). */
export async function buildReport(sheet: unknown[][], results: Pick<ImportRow, 'line' | 'errors' | 'warnings'>[]) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Players')
  const byLine = new Map(results.map((r) => [r.line, r]))
  const width = Math.max(...sheet.map((r) => r.length), 1)
  sheet.forEach((row, i) => {
    const line = i + 1
    const cells = Array.from({ length: width }, (_, j) => row[j] ?? '')
    const r = byLine.get(line)
    const result = line === 1 ? 'Import result' : r ? (r.errors.length ? `ERROR: ${r.errors.join('; ')}` : r.warnings.length ? `Warning: ${r.warnings.join('; ')}` : 'OK') : ''
    const added = ws.addRow([...cells, result])
    if (line === 1) added.font = { bold: true }
    if (r?.errors.length) added.getCell(width + 1).font = { color: { argb: 'FFC00000' }, bold: true }
  })
  ws.getColumn(width + 1).width = 80
  return Buffer.from(await wb.xlsx.writeBuffer())
}
