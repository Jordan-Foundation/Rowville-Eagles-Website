import type { Payload, PayloadRequest } from 'payload'
import type { ConsentRecord, User } from '@/payload-types'
import { CONSENT_WORDING } from './consent-wording'

type Channel = ConsentRecord['channel']
type Source = ConsentRecord['source']
type Meta = { ip?: string | null; userAgent?: string | null; req?: PayloadRequest }

/** Field on the user that mirrors each channel's current state. */
const FLAG: Record<Exclude<Channel, 'service'>, 'marketingEmail' | 'marketingSms' | 'smsOptOut'> = {
  marketing_email: 'marketingEmail',
  marketing_sms: 'marketingSms',
  sms_all: 'smsOptOut',
}

/**
 * Record one consent decision and update the user's current flags in the same transaction.
 * Records are append-only: history is never overwritten.
 */
export async function recordConsent(
  payload: Payload,
  user: Pick<User, 'id' | 'email' | 'phone'>,
  entry: { channel: Channel; action: 'granted' | 'withdrawn'; wording: string; source: Source; basis?: 'express' | 'inferred' },
  meta: Meta = {},
) {
  await payload.create({
    collection: 'consent-records',
    overrideAccess: true,
    req: meta.req,
    data: {
      user: user.id,
      email: user.email,
      phone: user.phone || undefined,
      channel: entry.channel,
      action: entry.action,
      basis: entry.basis,
      wording: entry.wording,
      source: entry.source,
      ip: meta.ip || undefined,
      userAgent: meta.userAgent?.slice(0, 300) || undefined,
    },
  })
  const data: Partial<User> =
    entry.channel === 'service'
      ? { serviceConsentAt: entry.action === 'granted' ? new Date().toISOString() : null }
      : entry.channel === 'sms_all'
        ? { smsOptOut: entry.action === 'withdrawn' }
        : { [FLAG[entry.channel]]: entry.action === 'granted' }
  await payload.update({ collection: 'users', id: user.id, data, overrideAccess: true, req: meta.req })
}

/** Sign-up (and guest → account): service is required; marketing only if they ticked the opt-in box (express consent). */
export async function recordSignupConsent(
  payload: Payload,
  user: Pick<User, 'id' | 'email' | 'phone'>,
  choice: { marketingOptIn: boolean },
  meta: Meta = {},
) {
  await recordConsent(payload, user, { channel: 'service', action: 'granted', wording: CONSENT_WORDING.service, source: 'signup', basis: 'express' }, meta)
  await recordConsent(
    payload,
    user,
    {
      channel: 'marketing_email',
      action: choice.marketingOptIn ? 'granted' : 'withdrawn',
      wording: `${CONSENT_WORDING.marketingSignupOptIn} [${choice.marketingOptIn ? 'ticked' : 'not ticked'}]`,
      source: 'signup',
      basis: 'express',
    },
    meta,
  )
  await recordConsent(
    payload,
    user,
    {
      channel: 'marketing_sms',
      action: choice.marketingOptIn ? 'granted' : 'withdrawn',
      wording: `${CONSENT_WORDING.marketingSignupOptIn} [${choice.marketingOptIn ? 'ticked' : 'not ticked'}]`,
      source: 'signup',
      basis: 'express',
    },
    meta,
  )
  await payload.update({ collection: 'users', id: user.id, data: { consentReviewStatus: 'confirmed' }, overrideAccess: true, req: meta.req })
}

/** Preference changes (profile page / confirm email): only records channels that actually changed. */
export async function updateMarketingPreferences(
  payload: Payload,
  user: User,
  wanted: { email: boolean; sms: boolean },
  source: Extract<Source, 'profile' | 'consent_email' | 'admin'>,
  meta: Meta = {},
) {
  const changes: [Exclude<Channel, 'service' | 'sms_all'>, boolean, string][] = [
    ['marketing_email', wanted.email, wanted.email ? CONSENT_WORDING.marketingEmailOptIn : CONSENT_WORDING.marketingEmailOptOut],
    ['marketing_sms', wanted.sms, wanted.sms ? CONSENT_WORDING.marketingSmsOptIn : CONSENT_WORDING.marketingSmsOptOut],
  ]
  let changed = 0
  for (const [channel, on, wording] of changes) {
    const current = channel === 'marketing_email' ? Boolean(user.marketingEmail) : Boolean(user.marketingSms)
    // The confirm-preferences email always records the answer (it's the evidence for existing members).
    if (current === on && source !== 'consent_email') continue
    await recordConsent(payload, user, { channel, action: on ? 'granted' : 'withdrawn', wording, source, basis: 'express' }, meta)
    changed++
  }
  return { changed }
}

/** Can this user be sent marketing on this channel right now? Checked again at the moment of sending. */
export function canMarket(user: Pick<User, 'marketingEmail' | 'marketingSms' | 'smsOptOut'>, channel: 'email' | 'sms') {
  return channel === 'email' ? user.marketingEmail === true : user.marketingSms === true && user.smsOptOut !== true
}
