'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleSetupItem } from './setup-actions'

export function SetupToggle({ itemKey, done }: { itemKey: string; done: boolean }) {
  const [on, setOn] = useState(done)
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer', opacity: pending ? 0.5 : 1 }}>
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.checked
          setOn(v)
          start(async () => {
            await toggleSetupItem(itemKey, v)
            router.refresh()
          })
        }}
      />
      Done
    </label>
  )
}
