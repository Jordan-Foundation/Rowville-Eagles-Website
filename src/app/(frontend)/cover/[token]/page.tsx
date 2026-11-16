import type { Metadata } from 'next'
import Link from 'next/link'
import { payload } from '@/lib/payload'
import { formatDate } from '@/lib/format'
import { coverState } from '@/academy/cover-requests'
import { coverAnswer } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Session cover', robots: { index: false } }

const btn = 'min-h-12 px-6 text-sm font-semibold uppercase tracking-[0.15em]'

/** A coach's cover link: confirm / decline an assigned session, or pick up one that needs cover. */
export default async function CoverPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string; error?: string }> }) {
  const [{ token }, sp] = await Promise.all([params, searchParams])
  const st = await coverState(await payload(), token)
  return (
    <div data-brand="academy" data-page-brand="academy" className="min-h-[70vh]">
      <div className="container-x max-w-xl py-16">
        <p className="eyebrow">Session cover</p>
        {!st ? (
          <h1 className="mt-2 font-display text-4xl font-bold uppercase">Link not valid</h1>
        ) : (
          <>
            <h1 className="mt-2 font-display text-4xl font-bold uppercase">{st.d.what}</h1>
            <dl className="panel mt-6 space-y-2 border border-line p-5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">When</dt><dd>{formatDate(st.session.startsAt, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Player</dt><dd>{st.d.who}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Coach</dt><dd>{st.coach.displayName}</dd></div>
              {st.session.coverNote && <div><dt className="text-muted">Handover</dt><dd className="mt-1 whitespace-pre-line">{st.session.coverNote}</dd></div>}
            </dl>
            {(sp.done || sp.error) && <p role={sp.error ? 'alert' : 'status'} className={`mt-6 border p-4 text-sm ${sp.error ? 'border-red-400/40 text-red-200' : 'border-emerald-400/40 text-emerald-200'}`}>{sp.error ?? sp.done}</p>}
            <form action={coverAnswer} className="mt-6 flex flex-wrap gap-3">
              <input type="hidden" name="token" value={token} />
              {st.state === 'asked' && (
                <>
                  <button name="answer" value="confirm" className={`${btn} bg-white text-black`}>Confirm — I’ll cover it</button>
                  <button name="answer" value="decline" className={`${btn} border border-line`}>I can’t do it</button>
                </>
              )}
              {st.state === 'open' && <button name="answer" value="take" className={`${btn} bg-white text-black`}>I can take it</button>}
            </form>
            {!sp.done && !sp.error && (
              <p className="mt-6 text-sm text-muted">
                {st.state === 'confirmed' ? 'You’re covering this session — thanks!' : st.state === 'taken' ? 'Another coach has already picked this one up — thanks for offering.' : st.state === 'changed' ? 'The Academy has changed who’s covering this session — no action needed.' : st.state === 'gone' ? 'This session has already happened, been cancelled, or no longer needs cover.' : st.state === 'open' ? 'The first coach who says yes (and is free then) gets it.' : ''}
              </p>
            )}
            <p className="mt-8 text-sm"><Link href="/coach" className="underline">Open the Coach portal</Link></p>
          </>
        )}
      </div>
    </div>
  )
}
