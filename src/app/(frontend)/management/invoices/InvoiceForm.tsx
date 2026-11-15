'use client'

import { useActionState, useMemo, useState } from 'react'
import { saveInvoiceAction, type InvoiceFormState } from './actions'

export type CatalogueGroup = { group: string; items: { key: string; label: string; price: number }[] }
export type Family = { id: number; name: string; email: string; phone: string }
type Line = { desc: string; qty: string; price: string; src: string }
export type InvoiceDraft = {
  id?: number
  payee: 'academy' | 'club'
  account?: number | null
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  playerName?: string
  lines: Line[]
  note?: string
  dueDate?: string
  status?: string
}

const input = 'mt-1 block w-full min-h-10 border border-line bg-surface px-3 py-2 text-sm'
const money = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
const lineTotal = (l: Line) => Math.round(Math.max(0, Number(l.price) || 0) * 100) * Math.max(0, Math.floor(Number(l.qty) || 0)) / 100
const blank = (): Line => ({ desc: '', qty: '1', price: '', src: '' })

/** Who it's for, the items (picked from the price list or typed), a note, due date — then save or send. */
export function InvoiceForm({ catalogue, families, initial }: { catalogue: CatalogueGroup[]; families: Family[]; initial: InvoiceDraft }) {
  const [state, action, pending] = useActionState<InvoiceFormState, FormData>(saveInvoiceAction, {})
  const [lines, setLines] = useState<Line[]>(initial.lines.length ? initial.lines : [blank()])
  const [account, setAccount] = useState<number | null>(initial.account ?? null)
  const [who, setWho] = useState({ name: initial.contactName ?? '', email: initial.contactEmail ?? '', phone: initial.contactPhone ?? '' })
  const [search, setSearch] = useState(() => families.find((f) => f.id === initial.account)?.name ?? '')
  const total = useMemo(() => lines.reduce((t, l) => t + Math.round(lineTotal(l) * 100), 0) / 100, [lines])
  const byKey = useMemo(() => new Map(catalogue.flatMap((g) => g.items.map((i) => [i.key, i] as const))), [catalogue])
  const label = (f: Family) => `${f.name} · ${f.email}`
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const pickFamily = (v: string) => {
    setSearch(v)
    const f = families.find((x) => label(x) === v)
    if (f) {
      setAccount(f.id)
      setWho({ name: f.name, email: f.email, phone: f.phone })
      setSearch(f.name)
    } else if (!v) setAccount(null)
  }
  const unpaid = !initial.status || initial.status === 'draft' || initial.status === 'sent'

  return (
    <form action={action} className="space-y-6">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="account" value={account ?? ''} />

      <fieldset className="panel space-y-4 border border-line p-5">
        <legend className="px-2 font-display text-lg font-semibold uppercase">Who it’s for</legend>
        <label className="block text-sm">Family account <span className="text-muted">(start typing a name or email — or leave empty for someone without an account)</span>
          <input list="invoice-families" value={search} onChange={(e) => pickFamily(e.target.value)} placeholder="Search families…" className={input} aria-describedby="family-picked" />
          <datalist id="invoice-families">{families.map((f) => <option key={f.id} value={label(f)} />)}</datalist>
        </label>
        <p id="family-picked" className="text-xs text-muted">{account ? <>Linked to {who.name}’s account — it shows on their account page. <button type="button" className="underline" onClick={() => { setAccount(null); setSearch('') }}>Unlink</button></> : 'Not linked to an account.'}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">Name<input name="contactName" required value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} className={input} /></label>
          <label className="block text-sm">Email<input name="contactEmail" type="email" value={who.email} onChange={(e) => setWho({ ...who, email: e.target.value })} className={input} /></label>
          <label className="block text-sm">Mobile<input name="contactPhone" type="tel" value={who.phone} onChange={(e) => setWho({ ...who, phone: e.target.value })} className={input} /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">Player <span className="text-muted">(optional)</span><input name="playerName" defaultValue={initial.playerName} className={input} /></label>
          <label className="block text-sm">Paid to
            <select name="payee" defaultValue={initial.payee} className={input}>
              <option value="academy">Rowville Foundation Academy</option>
              <option value="club">Rowville Eagles Football Club</option>
            </select>
          </label>
          <label className="block text-sm">Due date<input name="dueDate" type="date" defaultValue={initial.dueDate} className={input} /></label>
        </div>
      </fieldset>

      <fieldset className="panel space-y-3 border border-line p-5">
        <legend className="px-2 font-display text-lg font-semibold uppercase">Items</legend>
        <p className="text-xs text-muted">Pick from the price list to fill in the description and price (you can change both), or choose “Something else” and type it.</p>
        <ul className="space-y-3">
          {lines.map((l, i) => (
            <li key={i} className="grid gap-2 border-b border-line pb-3 sm:grid-cols-[14rem_1fr_5rem_7rem_6rem_auto] sm:items-end" aria-label={`Item ${i + 1}`}>
              <label className="block text-xs text-muted">Price list
                <select
                  aria-label={`Item ${i + 1} from the price list`}
                  value={l.src}
                  onChange={(e) => {
                    const it = byKey.get(e.target.value)
                    setLine(i, it ? { src: it.key, desc: it.label, price: String(it.price) } : { src: '' })
                  }}
                  className={input}
                >
                  <option value="">Something else…</option>
                  {catalogue.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.items.map((it) => <option key={it.key} value={it.key}>{it.label} — {money(it.price)}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <input type="hidden" name="src" value={l.src} />
              <label className="block text-xs text-muted">Description<input name="desc" aria-label={`Item ${i + 1} description`} value={l.desc} onChange={(e) => setLine(i, { desc: e.target.value })} placeholder="e.g. 1-on-1 session, Tue 11 Nov" className={input} /></label>
              <label className="block text-xs text-muted">Qty<input name="qty" aria-label={`Item ${i + 1} quantity`} type="number" min={1} step={1} value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} className={input} /></label>
              <label className="block text-xs text-muted">Price each ($)<input name="price" aria-label={`Item ${i + 1} price`} type="number" min={0} step="0.01" inputMode="decimal" value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} className={input} /></label>
              <p className="text-sm sm:pb-2.5 sm:text-right"><span className="sm:hidden text-muted">Line total </span>{money(lineTotal(l))}</p>
              <button type="button" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [blank()]))} className="min-h-10 border border-line px-3 text-xs text-muted hover:text-ink" aria-label={`Remove item ${i + 1}`}>Remove</button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setLines((ls) => [...ls, blank()])} className="min-h-10 border border-line px-4 text-xs font-semibold uppercase tracking-[0.12em]">+ Add item</button>
          <p className="font-display text-2xl font-semibold" aria-live="polite">Total <span data-total>{money(total)}</span></p>
        </div>
        {total > 0 && total < 0.5 && <p className="text-sm text-amber-300">Card payments must be at least $0.50.</p>}
      </fieldset>

      <label className="block text-sm">Note to the family <span className="text-muted">(optional — shown on the invoice and in the email)</span>
        <textarea name="note" rows={3} defaultValue={initial.note} className={input} />
      </label>

      {state.error && <p role="alert" className="border border-red-400/40 p-4 text-sm text-red-200">{state.error}</p>}

      {unpaid && (
        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5">
          <span className="text-sm">Send by</span>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="byEmail" aria-label="Send by email" defaultChecked /> Email</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="bySms" aria-label="Send by text" defaultChecked /> Text</label>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <button name="do" value="save" disabled={pending} className="min-h-10 border border-line px-4 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-60">{initial.id ? 'Save changes' : 'Save as draft'}</button>
            <button name="do" value="send" disabled={pending} className="min-h-10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black disabled:opacity-60">{initial.status === 'sent' ? 'Save & send again' : initial.id ? 'Save & send' : 'Create & send'}</button>
          </div>
        </div>
      )}
    </form>
  )
}
