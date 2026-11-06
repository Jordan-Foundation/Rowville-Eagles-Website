/**
 * Exact wording shown to people. Stored verbatim on every consent record (APP 7 / Spam Act evidence),
 * so change it here only — never edit the text inside a form.
 */
export const CONSENT_WORDING = {
  service:
    'I agree to receive service messages about my bookings, sessions, payments and account by email and SMS.',
  /** Sign-up: one unticked box — ticking it is express consent for both channels. */
  marketingSignupOptIn:
    'Yes, I’d like to receive programs, offers and rewards by email and SMS. I can change this at any time.',
  marketingEmailOptOut: 'Don’t send me programs, offers and rewards by email',
  marketingSmsOptOut: 'Don’t send me programs, offers and rewards by SMS',
  marketingEmailOptIn: 'Send me programs, offers and rewards by email',
  marketingSmsOptIn: 'Send me programs, offers and rewards by SMS',
  checkoutOptIn: 'Send me programs, offers and rewards by email and SMS (optional)',
  unsubscribeLink: 'Unsubscribed using the link in a marketing email',
  stopReply: 'Replied STOP to an SMS',
} as const
