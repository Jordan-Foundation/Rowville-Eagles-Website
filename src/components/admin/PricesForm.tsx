'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { savePrices, type PricesState } from './prices-actions'
import type { PriceSection } from './prices-data'

const box: React.CSSProperties = { border: '1px solid var(--theme-elevation-150)', borderRadius: 6, marginBottom: 32 }
const input: React.CSSProperties = { width: 90, padding: '6px 8px', border: '1px solid var(--theme-elevation-250)', borderRadius: 4, background: 'var(--theme-input-bg)', color: 'var(--theme-text)', fontSize: 14 }

export function PricesForm({ sections }: { sections: PriceSection[] }) {
  const [state, action, pending] = useActionState<PricesState, FormData>(savePrices, {})
  const router = useRouter()
  useEffect(() => {
    if (state.saved) router.refresh()
  }, [state, router])
  const message = (
    <span role={state.error ? 'alert' : 'status'} style={{ color: state.error ? 'var(--theme-error-500)' : 'var(--theme-success-500)', fontSize: 14 }}>
      {state.error ?? state.done}
    </span>
  )
  return (
    <form action={action}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', gap: 16, alignItems: 'center', padding: '12px 0', background: 'var(--theme-bg)', borderBottom: '1px solid var(--theme-elevation-100)', marginBottom: 24 }}>
        <button type="submit" disabled={pending} className="btn btn--style-primary btn--size-medium" style={{ margin: 0 }}>
          {pending ? 'Saving…' : 'Save all changes'}
        </button>
        {message}
      </div>
      {sections.map((s) => (
        <section key={s.title} style={box}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--theme-elevation-150)' }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{s.title}</h2>
            <p style={{ margin: '6px 0 0', color: 'var(--theme-elevation-600)', fontSize: 13 }}>{s.intro}</p>
          </div>
          {s.rows.length === 0 && <p style={{ padding: '12px 20px', margin: 0, color: 'var(--theme-elevation-500)' }}>Nothing here yet.</p>}
          {s.rows.map((r, i) => (
            <div key={r.href + i} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: i ? '1px solid var(--theme-elevation-100)' : undefined, opacity: r.muted ? 0.55 : 1 }}>
              <div style={{ minWidth: 220 }}>
                <a href={r.href} style={{ fontWeight: 600, textDecoration: 'none', color: 'var(--theme-text)' }}>{r.title}</a>
                {r.note && <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>{r.note}</div>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {r.fields.map((f) => (
                  <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--theme-elevation-600)' }}>
                    {f.label}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--theme-text)' }}>
                      {f.unit === 'aud' && '$'}
                      <input name={f.key} defaultValue={f.value ?? ''} placeholder={f.placeholder} inputMode="decimal" style={input} aria-label={`${r.title} — ${f.label}`} />
                      {f.unit === 'days' && 'days'}
                      <input type="hidden" name={`$orig:${f.key}`} value={f.value ?? ''} />
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <button type="submit" disabled={pending} className="btn btn--style-primary btn--size-medium" style={{ margin: 0 }}>
          {pending ? 'Saving…' : 'Save all changes'}
        </button>
        {message}
      </div>
    </form>
  )
}
