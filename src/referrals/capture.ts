import { cookies } from 'next/headers'
import { normaliseCode } from './rules'
import { REF_COOKIE } from './service'

/** The referral code for a checkout: typed in the "Referral code" box, else the one from the referral link (cookie). */
export async function referralCodeFrom(fd?: FormData | null) {
  const typed = normaliseCode(fd?.get('referralCode'))
  if (typed) return typed
  try {
    const raw = (await cookies()).get(REF_COOKIE)?.value ?? ''
    return normaliseCode(decodeURIComponent(raw).split('.')[0])
  } catch {
    return null
  }
}

/** The invite token from the referral link (cookie), if any. */
export async function inviteTokenFromCookie() {
  try {
    const raw = decodeURIComponent((await cookies()).get(REF_COOKIE)?.value ?? '')
    return raw.split('.')[1] || null
  } catch {
    return null
  }
}

/** Did the family type a code that isn't a real one? (So we can say so instead of silently ignoring it.) */
export const typedCode = (fd?: FormData | null) => String(fd?.get('referralCode') ?? '').trim()

/** For a checkout: the referral code to save on the booking, or an error if they typed one that doesn't exist. */
export async function checkoutReferralCode(p: import('payload').Payload, fd?: FormData | null): Promise<{ code: string | null; error?: string }> {
  const { resolveCode } = await import('./service')
  const typed = typedCode(fd)
  if (typed) {
    const hit = await resolveCode(p, typed)
    return hit ? { code: hit.code } : { code: null, error: 'That referral code isn’t right — check it, or leave the box empty.' }
  }
  const fromLink = await referralCodeFrom(null)
  return { code: fromLink && (await resolveCode(p, fromLink)) ? fromLink : null }
}
