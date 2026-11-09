'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RATINGS, RATING_LABEL, type Rating } from '@/academy/curriculum/levels'
import { MAX_COMMENT, MAX_OVERALL, submitProblems, type StrandEntry } from '@/academy/reports/rules'
import { saveReportDraft, submitReportAction } from '../actions'

type Strand = { key: string; name: string; standard: string; descriptors: { code: string; text: string }[] }
type Entry = { strands: StrandEntry[]; overall: string }
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

const AUTOSAVE_MS = 1200
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })

export function ReportForm({ id, editable, strands, initial, savedAt, firstName, nextId }: { nextId?: number | null; id: number; editable: boolean; strands: Strand[]; initial: Entry; savedAt: string | null; firstName: string }) {
  const router = useRouter()
  const [entry, setEntry] = useState<Entry>(() => ({
    overall: initial.overall,
    strands: strands.map((s) => initial.strands.find((x) => x.strand === s.key) ?? { strand: s.key, rating: null, comment: '' }),
  }))
  const [state, setState] = useState<SaveState>('idle')
  const [lastSaved, setLastSaved] = useState(savedAt)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const latest = useRef(entry)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef<Promise<unknown> | null>(null)

  const save = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    const snapshot = latest.current
    setState('saving')
    const run = saveReportDraft(id, snapshot)
    inFlight.current = run
    const res = await run.catch(() => ({ ok: false as const, error: 'Couldn’t reach the website — check your connection. We’ll try again when you next type.' }))
    if (res.ok) {
      setLastSaved(res.savedAt)
      setError('')
      // Changed again while saving → stay "dirty" so the next timer saves it
      setState(latest.current === snapshot ? 'saved' : 'dirty')
    } else {
      setState('error')
      setError(res.error)
    }
  }, [id])

  const update = (next: Entry) => {
    latest.current = next
    setEntry(next)
    setState('dirty')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS)
  }

  // Save straight away when leaving the page or switching apps
  useEffect(() => {
    const flush = () => { if (timer.current) void save() }
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    const warn = (e: BeforeUnloadEvent) => { if (timer.current) { flush(); e.preventDefault() } }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', warn)
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('beforeunload', warn) }
  }, [save])

  const setStrand = (key: string, patch: Partial<StrandEntry>) => update({ ...entry, strands: entry.strands.map((s) => (s.strand === key ? { ...s, ...patch } : s)) })
  const problems = submitProblems(entry)

  async function submit() {
    setShowErrors(true)
    if (problems.length) return
    if (!confirm(`Submit ${firstName}’s report? It locks until Management reviews it.`)) return
    setSubmitting(true)
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    await inFlight.current?.catch(() => null)
    const res = await submitReportAction(id, latest.current)
    setSubmitting(false)
    if (res.ok) router.push(nextId ? `/coach/reports/${nextId}?submitted=1` : '/coach/reports?submitted=1')
    else { setError(res.error); setState('error') }
  }

  const status =
    state === 'saving' ? 'Saving…' : state === 'dirty' ? 'Unsaved changes…' : state === 'error' ? 'Not saved' : lastSaved ? `Saved ${time(lastSaved)}` : editable ? 'Not started' : ''

  return (
    <div className="space-y-6">
      {editable && (
        <p role="status" aria-live="polite" className={`sticky top-2 z-10 ml-auto w-fit border px-3 py-1 text-xs font-semibold ${state === 'error' ? 'border-red-400 bg-red-950 text-red-200' : 'border-line bg-black text-muted'}`}>
          {status}
        </p>
      )}
      {strands.map((s, i) => {
        const e = entry.strands.find((x) => x.strand === s.key)!
        const missing = showErrors && !e.rating
        return (
          <fieldset key={s.key} className={`panel border p-5 ${missing ? 'border-red-400' : 'border-line'}`} disabled={!editable}>
            <legend className="sr-only">{s.name}</legend>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">{i + 1} of {strands.length}</p>
            <h2 className="font-display text-2xl font-semibold uppercase">{s.name}</h2>
            <p className="mt-2 text-sm"><span className="font-semibold">Standard:</span> {s.standard}</p>
            {s.descriptors.length > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-muted">What’s taught at this level ({s.descriptors.length})</summary>
                <ul className="mt-2 space-y-1">
                  {s.descriptors.map((d) => <li key={d.code}><span className="mr-2 font-mono text-xs text-muted">{d.code}</span>{d.text}</li>)}
                </ul>
              </details>
            )}
            <div role="radiogroup" aria-label={`${s.name} rating`} className="mt-4 grid grid-cols-5 gap-1.5">
              {RATINGS.map((r: Rating) => {
                const on = e.rating === r
                return (
                  <label key={r} className={`flex min-h-14 cursor-pointer items-center justify-center border px-1 text-center text-xs font-semibold leading-tight sm:text-sm ${on ? 'border-white bg-white text-black' : 'border-line hover:border-white/60'} ${!editable ? 'cursor-default opacity-80' : ''}`}>
                    <input type="radio" className="sr-only" name={`rating-${s.key}`} value={r} checked={on} onChange={() => setStrand(s.key, { rating: r })} />
                    {RATING_LABEL[r]}
                  </label>
                )
              })}
            </div>
            {missing && <p className="mt-2 text-sm text-red-300">Choose a rating.</p>}
            <label className="mt-4 block text-sm">
              Comment <span className="text-muted">(optional)</span>
              <textarea rows={2} maxLength={MAX_COMMENT} value={e.comment ?? ''} onChange={(ev) => setStrand(s.key, { comment: ev.target.value })} className="mt-1 block w-full border border-line bg-black/40 px-3 py-2" />
            </label>
          </fieldset>
        )
      })}
      <fieldset className={`panel border p-5 ${showErrors && problems.some((x) => x.startsWith('Write')) ? 'border-red-400' : 'border-line'}`} disabled={!editable}>
        <legend className="sr-only">Overall comment</legend>
        <h2 className="font-display text-2xl font-semibold uppercase">Overall comment</h2>
        <p className="mt-1 text-sm text-muted">How {firstName} is going overall, strengths, and the next thing to work on. Families read this.</p>
        <textarea rows={5} maxLength={MAX_OVERALL} value={entry.overall} onChange={(ev) => update({ ...entry, overall: ev.target.value })} aria-label="Overall comment" className="mt-3 block w-full border border-line bg-black/40 px-3 py-2" />
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {editable && (
        <div className="space-y-2">
          {showErrors && problems.length > 0 && <ul role="alert" className="list-disc pl-5 text-sm text-red-300">{problems.map((x) => <li key={x}>{x}</li>)}</ul>}
          <button type="button" onClick={submit} disabled={submitting} className="w-full bg-white px-6 py-4 font-semibold uppercase tracking-wide text-black disabled:opacity-60 sm:w-auto">
            {submitting ? 'Submitting…' : 'Submit report'}
          </button>
          <p className="text-xs text-muted">Not finished? Just leave — your draft is saved.</p>
        </div>
      )}
    </div>
  )
}
