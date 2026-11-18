/**
 * Outcome email/SMS templates (pure). Staff edit them per round; placeholders in {braces} are filled per player.
 *   {parent} {player} {playerFull} {program} {ageGroup} {trialDate} {team} {event} {link} {deadline} {siteUrl}
 */
export type OutcomeKind = 'selected' | 'successful' | 'unsuccessful'

/** The original wording — rounds still holding it exactly get the current default instead. */
export const OLD_DEFAULTS: Record<OutcomeKind, { subject: string; body: string; sms: string }> = {
  selected: {
    subject: '{player} has been selected — {event}',
    body: 'Congratulations {parent} — {player} has been selected to play in {team} at {event}.\n\nPlease complete registration and payment using the button below so we can confirm {player}’s place.',
    sms: '{event}: {player} has been selected for {team}! Complete registration: {link}',
  },
  successful: {
    subject: 'Welcome to the Eagles, {player}!',
    body: 'Congratulations {parent} — after trials we’d love {player} to join {team} for the season.\n\nPlease complete registration and payment using the button below to accept the place.',
    sms: 'Rowville Eagles: congratulations — {player} has a place in {team}! Complete registration: {link}',
  },
  unsuccessful: {
    subject: 'Trial outcome for {player}',
    body: 'Thank you for trialling with Rowville Eagles. We’ve had a great number of players this season, and on this occasion we’re unable to offer {player} a place in a {ageGroup} team. We know this is disappointing.\n\nWe’d love {player} to keep playing — we’ll keep their details in case a spot opens up, and you’re welcome to contact us for feedback.',
    sms: '',
  },
}

export const DEFAULT_TEMPLATES: Record<OutcomeKind, { subject: string; body: string; sms: string }> = {
  selected: {
    subject: '{player} has been selected — {event}',
    body:
      'Congratulations {parent} — {player} has been selected for {event} ({ageGroup}).\n\nNext step: complete registration and payment using the button below by {deadline} so we can confirm {player}’s place. Once teams are finalised we’ll email you {player}’s team, coach and all the details.',
    sms: '{event}: {player} has been selected! Complete registration by {deadline}: {link}',
  },
  successful: {
    subject: 'Congratulations {player} — welcome to {program}!',
    body:
      'Congratulations {parent} — after trials we’d love {player} to join {program} in the {ageGroup}.\n\nNext steps:\n1. Complete registration and payment using the button below by {deadline} to accept the place.\n2. Pick {player}’s shirt number and tell us your preferred training nights and game day.\n3. Once teams are finalised, we’ll email you {player}’s team, coach, training times and game day.',
    sms: 'Rowville Eagles: congratulations — {player} has a place for {program}! Complete registration by {deadline}: {link}',
  },
  unsuccessful: {
    subject: 'Trial outcome for {player}',
    body:
      'Thank you for trialling with Rowville Eagles. We’ve had a great number of players this season, and on this occasion we’re unable to offer {player} a place in a {ageGroup} team. We know this is disappointing, and we really appreciated {player}’s effort.\n\nWe’d love {player} to keep playing and developing with us:\n• Foundation Academy training terms — weekly sessions with our coaches: {siteUrl}/programs?type=academy-term\n• School holiday camps: {siteUrl}/programs?type=holiday-camp\n• 1-on-1 coaching: {siteUrl}/academy/1-on-1\n\nWe’ll keep {player}’s details in case a spot opens up, and you’re welcome to contact us for feedback.',
    sms: '',
  },
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Fill {placeholders}. Unknown placeholders are left as typed so mistakes are visible in the preview. */
export function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m))
}

/** Template text → safe HTML paragraphs (blank line = new paragraph). */
export function toHtml(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => esc(p).replace(/\n/g, '<br>'))
    .join('<br><br>')
}

/** Unfilled placeholders left in a rendered template (shown as a warning in the review step). */
export const leftovers = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])]
