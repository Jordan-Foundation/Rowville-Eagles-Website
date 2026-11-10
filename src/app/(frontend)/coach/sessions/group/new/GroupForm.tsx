'use client'

import { useActionState, useState } from 'react'
import { createGroupAction, searchGroupPlayers, type FoundPlayer, type GroupFormState } from '../actions'
import { GROUP_MAX, GROUP_MIN, groupQuote, type GroupSettings } from '@/academy/group-pricing'

const field = 'mt-1 block w-full border border-line bg-black/40 px-3 py-2.5 text-sm'
const btn = 'border border-line px-3 py-2 text-xs font-semibold uppercase tracking-wider'
const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`

type Casual = { value: string; label: string; group: string; when: string }
type Weekly = { value: string; label: string; sessions: number; when: string }
type NewP = { playerFirstName: string; playerLastName: string; parentFirstName: string; parentLastName: string; email: string; mobile: string }
type Row = { key: number; mode: 'find' | 'new'; found?: FoundPlayer; fresh: NewP }

const emptyNew: NewP = { playerFirstName: '', playerLastName: '', parentFirstName: '', parentLastName: '', email: '', mobile: '' }
let nextKey = 1
const newRow = (): Row => ({ key: nextKey++, mode: 'find', fresh: { ...emptyNew } })

export function GroupForm({ casual, weekly, settings, holidays = false }: { casual: Casual[]; weekly: Weekly[]; settings: GroupSettings; holidays?: boolean }) {
  const [state, action, pending] = useActionState<GroupFormState, FormData>(createGroupAction, {})
  const [type, setType] = useState<'casual' | 'term'>(casual.length || !weekly.length ? 'casual' : 'term')
  const [slot, setSlot] = useState('')
  const [rows, setRows] = useState<Row[]>(() => [newRow(), newRow()])
  const [message, setMessage] = useState('')
  const [step, setStep] = useState<'setup' | 'review'>('setup')
  const [problem, setProblem] = useState('')
  const groups = [...new Set(casual.map((c) => c.group))]

  const chosen = type === 'casual' ? casual.find((c) => c.value === slot) : weekly.find((w) => w.value === slot)
  const sessions = type === 'casual' ? 1 : ((chosen as Weekly | undefined)?.sessions ?? 0)
  const size = rows.length
  const quote = size >= GROUP_MIN && size <= GROUP_MAX && sessions ? groupQuote(settings, size, type, sessions) : null

  const payload = rows.map((r) => (r.mode === 'find' ? (r.found ? { kind: 'existing', participantId: r.found.id } : null) : { kind: 'new', ...r.fresh }))
  const names = rows.map((r) => (r.mode === 'find' ? r.found?.name : `${r.fresh.playerFirstName} ${r.fresh.playerLastName}`.trim()) || '—')

  const toReview = () => {
    if (!chosen) return setProblem('Choose a time.')
    const i = rows.findIndex((r) => (r.mode === 'find' ? !r.found : !(r.fresh.playerFirstName && r.fresh.playerLastName && r.fresh.parentFirstName && r.fresh.parentLastName && r.fresh.email)))
    if (i >= 0) return setProblem(`Player ${i + 1}: ${rows[i].mode === 'find' ? 'choose a player, or enter a new one.' : 'fill in the player and parent details.'}`)
    setProblem('')
    setStep('review')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const update = (key: number, fn: (r: Row) => Row) => setRows((rs) => rs.map((r) => (r.key === key ? fn(r) : r)))

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="slot" value={slot} />
      <input type="hidden" name="players" value={JSON.stringify(payload)} />
      <input type="hidden" name="message" value={message} />

      {step === 'setup' && (
        <>
          <section className="space-y-4">
            <h2 className="font-display text-2xl font-semibold uppercase">1. When</h2>
            <div className="flex flex-wrap gap-2 text-sm" role="radiogroup" aria-label="Casual or term">
              {(holidays ? (['casual'] as const) : (['casual', 'term'] as const)).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={type === m} onClick={() => { setType(m); setSlot('') }} className={`border px-3 py-1.5 ${type === m ? 'border-white bg-white text-black' : 'border-line'}`}>
                  {m === 'casual' ? `One-off session (${casual.length} open)` : `Whole term, weekly (${weekly.length} open)`}
                </button>
              ))}
            </div>
            <label className="block text-sm">
              Time
              <select value={slot} onChange={(e) => setSlot(e.target.value)} aria-label="Time" className={field}>
                <option value="">Choose one of your open times…</option>
                {type === 'casual'
                  ? groups.map((g) => (
                      <optgroup key={g} label={g}>
                        {casual.filter((c) => c.group === g).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </optgroup>
                    ))
                  : weekly.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </label>
            <p className="text-xs text-muted">Only your own open times are listed — anything already booked (1-on-1 or group) is left out.</p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-2xl font-semibold uppercase">2. Players ({size})</h2>
            <ol className="space-y-4">
              {rows.map((r, i) => (
                <li key={r.key} className="panel border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">Player {i + 1}</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => update(r.key, (x) => ({ ...x, mode: x.mode === 'find' ? 'new' : 'find' }))} className={btn}>{r.mode === 'find' ? 'New player instead' : 'Find a player instead'}</button>
                      {rows.length > GROUP_MIN && <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className={`${btn} text-red-200`} aria-label={`Remove player ${i + 1}`}>Remove</button>}
                    </div>
                  </div>
                  {r.mode === 'find' ? <FindPlayer found={r.found} index={i} onPick={(found) => update(r.key, (x) => ({ ...x, found }))} taken={rows.flatMap((x) => (x.key !== r.key && x.mode === 'find' && x.found ? [x.found.id] : []))} /> : (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {([['playerFirstName', 'Player first name'], ['playerLastName', 'Player last name'], ['parentFirstName', 'Parent first name'], ['parentLastName', 'Parent last name'], ['email', 'Parent email'], ['mobile', 'Parent mobile (to text the link)']] as const).map(([k, label]) => (
                        <label key={k} className="block text-sm">
                          {label}
                          <input
                            value={r.fresh[k]}
                            onChange={(e) => update(r.key, (x) => ({ ...x, fresh: { ...x.fresh, [k]: e.target.value } }))}
                            type={k === 'email' ? 'email' : k === 'mobile' ? 'tel' : 'text'}
                            placeholder={k === 'mobile' ? '0412 345 678' : undefined}
                            aria-label={`Player ${i + 1} — ${label}`}
                            className={field}
                          />
                        </label>
                      ))}
                      <p className="text-xs text-muted sm:col-span-2">They pay as a guest — an account is made for them when they pay.</p>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            {rows.length < GROUP_MAX && <button type="button" onClick={() => setRows((rs) => [...rs, newRow()])} className={btn}>+ Add a player</button>}
          </section>

          <label className="block text-sm">
            Message to families <span className="text-muted">(optional — in the email)</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={500} className={field} placeholder="Great to see the three of them working together — here’s the group we talked about." />
          </label>

          <div>
            <button type="button" onClick={toReview} className="bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-black">Review</button>
            {problem && <p role="alert" className="mt-3 text-sm text-red-300">{problem}</p>}
          </div>
        </>
      )}

      {step === 'review' && chosen && quote && (
        <section aria-label="Review" className="space-y-5">
          <h2 className="font-display text-2xl font-semibold uppercase">Check and send</h2>
          <dl className="panel grid gap-x-8 gap-y-3 border border-line p-5 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">When</dt><dd className="font-semibold">{chosen.when}</dd></div>
            <div><dt className="text-muted">Group size</dt><dd className="font-semibold">{size} players</dd></div>
            <div><dt className="text-muted">Price per player</dt><dd className="font-semibold">{money(quote.rate)} a session{type === 'term' ? ` (term rate, ${settings.termDiscountPct}% off)` : ''}</dd></div>
            <div><dt className="text-muted">Sessions</dt><dd className="font-semibold">{sessions}</dd></div>
            <div><dt className="text-muted">Each family pays</dt><dd className="font-semibold">{money(quote.perPlayer)}</dd></div>
            <div><dt className="text-muted">Total for the group</dt><dd className="font-semibold">{money(quote.total)} <span className="font-normal text-muted">({size} × {money(quote.rate)} = {money(quote.perSession)} a session)</span></dd></div>
          </dl>
          <div>
            <p className="text-sm text-muted">Each family gets their own link by email{rows.some((r) => (r.mode === 'find' ? r.found?.mobile : r.fresh.mobile)) ? ' and text' : ''}, and sees only the other players’ first names. The time is held for you until the payment deadline ({settings.inviteDeadlineHours} hours, or earlier if the session is sooner).</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">{names.map((n, i) => <li key={i}>{n}</li>)}</ol>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setStep('setup')} className={btn}>← Change</button>
            <button disabled={pending} className="bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-black disabled:opacity-50">{pending ? 'Sending…' : `Send to ${size} families`}</button>
          </div>
          {state.error && <p role="alert" className="text-sm text-red-300">{state.error}</p>}
        </section>
      )}
    </form>
  )
}

export function FindPlayer({ found, index, onPick, taken, label }: { found?: FoundPlayer; index: number; onPick: (p: FoundPlayer | undefined) => void; taken: number[]; label?: string }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<FoundPlayer[] | null>(null)
  const [busy, setBusy] = useState(false)
  if (found) {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p><span className="font-semibold">{found.name}</span>{found.parent && <span className="text-muted"> · parent {found.parent}</span>}</p>
        <button type="button" onClick={() => onPick(undefined)} className={btn}>Change</button>
      </div>
    )
  }
  const search = async () => { setBusy(true); try { setResults(await searchGroupPlayers(q)) } finally { setBusy(false) } }
  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search() } }}
          placeholder="Search players by name"
          aria-label={label ?? `Player ${index + 1} — search by name`}
          className="min-w-0 flex-1 border border-line bg-black/40 px-3 py-2.5 text-sm"
        />
        <button type="button" onClick={search} disabled={busy || q.trim().length < 2} className={btn}>{busy ? '…' : 'Search'}</button>
      </div>
      {results && (
        <ul className="mt-2 divide-y divide-line border border-line text-sm">
          {results.length === 0 && <li className="p-3 text-muted">No players found — try another name, or add them as a new player.</li>}
          {results.map((r) => {
            const off = !r.canInvite || taken.includes(r.id)
            return (
              <li key={r.id}>
                <button type="button" disabled={off} onClick={() => onPick(r)} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-white/5 disabled:opacity-50">
                  <span><span className="font-semibold">{r.name}</span>{r.birthYear ? <span className="text-muted"> · {r.birthYear}</span> : null}{r.parent && <span className="block text-xs text-muted">Parent: {r.parent}</span>}</span>
                  <span className="text-xs text-muted">{taken.includes(r.id) ? 'Already added' : !r.canInvite ? 'No parent email — add as new' : 'Choose'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
