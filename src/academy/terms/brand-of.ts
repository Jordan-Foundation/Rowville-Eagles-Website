import type { Program } from '@/payload-types'

/** Emails and texts for a term program go out as its own brand: Rowville Eagles (Mini Ballers) or Foundation Academy. */
export const brandOf = (program: Pick<Program, 'brand'> | null | undefined): 'club' | 'academy' => (program?.brand === 'club' ? 'club' : 'academy')
