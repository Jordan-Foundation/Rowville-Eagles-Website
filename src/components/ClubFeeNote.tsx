import { cache } from 'react'
import { payload } from '@/lib/payload'
import { clubFeeNote } from '@/academy/terms/pricing'

const note = cache(async () => {
  const s = await (await payload()).findGlobal({ slug: 'academy-settings', depth: 0, overrideAccess: true }).catch(() => null)
  return clubFeeNote(s?.clubRegistrationFee)
})

/** “Academy fees do not include the $950 Rowville Eagles player registration.” (amount from Academy settings) */
export async function ClubFeeNote({ className = 'text-xs text-muted' }: { className?: string }) {
  return <p className={className} data-fee-note>{await note()}</p>
}

export const isAcademyFeeProgram = (type?: string | null) => type === 'academy-term' || type === 'academy-year'
