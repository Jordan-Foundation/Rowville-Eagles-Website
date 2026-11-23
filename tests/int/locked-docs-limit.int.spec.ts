import { describe, expect, it } from 'vitest'
import config from '@payload-config'

/**
 * The admin dashboard's document-locking query uses one Postgres function argument per lockable collection (plus a
 * few fixed ones); Postgres refuses more than 100, which broke /admin once. Keep well under it.
 */
describe('document locking', () => {
  it('stays under the Postgres 100-argument limit', async () => {
    const c = await config
    const lockable = c.collections.filter((x) => x.lockDocuments !== false && !x.slug.startsWith('payload-'))
    expect(lockable.length).toBeLessThanOrEqual(90)
  })
})
