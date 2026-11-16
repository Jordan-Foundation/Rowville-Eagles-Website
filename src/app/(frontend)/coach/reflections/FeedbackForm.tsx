'use client'

import { useActionState } from 'react'
import { feedbackAction, type FeedbackState } from './actions'

export function FeedbackForm({ reflectionId, seen }: { reflectionId: number; seen: boolean }) {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(feedbackAction, {})
  return (
    <form action={action} className="mt-4 space-y-2" aria-label="Coach feedback">
      <input type="hidden" name="reflection" value={reflectionId} />
      <label className="block text-sm font-medium">Comment for the player (optional — the family sees it)
        <textarea name="comment" rows={2} maxLength={500} className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink" placeholder="e.g. Loved your scanning on Saturday — keep it up!" />
      </label>
      <button disabled={pending} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60">{pending ? 'Saving…' : seen ? 'Add comment' : '👍 Seen'}</button>
      {state.ok && <span role="status" className="ml-3 text-sm">Saved</span>}
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    </form>
  )
}
