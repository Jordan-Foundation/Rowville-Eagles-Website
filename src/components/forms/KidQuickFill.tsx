'use client'

import type { KidOption } from '@/lib/family-kids'

/**
 * "Fill in for: Ava · Tiny" — one tap fills the player's name, date of birth, medical notes and emergency contact
 * from their profile. `onDob` is called for forms that react to the date of birth (age groups, trial nights).
 */
export function KidQuickFill({ kids, onDob }: { kids: KidOption[]; onDob?: (dob: string) => void }) {
  if (!kids.length) return null
  const fill = (form: HTMLFormElement | null, k: KidOption) => {
    if (!form) return
    const set = (name: string, value: string) => {
      const el = form.elements.namedItem(name)
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        if (el.type === 'checkbox') return
        // Use the native setter so React-controlled inputs notice the change
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }
    set('playerFirstName', k.firstName)
    set('playerLastName', k.lastName)
    set('playerDob', k.dob)
    if (k.medical) set('medical', k.medical)
    if (k.emergencyName) set('emergencyName', k.emergencyName)
    if (k.emergencyPhone) set('emergencyPhone', k.emergencyPhone)
    const photo = form.elements.namedItem('photoConsent')
    if (photo instanceof HTMLInputElement && k.photoConsent) photo.checked = true
    const pid = form.elements.namedItem('participant')
    if (pid instanceof HTMLInputElement) pid.value = String(k.id)
    onDob?.(k.dob)
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm sm:col-span-2">
      <span className="font-semibold">Fill in for:</span>
      {kids.map((k) => (
        <button key={k.id} type="button" onClick={(e) => fill(e.currentTarget.form, k)} className="rounded-full border border-line bg-surface px-4 py-2 hover:border-ink">
          {k.firstName}
        </button>
      ))}
      <input type="hidden" name="participant" defaultValue="" />
    </div>
  )
}
