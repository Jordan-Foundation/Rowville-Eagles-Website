'use client'

import { useActionState } from 'react'
import { saveWording, type WordingState } from './actions'

export function WordingForm({ level, strand, standard, descriptors }: { level: string; strand: string; standard: string; descriptors: { code: string; text: string }[] }) {
  const [state, action, pending] = useActionState<WordingState, FormData>(saveWording, {})
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer font-semibold underline">Edit wording</summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="level" value={level} />
        <input type="hidden" name="strand" value={strand} />
        <label className="block">Achievement standard
          <textarea name="standard" rows={3} defaultValue={standard} className="mt-1 block w-full border border-line bg-black/40 px-3 py-2" />
        </label>
        <label className="block">Content descriptors — one per line: code, then the wording
          <textarea name="descriptors" rows={Math.max(4, descriptors.length + 1)} defaultValue={descriptors.map((d) => `${d.code} ${d.text}`).join('\n')} className="mt-1 block w-full border border-line bg-black/40 px-3 py-2 font-mono text-xs" />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={pending} className="min-h-10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black disabled:opacity-60">{pending ? 'Saving…' : 'Save wording'}</button>
          {state.saved && <span role="status" className="text-emerald-300">{state.saved}</span>}
          {state.error && <span role="alert" className="text-red-300">{state.error}</span>}
        </div>
      </form>
    </details>
  )
}
