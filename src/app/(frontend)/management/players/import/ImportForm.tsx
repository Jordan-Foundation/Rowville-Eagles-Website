'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { importAction, previewAction, type ImportState } from './actions'

const btn = 'min-h-11 bg-white px-5 text-xs font-semibold uppercase tracking-[0.12em] text-black disabled:opacity-60'
const tone = { error: 'text-red-300', warning: 'text-amber-300', ok: 'text-emerald-300' } as const
const label = { error: 'Error — skipped', warning: 'Imports, with a warning', ok: 'OK' } as const

/** Upload → preview (nothing saved) → import valid rows. */
export function ImportForm() {
  const [preview, doPreview, previewing] = useActionState<ImportState, FormData>(previewAction, {})
  const [result, doImport, importing] = useActionState<ImportState, FormData>(importAction, {})
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'ok'>('all')
  if (result.done) {
    const c = result.done.counts as { familiesCreated: number; familiesMatched: number; playersCreated: number; playersUpdated: number; unchanged: number; skipped: number; failed: string[] }
    return (
      <div role="status" className="panel space-y-3 border border-line p-5" data-import-done>
        <p className="text-lg font-semibold">Imported: {c.familiesCreated} new famil{c.familiesCreated === 1 ? 'y' : 'ies'}, {c.familiesMatched} matched · {c.playersCreated} players created, {c.playersUpdated} updated{c.unchanged ? `, ${c.unchanged} unchanged` : ''}{c.skipped ? ` · ${c.skipped} rows skipped (errors)` : ''}.</p>
        {c.failed?.length > 0 && <p role="alert" className="text-sm text-red-300">Couldn’t import these families (nothing was saved for them): {c.failed.join(', ')}</p>}
        <p className="text-sm text-muted">Nobody has been messaged. Send the launch email from <Link href="/management/launch" className="underline">Portal launch</Link> when you’re ready.</p>
        <p className="flex flex-wrap gap-4 text-sm"><Link href="/management/players/import" className="underline">Back to imports</Link><Link href="/management/players/owing" className="underline">Registration owing →</Link></p>
      </div>
    )
  }
  const rows = preview.preview?.rows ?? []
  const t = preview.preview?.totals
  const shown = rows.filter((r) => filter === 'all' || r.status === filter)
  return (
    <div className="space-y-6">
      <form action={doPreview} className="panel flex flex-wrap items-end gap-3 border border-line p-5" aria-label="Choose file">
        <label className="grid gap-1 text-sm">Filled-in template (.xlsx)<input type="file" name="file" accept=".xlsx,.csv" required className="text-sm" /></label>
        <button disabled={previewing} className={btn}>{previewing ? 'Checking…' : 'Preview'}</button>
        {preview.error && <p role="alert" className="basis-full text-sm text-red-300" data-missing={preview.missing?.join('|')}>{preview.error}</p>}
      </form>
      {t && (
        <>
          <dl className="grid gap-3 text-sm sm:grid-cols-4 lg:grid-cols-7" data-totals>
            {([['New families', t.familiesNew, 'families-new'], ['Matched families', t.familiesMatched, 'families-matched'], ['Players to create', t.playersCreate, 'players-create'], ['Players to update', t.playersUpdate, 'players-update'], ['Unchanged', t.playersUnchanged, 'players-unchanged'], ['Rows with errors', t.errors, 'errors'], ['Rows with warnings', t.warnings, 'warnings']] as const).map(([k, v, key]) => (
              <div key={k} className="border border-line p-3" data-total={key} data-value={v}><dt className="text-xs text-muted">{k}</dt><dd className="font-display text-3xl font-semibold">{v}</dd></div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Show">
            {(['all', 'error', 'warning', 'ok'] as const).map((f) => <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} className={`border px-3 py-1.5 ${filter === f ? 'border-white' : 'border-line text-muted'}`}>{f === 'all' ? 'All' : f === 'error' ? 'Errors' : f === 'warning' ? 'Warnings' : 'OK'} ({f === 'all' ? rows.length : rows.filter((r) => r.status === f).length})</button>)}
            {preview.report && <a href={`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${preview.report}`} download={`${(preview.fileName ?? 'players').replace(/\.(xlsx|csv)$/i, '')}-import-result.xlsx`} className="ml-auto underline" data-report>Download error report</a>}
          </div>
          <div className="overflow-x-auto border border-line">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs text-muted"><tr>{['Line', 'Player', 'Born', 'Parent 1', 'Team / RFA', '#', 'Result'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {shown.map((r) => (
                  <tr key={r.line} data-row={r.line} data-status={r.status} className="align-top">
                    <td className="px-3 py-2 text-muted">{r.line}</td>
                    <td className="px-3 py-2">{r.player.first} {r.player.last}<span className="block text-xs text-muted">{r.action === 'update' ? 'Update existing player' : r.action === 'unchanged' ? 'Already in the portal — no changes' : r.action === 'create' ? 'New player' : ''}</span></td>
                    <td className="px-3 py-2">{r.player.dob ?? '—'}</td>
                    <td className="px-3 py-2">{r.parent1.first} {r.parent1.last}<span className="block text-xs text-muted">{r.parent1.email} · {r.family === 'existing' ? 'existing family' : 'new family'}</span></td>
                    <td className="px-3 py-2">{[r.eagles ? r.team || 'Eagles' : null, r.rfa ? 'RFA' : null].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-3 py-2">{r.number ?? ''}</td>
                    <td className={`px-3 py-2 text-xs ${tone[r.status]}`}><strong>{label[r.status]}</strong>{[...r.errors, ...r.warnings].map((m) => <span key={m} className="block">{m}</span>)}{r.info.map((m) => <span key={m} className="block text-muted">{m}</span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={doImport} className="flex flex-wrap items-center gap-3" aria-label="Import">
            <input type="hidden" name="sheet" value={JSON.stringify(preview.sheet ?? [])} />
            <input type="hidden" name="fileName" value={preview.fileName ?? ''} />
            <button disabled={importing || rows.every((r) => r.status === 'error')} className={btn}>{importing ? 'Importing…' : `Import ${rows.filter((r) => r.status !== 'error').length} valid rows`}</button>
            <a href="/management/players/import" className="text-sm underline">Cancel</a>
            <span className="text-xs text-muted">Rows with errors are skipped — fix them and upload again. Nothing is sent to families.</span>
            {result.error && <p role="alert" className="basis-full text-sm text-red-300">{result.error}</p>}
          </form>
        </>
      )}
    </div>
  )
}
