import { createHash } from 'node:crypto'

/**
 * Bank transactions — pure parsing and matching (unit-tested). Statement upload (Westpac CSV or OFX) ships first;
 * other "bank sources" (Xero bank feed, Open Banking) only need to produce the same BankRow shape.
 */
export type BankRow = { date: string; description: string; amount: number; direction: 'debit' | 'credit'; externalId: string; account?: string | null }
export type BankSource = { name: 'csv' | 'ofx' | 'xero' | 'open-banking'; parse: (text: string) => BankRow[] }

const hash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 24)
const money = (s: string | undefined) => {
  const n = Number(String(s ?? '').replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1'))
  return Number.isFinite(n) ? n : 0
}

/** dd/mm/yyyy, d/m/yy, yyyy-mm-dd or yyyymmdd → YYYY-MM-DD (Australian day-first). */
export function bankDate(s: string): string | null {
  const t = s.trim()
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = t.match(/^(\d{4})(\d{2})(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

function splitCsv(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++ } else quoted = !quoted }
    else if (c === ',' && !quoted) { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out.map((x) => x.trim())
}

/**
 * Westpac CSV ("Bank Account, Date, Narrative, Debit Amount, Credit Amount, Balance, Categories, Serial") and
 * other common layouts (Date / Description / Amount, or Debit / Credit columns). Identical rows in one file get a
 * running number so they stay distinct but re-importing the same file adds nothing.
 */
export function parseCsv(text: string): BankRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return []
  const head = splitCsv(lines[0]).map((h) => h.toLowerCase())
  const col = (...names: string[]) => head.findIndex((h) => names.some((n) => h === n || h.includes(n)))
  const iDate = col('date')
  const iDesc = col('narrative', 'description', 'details', 'transaction')
  const iDebit = col('debit')
  const iCredit = col('credit')
  const iAmount = col('amount')
  const iAcct = col('bank account', 'account')
  const iBal = col('balance')
  const iSerial = col('serial', 'reference')
  if (iDate < 0 || (iDebit < 0 && iAmount < 0)) throw new Error('This doesn’t look like a bank statement CSV (no Date and Amount/Debit columns).')
  const seen = new Map<string, number>()
  const out: BankRow[] = []
  for (const l of lines.slice(1)) {
    const c = splitCsv(l)
    const date = bankDate(c[iDate] ?? '')
    if (!date) continue
    let signed: number
    if (iDebit >= 0 || iCredit >= 0) signed = money(c[iCredit]) - money(c[iDebit])
    else signed = money(c[iAmount])
    if (!signed) continue
    const description = (c[iDesc] ?? '').replace(/\s+/g, ' ').trim()
    const account = iAcct >= 0 && iAcct !== iDebit && iAcct !== iCredit ? c[iAcct] || null : null
    const base = [account ?? '', date, description, signed.toFixed(2), iBal >= 0 ? c[iBal] : '', iSerial >= 0 ? c[iSerial] : ''].join('|')
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    out.push({ date, description, amount: Math.abs(Math.round(signed * 100) / 100), direction: signed < 0 ? 'debit' : 'credit', externalId: `csv:${hash(`${base}|${n}`)}`, account })
  }
  return out
}

/** OFX / QFX (Westpac “Export to Quicken/MYOB”): one row per <STMTTRN>, its FITID is the unique ID. */
export function parseOfx(text: string): BankRow[] {
  const acct = (text.match(/<ACCTID>([^<\r\n]+)/i) ?? [])[1]?.trim() ?? null
  const out: BankRow[] = []
  for (const block of text.split(/<STMTTRN>/i).slice(1)) {
    const tag = (t: string) => (block.match(new RegExp(`<${t}>([^<\\r\\n]+)`, 'i')) ?? [])[1]?.trim()
    const date = bankDate(tag('DTPOSTED') ?? '')
    const amt = money(tag('TRNAMT'))
    if (!date || !amt) continue
    const description = [tag('NAME'), tag('MEMO')].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    const fitid = tag('FITID')
    out.push({ date, description, amount: Math.abs(amt), direction: amt < 0 ? 'debit' : 'credit', externalId: fitid ? `ofx:${acct ?? ''}:${fitid}` : `ofx:${hash(`${acct}|${date}|${description}|${amt}`)}`, account: acct })
  }
  return out
}

export const SOURCES: Record<'csv' | 'ofx', BankSource> = { csv: { name: 'csv', parse: parseCsv }, ofx: { name: 'ofx', parse: parseOfx } }
export const detectSource = (filename: string, text: string): BankSource => (/\.(ofx|qfx)$/i.test(filename) || /<OFX>|<STMTTRN>/i.test(text) ? SOURCES.ofx : SOURCES.csv)

/** Stripe payouts and similar money coming in — not expenses. */
export const isIncomeTransfer = (r: Pick<BankRow, 'direction' | 'description'>) => r.direction === 'credit' && /stripe/i.test(r.description)

// ── Matching bank debits to expenses ─────────────────────────────────────────────

export type MatchExpense = { id: number; date: string; amount: number; supplier: string; linked: boolean }
const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !['pty', 'ltd', 'the', 'and', 'card', 'visa', 'eftpos', 'purchase', 'debit', 'aus', 'australia', 'sydney', 'melbourne'].includes(w)))
const dayDiff = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000

/** Best expense for a debit: same amount (to the cent), within ±`days` days, supplier words help break ties. */
export function bestMatch(row: Pick<BankRow, 'date' | 'amount' | 'description' | 'direction'>, expenses: MatchExpense[], days = 4): MatchExpense | null {
  if (row.direction !== 'debit') return null
  const desc = words(row.description)
  const scored = expenses
    .filter((e) => !e.linked && Math.abs(e.amount - row.amount) < 0.005 && dayDiff(e.date, row.date) <= days)
    .map((e) => ({ e, score: [...words(e.supplier)].filter((w) => desc.has(w)).length * 10 - dayDiff(e.date, row.date) }))
    .sort((a, b) => b.score - a.score)
  return scored[0]?.e ?? null
}
