import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import type { Payload, PayloadRequest } from 'payload'

export type Sender = 'club' | 'academy'

const from = (s: Sender) =>
  s === 'academy'
    ? process.env.EMAIL_FROM_ACADEMY || 'Foundation Academy <academy@rowvilleeagles.com.au>'
    : process.env.EMAIL_FROM_CLUB || 'Rowville Eagles FC <hello@rowvilleeagles.com.au>'

/**
 * Sends via Resend when RESEND_API_KEY is set. Otherwise (local dev / not yet configured) the email is
 * written to ./.outbox as an HTML file so it can be previewed, and nothing is sent.
 */
/**
 * Plain-text version of an HTML email. Sending HTML with an empty text part is a common spam signal,
 * so every email gets a readable text alternative (links shown as "Label: URL").
 */
export function htmlToText(html: string) {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, '$1\n')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, '').trim()
      const url = href.replace(/&amp;/g, '&')
      return text && text !== url ? `${text}: ${url}` : url
    })
    .replace(/<\/(h1|p|tr|table)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/td>\s*<td[^>]*>/gi, ': ')
    .replace(/<hr[^>]*>/gi, '\n----\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

type SendOptions = {
  to: string
  subject: string
  html: string
  sender: Sender
  replyTo?: string
  /** service (default) or marketing. Marketing must go through sendMarketing(). */
  kind?: 'service' | 'marketing'
  headers?: Record<string, string>
  userId?: number
  req?: PayloadRequest
}

async function logEmail(payload: Payload, opts: SendOptions, status: 'sent' | 'failed' | 'not-configured' | 'skipped-opted-out', error?: string) {
  try {
    await payload.create({
      collection: 'message-log',
      overrideAccess: true,
      req: opts.req,
      data: { to: opts.to, subject: opts.subject, kind: opts.kind ?? 'service', sender: opts.sender, userId: opts.userId, status, error: error?.slice(0, 300) },
    })
  } catch (e) {
    payload.logger.error({ err: e, msg: 'Could not write message log' })
  }
}

/**
 * Sends via Resend when RESEND_API_KEY is set. Otherwise (local dev / not yet configured) the email is
 * written to ./.outbox as an HTML file so it can be previewed, and nothing is sent.
 */
export async function sendEmail(payload: Payload, opts: SendOptions) {
  const text = htmlToText(opts.html)
  if (process.env.RESEND_API_KEY) {
    try {
      await payload.sendEmail({ to: opts.to, from: from(opts.sender), subject: opts.subject, html: opts.html, text, replyTo: opts.replyTo, headers: opts.headers })
      await logEmail(payload, opts, 'sent')
    } catch (e) {
      payload.logger.error({ err: e, msg: `Email to ${opts.to} failed: ${opts.subject}` })
      await logEmail(payload, opts, 'failed', e instanceof Error ? e.message : String(e))
    }
    return
  }
  payload.logger.info(`[email not sent — no RESEND_API_KEY] to=${opts.to} subject="${opts.subject}"`)
  await logEmail(payload, opts, 'not-configured')
  if (process.env.NODE_ENV !== 'production') {
    const dir = path.resolve(process.cwd(), '.outbox')
    await mkdir(dir, { recursive: true })
    const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${opts.subject.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}.html`
    const head = [`to: ${opts.to}`, `from: ${from(opts.sender)}`, `kind: ${opts.kind ?? 'service'}`, ...Object.entries(opts.headers ?? {}).map(([k, v]) => `${k}: ${v}`)]
    await writeFile(path.join(dir, name), `<!-- ${head.join(' | ')} -->\n${opts.html}`)
    await writeFile(path.join(dir, name.replace(/\.html$/, '.txt')), text)
  }
}
