import { policyHref, type PolicyKey } from '@/lib/policies'

/** Opens a policy in a new tab (so a half-filled booking form isn't lost). */
export function PolicyLink({ k, children }: { k: PolicyKey; children: React.ReactNode }) {
  return (
    <a href={policyHref(k)} target="_blank" rel="noopener" className="font-semibold underline">
      {children}
    </a>
  )
}
