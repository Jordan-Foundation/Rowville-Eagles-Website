import type { Payload } from 'payload'
import type { Program, SelectionRound } from '@/payload-types'

/** The Rowville trials round for a season (created automatically the first time someone registers). */
export async function rowvilleRound(payload: Payload, season: number): Promise<SelectionRound> {
  const { docs } = await payload.find({ collection: 'selection-rounds', where: { kind: { equals: 'rowville' }, season: { equals: season } }, sort: '-createdAt', limit: 1, depth: 0, overrideAccess: true })
  if (docs[0]) return docs[0]
  return payload.create({ collection: 'selection-rounds', overrideAccess: true, data: { title: `Rowville Eagles ${season} trials`, kind: 'rowville', season, status: 'open' } })
}

/** The selection round for a tournament program (created automatically the first time someone registers interest). */
export async function tournamentRound(payload: Payload, program: Program, season: number): Promise<SelectionRound> {
  const { docs } = await payload.find({ collection: 'selection-rounds', where: { kind: { equals: 'tournament' }, program: { equals: program.id } }, sort: '-createdAt', limit: 1, depth: 0, overrideAccess: true })
  if (docs[0]) return docs[0]
  return payload.create({ collection: 'selection-rounds', overrideAccess: true, data: { title: program.title, kind: 'tournament', season, status: 'open', program: program.id, fee: program.price } })
}
