'use client'

import { useState } from 'react'
import { nonGsmChars, smsSegments, toGsm, unknownFields } from '@/launch/render'

const input = 'w-full border border-line bg-surface p-2 text-sm'

/** The launch text with a live character / segment count and a warning for anything that isn't plain GSM-7. */
export function SmsField({ name, initial }: { name: string; initial: string }) {
  const [v, setV] = useState(initial)
  const seg = smsSegments(v)
  const bad = nonGsmChars(v)
  return (
    <div className="space-y-1">
      <textarea name={name} value={v} onChange={(e) => setV(e.target.value)} rows={4} className={input} aria-label="Launch text" />
      <p className="text-xs text-muted" data-sms-count>{seg.length} characters · {seg.segments} segment{seg.segments === 1 ? '' : 's'}{seg.unicode ? ' (Unicode — costs about double)' : ''} · merge fields like the player names and link change the length per family</p>
      {bad.length > 0 && <p role="alert" className="text-xs text-amber-300" data-sms-bad>Not plain text: {bad.map((c) => `“${c}”`).join(' ')} — <button type="button" className="underline" onClick={() => setV(toGsm(v))}>fix it</button></p>}
      {unknownFields(v).length > 0 && <p className="text-xs text-amber-300">Unknown merge fields: {unknownFields(v).map((f) => `{{${f}}}`).join(' ')}</p>}
    </div>
  )
}

export function BodyField({ name, initial, label }: { name: string; initial: string; label: string }) {
  const [v, setV] = useState(initial)
  return (
    <div className="space-y-1">
      <textarea name={name} value={v} onChange={(e) => setV(e.target.value)} rows={18} className={`${input} font-mono text-xs`} aria-label={label} />
      {unknownFields(v).length > 0 && <p className="text-xs text-amber-300">Unknown merge fields: {unknownFields(v).map((f) => `{{${f}}}`).join(' ')}</p>}
    </div>
  )
}
