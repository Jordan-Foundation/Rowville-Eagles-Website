import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { requireFinance } from '@/finance/access'
import { projectionBaseline } from '@/finance/projections'
import type { Scenario } from '@/finance/projection-calc'
import { Projections } from './Projections'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Finance · Projections', robots: { index: false } }

export default async function ProjectionsPage() {
  await requireFinance('/management/finance/projections')
  const p = await payload()
  const [baseline, { docs }] = await Promise.all([projectionBaseline(p), p.find({ collection: 'projection-scenarios', sort: '-createdAt', limit: 50, depth: 0, overrideAccess: true })])
  return <Projections baseline={baseline} saved={docs.map((d) => ({ id: d.id, name: d.name, inputs: (d.inputs ?? {}) as Scenario }))} />
}
