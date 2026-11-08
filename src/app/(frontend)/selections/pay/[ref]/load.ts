import type { Program, SelectionEntry, SelectionRound, Squad } from '@/payload-types'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { feeFor, payeeFor } from '@/selections/payment'

/** The entry behind a pay link, if the visitor may pay for it: the private link (token) or the family's own login. */
export async function loadPayable(ref: string, token?: string | null) {
  const p = await payload()
  const entry = (await p.find({ pagination: false, collection: 'selection-entries', where: { reference: { equals: ref } }, limit: 1, depth: 2, overrideAccess: true, showHiddenFields: true })).docs[0] as SelectionEntry | undefined
  if (!entry) return null
  const user = await currentUser()
  const owner = user && (typeof entry.account === 'object' ? entry.account?.id : entry.account) === user.id
  if (!owner && !(token && entry.token && token === entry.token)) return null
  const round = entry.round as SelectionRound
  // Rowville offers made directly in the admin carry their own registration program and team
  const program = ((round.program && typeof round.program === 'object' ? round.program : null) ??
    (round.kind === 'rowville' && entry.registrationProgram && typeof entry.registrationProgram === 'object' ? entry.registrationProgram : null)) as Program | null
  const squad = (entry.squad && typeof entry.squad === 'object'
    ? entry.squad
    : entry.offeredTeam && typeof entry.offeredTeam === 'object'
      ? { name: entry.offeredTeam.name, fee: null }
      : null) as Squad | null
  return { p, user, entry, round, program, squad, fee: feeFor(round, squad, program), payee: program ? payeeFor(program) : null }
}
