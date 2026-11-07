'use client'

import { useActionState, useState } from 'react'
import { reviewAction, type ReviewState } from './actions'

export function ReviewForm({ id, type, scored, claimed, unit, target, rejectLabel = 'Needs another attempt' }: { id: number; type: string; scored: boolean; claimed: number | null; unit: string; target: string; rejectLabel?: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(reviewAction, {})
  const [score, setScore] = useState(claimed != null ? String(claimed) : '')
  const [feedback, setFeedback] = useState('')
  const btn = 'px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] disabled:opacity-50'
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      {type === 'verification' && scored && (
        <label className="block text-sm">
          Score you counted ({unit}) <span className="text-muted">— target {target}</span>
          <input name="score" type="number" step="any" min={0} value={score} onChange={(e) => setScore(e.target.value)} className="mt-1 block w-32 border border-line bg-black/40 px-3 py-2" />
        </label>
      )}
      <label className="block text-sm">
        {type === 'feedback' ? 'Your feedback' : 'Feedback for the player'} <span className="text-muted">{type === 'feedback' ? '' : '(needed if asking for another attempt)'}</span>
        <textarea name="feedback" rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} className="mt-1 block w-full border border-line bg-black/40 px-3 py-2" placeholder="What went well, and one thing to work on" />
      </label>
      <div className="flex flex-wrap gap-2">
        {type === 'feedback' ? (
          <button name="decision" value="feedback" disabled={pending} className={`${btn} bg-white text-black`}>Send feedback</button>
        ) : (
          <>
            <button name="decision" value="verify" disabled={pending} className={`${btn} bg-emerald-400 text-black`}>✓ Verify</button>
            <button name="decision" value="reject" disabled={pending} className={`${btn} border border-line`}>{rejectLabel}</button>
          </>
        )}
      </div>
      {state.error && <p role="alert" className="text-sm text-red-300">{state.error}</p>}
    </form>
  )
}
