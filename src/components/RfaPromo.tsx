import Link from 'next/link'
import { AcademyBackdrop } from './AcademyBackdrop'
import { RfaLogo } from './Logos'

/** Shown after club trial / interest registration. */
export function RfaPromo() {
  return (
    <section data-brand="academy" className="relative overflow-hidden rounded-sm text-left">
      <AcademyBackdrop size="sm" />
      <div className="relative grid gap-6 p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10">
        <div>
          <RfaLogo className="h-10 w-auto" ink="#fff" paper="#000" />
          <h2 className="mt-5 font-display text-3xl font-semibold uppercase tracking-tight">Want to go further?</h2>
          <p className="mt-2 max-w-lg text-muted">
            The Rowville Foundation Academy runs alongside the club season — small groups, specialist coaches and an individual plan for every player.
            Trial places are limited per age group each night.
          </p>
        </div>
        <Link href="/academy/trial" className="bg-white px-7 py-4 text-center text-sm font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-white/85">
          Book an RFA trial
        </Link>
      </div>
    </section>
  )
}
