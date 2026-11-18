'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { previewImport, runImport, type ImportState } from './actions'
import type { ImportRow } from '@/selections/import'

const btn = 'min-h-11 bg-white px-5 text-xs font-semibold uppercase tracking-[0.12em] text-black disabled:opacity-60'
const status = (r: ImportRow) => (r.problem ? { text: r.problem, tone: 'text-red-300' } : r.duplicate ? { text: r.existingId ? `${r.duplicate} — marked as trialled if you choose “Yes”` : r.duplicate, tone: 'text-muted' } : { text: 'Will import', tone: 'text-emerald-300' })

export function ImportForm() {
  const [preview, doPreview, previewing] = useActionState<ImportState, FormData>(previewImport, {})
  const [result, doImport, importing] = useActionState<ImportState, FormData>(runImport, {})
  if (result.done) {
    return (
      <div role="status" className="panel space-y-3 border border-line p-5" data-import-done>
        <p className="text-lg font-semibold">Imported {result.done.created} player{result.done.created === 1 ? '' : 's'}{result.done.updated ? ` · ${result.done.updated} already on the site marked as trialled` : ''}{result.done.skipped ? ` · ${result.done.skipped} skipped (duplicates or missing details)` : ''}.</p>
        {result.done.trialled ? (
          <p className="text-sm text-muted">Nobody has been messaged. They’re on the selection board as <strong>Attended trial</strong> and won’t get trial-date messages. Mark them successful there (put them in a squad first) — offers only go when you press <strong>Review &amp; send</strong>.</p>
        ) : (
          <p className="text-sm text-muted">Nobody has been messaged. When their age group has trial nights, they’ll appear on Send trial dates for you to check and send.</p>
        )}
        <p className="flex flex-wrap gap-4 text-sm">{result.done.trialled ? <Link href="/management/selections?kind=rowville" className="underline">Eagles selections →</Link> : <Link href="/management/selections/trial-invites" className="underline">Send trial dates →</Link>}<Link href="/management/audience?source=import" className="underline">See them in Audience →</Link></p>
      </div>
    )
  }
  const rows = preview.rows ?? []
  const ok = rows.filter((r) => !r.problem && !r.duplicate)
  return (
    <div className="space-y-6">
      <form action={doPreview} className="panel flex flex-wrap items-end gap-3 border border-line p-5" aria-label="Choose file">
        <label className="grid gap-1 text-sm">Exported form responses (.xlsx or .csv)<input type="file" name="file" accept=".xlsx,.csv" required className="text-sm" /></label>
        <button disabled={previewing} className={btn}>{previewing ? 'Reading…' : 'Preview'}</button>
        {preview.error && <p role="alert" className="basis-full text-sm text-red-300">{preview.error}</p>}
      </form>
      {rows.length > 0 && (
        <form action={doImport} className="space-y-4" aria-label="Import EOIs">
          <input type="hidden" name="rows" value={JSON.stringify(rows)} />
          <input type="hidden" name="wording" value={preview.wording ?? ''} />
          <fieldset className="panel space-y-2 border border-line p-4 text-sm" data-trialled>
            <legend className="px-1 font-semibold">Have these players already trialled?</legend>
            <label className="flex items-start gap-2"><input type="radio" name="trialled" value="no" defaultChecked className="mt-1" /> <span>No — they’re waiting for trial dates (they’ll appear on Send trial dates)</span></label>
            <label className="flex items-start gap-2"><input type="radio" name="trialled" value="yes" className="mt-1" /> <span>Yes — they’ve trialled. Add them to this season’s Eagles selections as <strong>Attended trial</strong> (no trial-date messages). Anyone already here waiting for a trial is updated too.</span></label>
          </fieldset>
          <p className="text-sm" data-import-summary>{preview.fileName}: {rows.length} rows · <strong>{ok.length} to import</strong> · {rows.filter((r) => r.duplicate).length} duplicates · {rows.filter((r) => r.problem).length} with problems · {ok.filter((r) => r.marketing).length} agreed to news &amp; offers</p>
          <div className="overflow-x-auto border border-line">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-muted"><tr>{['Line', 'Player', 'Born', 'Parent', 'Email / mobile', 'News & offers', ''].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const s = status(r)
                  return (
                    <tr key={r.line} data-row={r.line}>
                      <td className="px-3 py-2 text-muted">{r.line}</td>
                      <td className="px-3 py-2">{r.playerFirst} {r.playerLast}{r.notes ? <span className="block text-xs text-muted">{r.notes.replace(/ · Brought across.*$/, '')}</span> : null}</td>
                      <td className="px-3 py-2">{r.dob}</td>
                      <td className="px-3 py-2">{r.parentFirst} {r.parentLast}</td>
                      <td className="px-3 py-2">{r.email}<span className="block text-xs text-muted">{r.phone}</span></td>
                      <td className="px-3 py-2">{r.marketing ? 'Yes' : 'No'}</td>
                      <td className={`px-3 py-2 text-xs font-semibold ${s.tone}`}>{s.text}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {result.error && <p role="alert" className="text-sm text-red-300">{result.error}</p>}
          <button disabled={importing || !ok.length} className={btn}>{importing ? 'Importing…' : `Import ${ok.length} EOI${ok.length === 1 ? '' : 's'}`}</button>
          <p className="text-xs text-muted">Nothing is sent when you import.</p>
        </form>
      )}
    </div>
  )
}
