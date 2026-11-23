/**
 * Portal launch messages (pure — unit tested).
 *
 * Templates use {{merge_fields}} and a little formatting so Management can edit them as plain text:
 *   **bold**   *italic*   "- " bullet lines   "1. " numbered lines   blank line = new paragraph
 *   [[Button text|{{activation_link}}]] on its own line = a button
 *   {{#not_activated}} … {{/not_activated}} = only for parents who haven't opened their account yet
 */

export type MergeVars = {
  parent_first_name: string
  player_names: string
  player_numbers_list: string // one line per child
  activation_link: string
  short_link: string
  portal_url: string
  club_phone: string
  unsubscribe_link: string
  one_on_one_hours?: string
  book_link?: string
}

export const MERGE_FIELDS = ['parent_first_name', 'player_names', 'player_numbers_list', 'activation_link', 'short_link', 'portal_url', 'club_phone', 'unsubscribe_link', 'one_on_one_hours', 'book_link'] as const

export function fillText(t: string, vars: Partial<MergeVars>, o: { activated?: boolean } = {}) {
  const sections = t.replace(/\{\{#not_activated\}\}([\s\S]*?)\{\{\/not_activated\}\}\n?/g, (_, inner: string) => (o.activated ? '' : inner))
  return sections.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in vars && (vars as Record<string, string | undefined>)[k] !== undefined ? String((vars as Record<string, string>)[k]) : m))
}

/** Merge fields left unfilled (shown as a warning in the editor). */
export const unknownFields = (t: string) => [...new Set([...t.matchAll(/\{\{(?![#/])(\w+)\}\}/g)].map((m) => m[1]).filter((k) => !(MERGE_FIELDS as readonly string[]).includes(k)))]

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const inline = (s: string) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:inherit">$1</a>')

export const BUTTON_STYLE = 'display:inline-block;background:#1e3a8a;color:#ffffff;font:bold 15px Arial,sans-serif;text-decoration:none;padding:14px 26px;border-radius:999px'

/** Filled template text → email HTML (paragraphs, lists, buttons). */
export function toEmailHtml(text: string) {
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/)
  return blocks
    .map((b) => {
      const lines = b.split('\n').filter((l) => l.trim())
      if (!lines.length) return ''
      const btn = lines.length === 1 && lines[0].trim().match(/^\[\[(.+?)\|(.+?)\]\]$/)
      if (btn) return `<p style="margin:20px 0"><a href="${esc(btn[2].trim())}" style="${BUTTON_STYLE}">${esc(btn[1].trim())}</a></p>`
      if (lines.every((l) => /^\s*-\s+/.test(l))) return `<ul style="margin:0 0 16px;padding-left:20px">${lines.map((l) => `<li style="margin:4px 0">${inline(l.replace(/^\s*-\s+/, ''))}</li>`).join('')}</ul>`
      if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) return `<ol style="margin:0 0 16px;padding-left:20px">${lines.map((l) => `<li style="margin:4px 0">${inline(l.replace(/^\s*\d+\.\s+/, ''))}</li>`).join('')}</ol>`
      return `<p style="margin:0 0 16px">${lines
        .map((l) => {
          const b2 = l.trim().match(/^\[\[(.+?)\|(.+?)\]\]$/)
          return b2 ? `<a href="${esc(b2[2].trim())}" style="${BUTTON_STYLE}">${esc(b2[1].trim())}</a>` : inline(l)
        })
        .join('<br>')}</p>`
    })
    .filter(Boolean)
    .join('\n')
}

// ── SMS: plain GSM-7 only (one curly quote or emoji makes the whole text Unicode and roughly doubles the cost) ──

const GSM7 = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
const GSM7_EXT = '^{}\\[~]|€\f'

/** Characters in a text that aren't plain GSM-7 (e.g. ’ “ – — emoji). */
export function nonGsmChars(s: string) {
  return [...new Set([...s].filter((c) => !GSM7.includes(c) && !GSM7_EXT.includes(c)))]
}

/** Length and number of SMS segments (160/153 for GSM-7; 70/67 if any character forces Unicode). */
export function smsSegments(s: string) {
  const unicode = nonGsmChars(s).length > 0
  const len = unicode ? [...s].length : [...s].reduce((n, c) => n + (GSM7_EXT.includes(c) ? 2 : 1), 0)
  const segments = len === 0 ? 0 : unicode ? (len <= 70 ? 1 : Math.ceil(len / 67)) : len <= 160 ? 1 : Math.ceil(len / 153)
  return { length: len, segments, unicode }
}

/** Make text GSM-7 safe: curly quotes → straight, dashes → hyphen, ellipsis → "...", drop anything else. */
export function toGsm(s: string) {
  return s
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[–—‒−]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .split('')
    .filter((c) => GSM7.includes(c) || GSM7_EXT.includes(c))
    .join('')
}

/** "Liam", "Liam and Mia", "Liam, Mia and Ava" */
export function playerNames(names: string[]) {
  const n = names.filter(Boolean)
  if (n.length <= 1) return n[0] ?? ''
  return `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`
}

/** "Liam – #7 – U10 Eagles Gold" lines */
export const numbersList = (kids: { name: string; number: number | null; team: string | null }[]) =>
  kids.map((k) => [k.name, k.number ? `#${k.number}` : null, k.team].filter(Boolean).join(' – ')).join('\n')

/** 6:30pm (Melbourne) on the day `days` after `from` — when the follow-up is due. */
export function followUpDue(fromIso: string, days: number, toUtc: (ymd: string, hhmm: string) => Date, ymdOf: (d: Date) => string) {
  const ymd = ymdOf(new Date(fromIso))
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return toUtc(d.toISOString().slice(0, 10), '18:30')
}

// ── Default copy (Management can edit all of it) ─────────────────────────────

export const DEFAULT_COPY = {
  launchSubject: 'Your new Rowville Eagles portal is ready, {{parent_first_name}}',
  launchBody: `Hi {{parent_first_name}},

We've launched our new club website and player portal, and we've already set everything up for {{player_names}}. Your details, team and shirt number are all in, so there's nothing to fill in.

[[Open my account|{{activation_link}}]]

Tap the button, choose a password, and you're in. This link is just for you and works for 14 days.

{{player_numbers_list}}

**What you can do in the portal**
- **Team page** – notice board, fixtures, training times and the parent forum, all in one place
- **Instant updates** – get a notification when training is cancelled, a fixture changes or the coach posts news
- **Book and pay online** – 1-on-1s, academy terms and holiday camps, any time
- **One login for the whole family** – all your kids in the one account

**Add it to your phone as an app (30 seconds)**

*iPhone*
1. Open the link above in **Safari**
2. Tap the **Share** button (the square with the arrow)
3. Scroll down and tap **Add to Home Screen**, then **Add**
4. Open the new Rowville Eagles icon on your home screen and tap **Allow** when it asks about notifications

*Android*
1. Open the link above in **Chrome**
2. Tap the **⋮** menu (top right)
3. Tap **Install app** or **Add to Home screen**
4. Open the app and tap **Allow** for notifications

On iPhone, notifications only work once it's on your home screen, so it's worth the 30 seconds.

Questions? Just reply to this email or call/text us on {{club_phone}}.

See you at training,
Jordan, Lachlan and the Foundation Football team`,
  launchSms: "Rowville Eagles: Hi {{parent_first_name}}, our new club portal is live and {{player_names}} is already set up. Tap to open your account: {{short_link}} Then add it to your home screen as an app - steps are in your email. Reply STOP to opt out",
  followUpSubject: 'Booking 1-on-1s is now done in the app',
  followUpBody: `Hi {{parent_first_name}},

{{#not_activated}}**You haven't opened your account yet** – it takes a minute and everything is already set up.

[[Open my account|{{activation_link}}]]

{{/not_activated}}Now that the portal is up and running, all 1-on-1 sessions are booked and paid for in the app from here on.

**How to book**
1. Open the app and tap **Book a 1-on-1**
2. Choose your coach
3. Pick a single session or a full term
4. Choose a time that suits
5. Pay securely by card – you'll get a confirmation straight away and a reminder before each session

**When sessions run**
{{one_on_one_hours}}

Popular times go quickly, so it's worth booking early – especially for a full term.

[[Book a 1-on-1|{{book_link}}]]

Any 1-on-1s you've already arranged with your coach go ahead as planned. Need to cancel? Do it 24 hours or more before the session and you'll get it back as a session credit or refund – cancellations inside 24 hours can't be refunded.

Any questions, reply here or call/text {{club_phone}}.

Cheers,
Jordan, Lachlan and the Foundation Football team`,
} as const
