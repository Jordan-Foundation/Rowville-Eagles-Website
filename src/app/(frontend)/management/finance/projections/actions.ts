'use server'

import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { financeOrNull } from '@/finance/access'
import type { Scenario } from '@/finance/projection-calc'

/** Saves the slider settings as a named scenario (no real data changes). */
export async function saveScenario(name: string, inputs: Scenario) {
  const user = await financeOrNull()
  if (!user) return { error: 'Admins only.' }
  const n = String(name ?? '').trim().slice(0, 80)
  if (!n) return { error: 'Give the scenario a name.' }
  const doc = await (await payload()).create({ collection: 'projection-scenarios', data: { name: n, inputs: inputs as Record<string, unknown>, createdBy: user.id }, overrideAccess: true, depth: 0, user })
  revalidatePath('/management/finance/projections')
  return { id: doc.id }
}

export async function deleteScenario(id: number) {
  const user = await financeOrNull()
  if (!user) return { error: 'Admins only.' }
  await (await payload()).delete({ collection: 'projection-scenarios', id: Number(id), overrideAccess: true, depth: 0, user })
  revalidatePath('/management/finance/projections')
  return {}
}
