import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { numberState } from '@/numbers/service'
import { numbersIn } from '@/numbers/rules'
import { NumberPicker } from './NumberPicker'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Pick your number', robots: { index: false } }

/** After an RFA term or Eagles registration: pick a shirt number from the player's year-of-birth range. */
export default async function PickNumberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await currentUser()
  if (!user) redirect(`/login?next=/account/players/${id}/number`)
  const p = await payload()
  const kid = await p.findByID({ collection: 'participants', id: Number(id), depth: 0, overrideAccess: true, disableErrors: true })
  if (!kid || (typeof kid.account === 'object' ? kid.account?.id : kid.account) !== user.id) notFound()
  const s = await numberState(p, kid)
  let body: React.ReactNode
  if (s.kind === 'has') body = <div className="text-center" data-number-has><p className="text-sm uppercase tracking-[0.2em] text-muted">{kid.firstName}’s number</p><p className="mt-2 font-[family-name:var(--font-barlow)] text-8xl font-extrabold">{s.number}</p><p className="mt-3 text-muted">It’s theirs for the Academy and Rowville Eagles.</p></div>
  else if (s.kind === 'no-dob') body = <p className="text-muted">We need {kid.firstName}’s date of birth before a number can be picked. Please contact the club.</p>
  else if (s.kind === 'senior') body = <p className="text-muted">Senior players don’t pick a number here — your team manager sorts out senior numbers.</p>
  else if (s.kind !== 'pick') body = <p className="text-muted">Numbers aren’t set up for this age group yet — the club will be in touch.</p>
  else if (!s.free.length && !s.held) body = <p className="text-muted" data-number-full>All numbers are taken for {kid.firstName}’s age group — the club will contact you.</p>
  else body = (
    <>
      <p className="text-muted">Born {s.birthYear} · numbers {s.range.start}–{s.range.end}. Tap a number, then confirm. Once confirmed it’s {kid.firstName}’s for both the Academy and Rowville Eagles.</p>
      <div className="mt-6"><NumberPicker kidId={kid.id} name={kid.firstName} numbers={numbersIn(s.range)} taken={s.taken} initial={s.held?.number ?? null} previous={s.previous} /></div>
    </>
  )
  return (
    <div className="container-x max-w-3xl py-14">
      <Link href="/account" className="text-sm text-muted hover:text-ink">← My account</Link>
      <h1 className="mt-4 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Pick {kid.firstName}’s number</h1>
      <div className="mt-6">{body}</div>
    </div>
  )
}
