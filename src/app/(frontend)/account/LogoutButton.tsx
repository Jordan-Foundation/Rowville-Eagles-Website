'use client'

import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
        window.dispatchEvent(new Event('refc-auth'))
        router.push('/')
        router.refresh()
      }}
      className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-ink"
    >
      Log out
    </button>
  )
}
