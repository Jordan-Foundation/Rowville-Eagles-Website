/** The five programs a referral can come from (pure — shared by server and pages). */
export const REFERRAL_PROGRAMS = [
  { value: 'academy-term', label: 'Foundation Academy term', short: 'Academy term', blurb: 'Weekly group training in small age groups, coached by professionally developed coaches, all school term long.' },
  { value: 'holiday-camp', label: 'Holiday camp', short: 'Holiday camp', blurb: 'Fun-packed school holiday football camps — full camp or single days, grouped by age.' },
  { value: 'mini-ballers', label: 'Mini Ballers (ages 2–5)', short: 'Mini Ballers', blurb: 'A playful first taste of football for toddlers and preschoolers, with a parent alongside.' },
  { value: 'one-on-one', label: '1-on-1 session', short: '1-on-1', blurb: 'Focused one-to-one coaching on exactly what your player needs, at a time that suits you.' },
  { value: 'eagles', label: 'Rowville Eagles club football', short: 'Rowville Eagles', blurb: 'Play for the Eagles — MiniRoos, juniors and seniors. Register for a trial and our coaches will be in touch.' },
] as const

export type ReferralProgram = (typeof REFERRAL_PROGRAMS)[number]['value']
export const isReferralProgram = (v: unknown): v is ReferralProgram => REFERRAL_PROGRAMS.some((p) => p.value === v)
export const programLabel = (v?: string | null) => REFERRAL_PROGRAMS.find((p) => p.value === v)?.label ?? v ?? ''

/** Which referral program a paid booking is (null = doesn't count). Small groups, trials, tournaments, shop etc. don't. */
export function bookingReferralProgram(b: { bookingType?: string | null }, programType?: string | null): ReferralProgram | null {
  if (b.bookingType === 'trial') return null
  switch (programType) {
    case 'registration': return 'eagles'
    case 'academy-term':
    case 'academy-year': return 'academy-term'
    case 'holiday-camp': return 'holiday-camp'
    case 'toddler': return 'mini-ballers'
    default: return null
  }
}
