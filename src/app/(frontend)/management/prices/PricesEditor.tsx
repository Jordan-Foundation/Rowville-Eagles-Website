'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { savePrices, type PricesState } from '@/components/admin/prices-actions'
import type { PriceSection } from '@/components/admin/prices-data'

/** Every price in one form; only the changed values are saved (through the same allow-list as before). */
export function PricesEditor({ sections }: { sections: PriceSection[] }) {
  const [state, action, pending] = useActionState<PricesState, FormData>(savePrices, {})
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const confirmed = useRef(false)
  const [changes, setChanges] = useState<{ key: string; label: string; from: string; to: string }[]>([])
  const [review, setReview] = useState(false)
  const labels = useMemo(() => Object.fromEntries(sections.flatMap((s) => s.rows.flatMap((r) => r.fields.map((f) => [f.key, `${r.title} — ${f.label}`])))), [sections])
  // What's different from the saved prices right now
  const scan = () => {
    const form = formRef.current
    if (!form) return
    const fd = new FormData(form)
    const out: typeof changes = []
    for (const [k, v] of fd.entries()) {
      if (k.startsWith('$')) continue
      const orig = String(fd.get(`$orig:${k}`) ?? '')
      if (String(v).trim() !== orig) out.push({ key: k, label: labels[k] ?? k, from: orig || '—', to: String(v).trim() || '—' })
    }
    setChanges(out)
  }
  useEffect(() => {
    if (state.saved) {
      router.refresh()
      setChanges([])
      setReview(false)
    }
  }, [state, router])
  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!changes.length) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [changes.length])
  const bar = (
    <div className="flex flex-wrap items-center gap-4">
      <button disabled={pending || !changes.length} className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">{pending ? 'Saving…' : changes.length ? `Review ${changes.length} change${changes.length === 1 ? '' : 's'}` : 'No changes'}</button>
      {changes.length > 0 && !pending && <span className="text-sm font-semibold text-amber-300">Unsaved changes</span>}
      {(state.done || state.error) && <span role={state.error ? 'alert' : 'status'} className={`text-sm ${state.error ? 'text-red-300' : 'text-emerald-300'}`}>{state.error ?? state.done}</span>}
    </div>
  )
  return (
    <form
      ref={formRef}
      action={action}
      onInput={scan}
      onSubmit={(e) => {
        // First press: show what will change; "Save these changes" then saves
        if (!confirmed.current) {
          e.preventDefault()
          scan()
          setReview(true)
          return
        }
        confirmed.current = false
      }}
      className="mt-6"
    >
      {review && changes.length > 0 && (
        <div role="dialog" aria-modal="true" aria-label="Check your changes" className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-lg border border-line bg-surface p-6">
            <h2 className="font-display text-2xl font-semibold uppercase">Check your changes</h2>
            <p className="mt-1 text-sm text-muted">New prices apply to new bookings only.</p>
            <ul className="mt-4 max-h-[50vh] divide-y divide-line overflow-y-auto text-sm">
              {changes.map((c) => <li key={c.key} className="py-2"><span className="text-muted">{c.label}:</span> {c.from} → <strong>{c.to}</strong></li>)}
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => { confirmed.current = true; setReview(false); formRef.current?.requestSubmit() }} className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white">Save these changes</button>
              <button type="button" onClick={() => setReview(false)} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold">Keep editing</button>
            </div>
          </div>
        </div>
      )}
      <div className="sticky top-14 z-10 -mx-4 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:top-0">{bar}</div>
      <nav aria-label="Sections" className="mt-4 flex flex-wrap gap-2 text-sm">
        {sections.map((s, i) => <a key={s.title} href={`#prices-${i}`} className="rounded-full border border-line px-3 py-1 hover:border-ink">{s.title}</a>)}
      </nav>
      {sections.map((s, si) => (
        <section key={s.title} id={`prices-${si}`} className="mt-10 scroll-mt-36">
          <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">{s.title}</h2>
          <p className="mt-1 text-sm text-muted">{s.intro}</p>
          <div className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {s.rows.length === 0 && <p className="px-5 py-4 text-sm text-muted">Nothing here yet.</p>}
            {s.rows.map((r, i) => (
              <div key={r.href + i} className={`grid gap-3 px-5 py-4 lg:grid-cols-[minmax(12rem,1fr)_auto] lg:items-end ${r.muted ? 'opacity-60' : ''}`}>
                <div>
                  <a href={r.href} className="font-semibold hover:underline">{r.title}</a>
                  {r.note && <p className="text-xs text-muted">{r.note}</p>}
                </div>
                <div className="flex flex-wrap gap-3">
                  {r.fields.map((f) => (
                    <label key={f.key} className="text-xs text-muted">
                      {f.label}
                      <span className="mt-1 flex items-center gap-1 text-sm text-ink">
                        {f.unit === 'aud' && '$'}
                        <input name={f.key} defaultValue={f.value ?? ''} placeholder={f.placeholder} inputMode="decimal" aria-label={`${r.title} — ${f.label}`} className="w-24 rounded-lg border border-line px-3 py-2" />
                        {f.unit === 'days' && 'days'}
                        {f.unit === 'pct' && '%'}
                        <input type="hidden" name={`$orig:${f.key}`} value={f.value ?? ''} />
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <div className="mt-8">{bar}</div>
    </form>
  )
}
