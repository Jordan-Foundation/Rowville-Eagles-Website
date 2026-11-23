import Link from 'next/link'
import type { Metadata } from 'next'
import { currentUser } from '@/lib/auth'
import { EnquiryForm } from './EnquiryForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Senior enquiry',
  description: 'Play senior football at Rowville Eagles — Senior Men, Reserves or Senior Women (from 16). Send an enquiry to the club secretary.',
}

/** Seniors & reserves: an enquiry that goes to the club secretary (U16–U18 can choose this or junior trials). */
export default async function SeniorJoinPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const { team } = await searchParams
  const me = await currentUser()
  const prefill = me ? { name: [me.firstName, me.lastName].filter(Boolean).join(' '), email: me.email, phone: me.phone ?? '' } : undefined
  return (
    <>
      <section className="pitch-lines bg-[#0f2a55] text-white">
        <div className="container-x py-16 md:py-20">
          <p className="eyebrow">Seniors & Reserves · Ages 16+</p>
          <h1 className="mt-3 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase leading-none sm:text-7xl">
            Play <span className="text-accent">senior football</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/75">Senior Men, Reserves and Senior Women. Tell us a little about yourself and the club secretary will be in touch about training and trials.</p>
          <p className="mt-3 max-w-xl text-sm text-white/75" data-choice-note>U16 to U18 players can choose: send a senior enquiry here, or <Link href="/join/juniors" className="font-semibold text-white underline">register for junior trials</Link>.</p>
          <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/seniors/senior-men" className="underline opacity-80 hover:opacity-100">Senior Men</Link>
            <Link href="/seniors/reserves" className="underline opacity-80 hover:opacity-100">Reserves</Link>
            <Link href="/seniors/senior-women" className="underline opacity-80 hover:opacity-100">Senior Women</Link>
          </p>
        </div>
      </section>
      <div className="container-x max-w-3xl py-14">
        <p className="mb-3 text-sm"><Link href="/join" className="text-muted underline">← Juniors or seniors</Link></p>
        <h2 className="mb-6 font-[family-name:var(--font-barlow)] text-3xl font-bold uppercase">Senior enquiry</h2>
        <EnquiryForm team={['men', 'reserves', 'women'].includes(team ?? '') ? team : undefined} prefill={prefill} />
      </div>
    </>
  )
}
