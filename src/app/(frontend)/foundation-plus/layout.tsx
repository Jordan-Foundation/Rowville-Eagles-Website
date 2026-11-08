import { chakra } from '@/lib/fonts'

/** Every Foundation+ page: loads the Foundation+ brand font. */
export default function FoundationPlusLayout({ children }: { children: React.ReactNode }) {
  return <div className={chakra.variable}>{children}</div>
}
