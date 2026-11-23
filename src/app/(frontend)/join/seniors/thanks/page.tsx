import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Enquiry sent', robots: { index: false } }

export default function SeniorThanksPage() {
  return (
    <div className="container-x max-w-2xl py-20 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent text-2xl text-accent-ink">✓</div>
      <h1 className="mt-6 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Enquiry sent</h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-muted">Thanks — your enquiry has gone to the club secretary, who’ll be in touch soon about training and trials.</p>
      <p className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/events" className="rounded-full border border-line px-6 py-3 font-semibold">Club events</Link>
        <Link href="/" className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink">Back to home</Link>
      </p>
    </div>
  )
}
