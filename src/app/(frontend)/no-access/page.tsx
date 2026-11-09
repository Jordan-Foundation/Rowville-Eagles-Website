import Link from 'next/link'
import type { Metadata } from 'next'
import { currentUser } from '@/lib/auth'
import { homeFor } from '@/lib/home'

export const metadata: Metadata = { title: 'Not available', robots: { index: false } }

const AREAS: Record<string, { title: string; text: string }> = {
  management: { title: 'Management only', text: 'This page is for the club committee and Academy management. If you need something here, ask a committee member.' },
  coach: { title: 'Coaches only', text: 'This page is for Foundation Academy and team coaches. If you’re a coach and can’t get in, ask Management to add the Coach role to your account.' },
}

/** Shown instead of silently bouncing someone who opens a page their account can’t use. */
export default async function NoAccess({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const area = AREAS[(await searchParams).area ?? ''] ?? { title: 'Not available', text: 'Your account can’t open that page.' }
  const user = await currentUser()
  const home = homeFor(user)
  return (
    <div className="container-x grid min-h-[50vh] place-items-center py-16">
      <div className="max-w-md text-center">
        <p className="text-5xl" aria-hidden>🔒</p>
        <h1 className="mt-4 font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase">{area.title}</h1>
        <p className="mt-3 text-muted">{area.text}</p>
        <Link href={home} className="mt-6 inline-block rounded-full bg-brand px-6 py-3 font-semibold text-white">
          {home === '/coach' ? 'Go to the Coach dashboard' : home === '/management' ? 'Go to Management' : user ? 'Go to my account' : 'Log in'}
        </Link>
      </div>
    </div>
  )
}
