import { Chakra_Petch } from 'next/font/google'

/** Foundation+ brand font (headings/labels) — only loaded on pages that use it. */
export const chakra = Chakra_Petch({ subsets: ['latin'], weight: ['600', '700'], style: ['normal', 'italic'], variable: '--font-chakra' })
