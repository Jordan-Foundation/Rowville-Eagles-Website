'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Input, PasswordInput } from '@/components/forms/Field'

export function LoginForm() {
  const router = useRouter()
  const next = useSearchParams().get('next') || '/account'
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/users/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
    })
    setPending(false)
    if (!res.ok) return setError('That email and password don’t match. Try again or reset your password.')
    window.dispatchEvent(new Event('refc-auth'))
    router.push(next.startsWith('/') && !next.startsWith('//') ? next : '/account')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      <PasswordInput label="Password" name="password" autoComplete="current-password" required />
      {error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-full bg-brand px-6 py-3.5 font-semibold text-white transition hover:brightness-110 disabled:opacity-60">
        {pending ? 'Logging in…' : 'Log in'}
      </button>
      <p className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-center text-sm">
        <Link href={`/login/email${next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold underline">Email me a login link</Link>
        <Link href="/account/forgot" className="text-muted underline hover:text-ink">Forgot password?</Link>
      </p>
    </form>
  )
}
