'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { assignNumber, NumberError, releaseNumber } from '@/numbers/service'
import { rangeProblem } from '@/numbers/rules'

const back = (path: string, kind: 'done' | 'error', msg: string): never => redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`)

/** Assign, change or release a player's number (logged). */
export async function playerNumberAction(fd: FormData) {
  const me = await managementOrNull()
  const id = Number(fd.get('participant'))
  const path = `/management/numbers/player/${id}`
  if (!me) back(path, 'error', 'Management only.')
  let msg = ''
  try {
    const p = await payload()
    if (fd.get('op') === 'release') {
      await releaseNumber(p, id, { by: me!.id })
      msg = 'Number released.'
    } else {
      const doc = await assignNumber(p, id, Number(fd.get('number')), me!.id)
      msg = `Number ${doc.number} assigned.`
    }
  } catch (e) {
    back(path, 'error', e instanceof NumberError ? e.message : 'Couldn’t save — please try again.')
  }
  revalidatePath('/management/numbers', 'layout')
  back(path, 'done', msg)
}

/** Save the number ranges table. */
export async function saveRanges(fd: FormData) {
  const me = await managementOrNull()
  if (!me) back('/management/numbers/ranges', 'error', 'Management only.')
  const p = await payload()
  const ids = fd.getAll('id').map(Number)
  for (const id of ids) {
    const start = Number(fd.get(`start-${id}`))
    const end = Number(fd.get(`end-${id}`))
    const problem = rangeProblem({ start, end })
    if (problem) back('/management/numbers/ranges', 'error', `${fd.get(`year-${id}`)}: ${problem}`)
  }
  for (const id of ids) await p.update({ collection: 'number-ranges', id, data: { start: Number(fd.get(`start-${id}`)), end: Number(fd.get(`end-${id}`)) }, overrideAccess: true })
  revalidatePath('/management/numbers', 'layout')
  back('/management/numbers/ranges', 'done', 'Ranges saved.')
}
