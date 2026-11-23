'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { continueAction } from './actions'

/** Sends in chunks (texts go about one a second) until everyone has been sent to. Leave the page open. */
export function KeepSending() {
  const router = useRouter()
  const [state, setState] = useState<{ sent: number; left: number | null; error?: string }>({ sent: 0, left: null })
  useEffect(() => {
    let stop = false
    ;(async () => {
      let total = 0
      for (let i = 0; i < 200 && !stop; i++) {
        const r = await continueAction().catch(() => ({ sent: 0, left: 1, error: 'Lost connection — reload to carry on.' }))
        total += r.sent
        setState({ sent: total, left: r.left, error: r.error })
        if (r.error || r.left === 0) break
      }
      if (!stop) router.refresh()
    })()
    return () => { stop = true }
  }, [router])
  return (
    <p role="status" className="border border-amber-400/60 p-4 text-sm" data-sending>
      {state.left === 0 ? `Done — sent to ${state.sent} parent${state.sent === 1 ? '' : 's'}.` : `Sending… ${state.sent} sent${state.left ? `, ${state.left} to go` : ''}. Keep this page open (the hourly job carries on if you close it).`}
      {state.error && <span className="block text-red-300">{state.error}</span>}
    </p>
  )
}
