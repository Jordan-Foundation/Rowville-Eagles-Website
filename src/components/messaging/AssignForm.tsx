'use client'

import { useActionState } from 'react'
import { assignAction, type AssignState } from '@/messaging/management-actions'

export function AssignForm({ conversation }: { conversation: number }) {
  const [state, action, pending] = useActionState<AssignState, FormData>(assignAction, {})
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="conversation" value={conversation} />
      <label className="text-sm">Link to a family account (email)<input name="email" type="email" required className="mt-1 block w-72 border border-line bg-transparent px-3 py-2 text-sm" /></label>
      <button disabled={pending} className="border border-line px-4 py-2 text-sm font-semibold">Link</button>
      {state.error && <p role="alert" className="w-full text-sm text-red-500">{state.error}</p>}
    </form>
  )
}
