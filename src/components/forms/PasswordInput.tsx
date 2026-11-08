'use client'

import { useState, type InputHTMLAttributes } from 'react'
import { Field, inputCls } from './Field'

/** Password box with a Show / Hide button. */
export function PasswordInput({ label, hint, className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: string; hint?: string }) {
  const [show, setShow] = useState(false)
  const box = (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`${className ?? inputCls} pr-16`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-pressed={show}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 px-3 text-xs font-semibold uppercase tracking-wider text-muted hover:text-ink"
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  )
  return label ? <Field label={label} hint={hint}>{box}</Field> : box
}
