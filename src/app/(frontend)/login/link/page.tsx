import Link from 'next/link'
import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { loginLinkUser } from '@/lib/login-link'
import { loginWithLink } from '../link-actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Log in', robots: { index: false }, referrer: 'no-referrer' }

const mask = (email: string) => email.replace(/^(.)(.*)(@.*)$/, (_, a: string, b: string, c: string) => `${a}${'•'.repeat(Math.min(6, b.length))}${c}`)

/** Landing page for an emailed login link. Logging in needs a tap, so link-checking email scanners can't use it up. */
export default async function LoginLinkPage({ searchParams }: { searchParams: Promise<{ token?: string; next?: string; expired?: string }> }) {
  const { token = '', next = '', expired } = await searchParams
  const user = expired ? null : await loginLinkUser(await payload(), token)
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-line p-8 text-center sm:p-10">
        {user ? (
          <>
            <h1 className="font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase">Log in</h1>
            <p className="mt-2 text-sm text-muted">as {mask(user.email)}</p>
            <form action={loginWithLink} className="mt-8">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="next" value={next} />
              <button type="submit" className="w-full rounded-full bg-brand px-6 py-3.5 font-semibold text-white hover:brightness-110">Log me in</button>
            </form>
          </>
        ) : (
          <>
            <h1 className="font-[family-name:var(--font-barlow)] text-3xl font-extrabold uppercase">This link has expired</h1>
            <p className="mt-3 text-sm text-muted">Login links work once and last 20 minutes.</p>
            <Link href="/login/email" className="mt-6 inline-block rounded-full bg-brand px-6 py-3 font-semibold text-white">Send me a new link</Link>
          </>
        )}
      </div>
    </div>
  )
}
