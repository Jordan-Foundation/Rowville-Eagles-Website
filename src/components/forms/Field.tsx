import type { InputHTMLAttributes, ReactNode } from 'react'

export const inputCls =
  'w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-muted/70 outline-none transition focus:border-ink'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Input({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <input className={inputCls} {...props} />
    </Field>
  )
}

export function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-line bg-surface-2 p-6">
      <legend className="px-2 font-display text-lg font-semibold uppercase tracking-wide">{legend}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}
