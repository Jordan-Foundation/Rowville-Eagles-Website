'use client'

import { useState } from 'react'
import { Input } from './Field'

/** Working With Children Check: card number, expiry and a photo of the card (camera on phones). */
export function WwccFields({ number, expiry, hasPhoto }: { number?: string | null; expiry?: string | null; hasPhoto?: boolean }) {
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <fieldset className="space-y-4 rounded-2xl border border-line p-5 [[data-brand=academy]_&]:rounded-none">
      <legend className="px-1 text-sm font-semibold">Working With Children Check</legend>
      <p className="text-sm text-muted">Every coach needs a current WWCC (Employee or Volunteer). Management checks it with Service Victoria before families can book you.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Card number" name="wwccNumber" required placeholder="1234567A-01" defaultValue={number ?? ''} autoComplete="off" />
        <Input label="Expiry date" name="wwccExpiry" type="date" required defaultValue={expiry ?? ''} />
      </div>
      <label className="block text-sm font-semibold">
        Photo of your card <span className="text-red-600">*</span>
        <span className="mt-1 block text-xs font-normal text-muted">The front of the card, with your name, number and expiry readable.{hasPhoto ? ' Adding a new photo replaces the one we have.' : ''}</span>
        <input type="file" name="wwccPhoto" accept="image/*,application/pdf" capture="environment" required={!hasPhoto} onChange={(e) => setPicked(e.target.files?.[0]?.name ?? null)} className="mt-2 block w-full text-sm" data-wwcc-photo />
      </label>
      {picked && <p role="status" className="text-xs text-muted">Card photo added: {picked}</p>}
    </fieldset>
  )
}
