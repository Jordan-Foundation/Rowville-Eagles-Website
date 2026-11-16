'use client'

import { useActionState } from 'react'
import { sendTestText, type TestState } from './sms-actions'

export function SmsTest() {
  const [state, action, pending] = useActionState<TestState>(sendTestText, {})
  return (
    <form action={action} className="space-y-2">
      <button disabled={pending} className="border border-line px-4 py-2 text-sm font-semibold disabled:opacity-60">{pending ? 'Sending…' : 'Send a test text'}</button>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.results && (
        <ul role="status" className="space-y-1 text-sm">
          {state.results.map((r) => <li key={r.to}>{r.ok ? '✅' : '❌'} {r.to.replace(/^\+61/, '0')}: {r.detail}</li>)}
        </ul>
      )}
      <p className="text-xs text-muted">“Accepted by Twilio” but nothing arrives? Check the message in the Twilio console (Monitor → Messaging logs) for the carrier’s reason.</p>
    </form>
  )
}
