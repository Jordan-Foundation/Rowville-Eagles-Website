'use client'

import { useEffect, useState } from 'react'
import { inputCls } from './Field'

/** "Have a referral code?" — filled in automatically when the family came from a referral link. */
export function ReferralCodeField({ defaultValue }: { defaultValue?: string }) {
  const [code, setCode] = useState(defaultValue ?? '')
  const [open, setOpen] = useState(Boolean(defaultValue))
  useEffect(() => {
    if (code) return
    const m = document.cookie.match(/(?:^|;\s*)rfa_ref=([^;]+)/)
    const fromLink = m ? decodeURIComponent(m[1]).split('.')[0] : ''
    if (fromLink) { setCode(fromLink); setOpen(true) }
  }, [code])
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold underline">Have a referral code?</button>
  }
  return (
    <label className="block max-w-xs">
      <span className="mb-1.5 block text-sm font-medium">Referral code <span className="font-normal text-muted">(optional)</span></span>
      <input name="referralCode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. TOM-7K3Q" autoComplete="off" className={inputCls} />
    </label>
  )
}
