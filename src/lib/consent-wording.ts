/**
 * Exact wording shown to people. Stored verbatim on every consent record (APP 7 / Spam Act evidence),
 * so change it here only — never edit the text inside a form.
 */
export const CONSENT_WORDING = {
  service:
    'I agree to receive service messages about my bookings, sessions, payments and account by email and SMS.',
  marketingNotice:
    'We’ll also send you club news, offers and programs by email and SMS. You can opt out here or at any time.',
  marketingEmailOptOut: 'Don’t send me club news, offers and programs by email',
  marketingSmsOptOut: 'Don’t send me club news, offers and programs by SMS',
  marketingEmailOptIn: 'Send me club news, offers and programs by email',
  marketingSmsOptIn: 'Send me club news, offers and programs by SMS',
  checkoutOptIn: 'Send me club news, offers and programs (optional)',
  unsubscribeLink: 'Unsubscribed using the link in a marketing email',
  stopReply: 'Replied STOP to an SMS',
} as const
