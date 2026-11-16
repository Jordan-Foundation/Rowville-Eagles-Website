import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'

/**
 * Claude calls for Match Reflections. Only anonymised text is ever sent: no names, IDs, emails or phone numbers
 * (callers run everything through rules.redact and label players “Player A”, “Player B”…).
 */

export const AI_MODEL = 'claude-opus-5-5'
export const REPORT_PROMPT_VERSION = 'weekend-v1'
export const WELFARE_PROMPT_VERSION = 'welfare-v1'

/** Local testing only: deterministic answers without calling the API. Never used on the live site. */
const fake = () => process.env.REFLECTIONS_AI_FAKE === '1' && process.env.NODE_ENV !== 'production'
/** Local testing only: keep a copy of exactly what would have been sent, so tests can check nothing identifying goes out. */
async function recordFake(kind: string, body: unknown) {
  const fs = await import('node:fs')
  fs.mkdirSync('.outbox', { recursive: true })
  fs.writeFileSync(`.outbox/ai-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`, JSON.stringify(body, null, 1))
}

export const aiConfigured = () => fake() || Boolean(process.env.ANTHROPIC_API_KEY)

let client: Anthropic | null = null
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set')
  client ??= new Anthropic({ maxRetries: 2, timeout: 120_000 })
  return client
}

/** Turns SDK errors into a short message for the stored record (never includes the key). */
export function aiErrorMessage(e: unknown): string {
  if (e instanceof Anthropic.RateLimitError) return 'The AI service is busy (rate limited)'
  if (e instanceof Anthropic.AuthenticationError) return 'The AI key was not accepted — check ANTHROPIC_API_KEY'
  if (e instanceof Anthropic.APIConnectionError) return 'Could not reach the AI service'
  if (e instanceof Anthropic.APIError) return `AI service error ${e.status ?? ''}`.trim()
  return (e instanceof Error ? e.message : String(e)).slice(0, 200)
}

// ── Safeguarding check ───────────────────────────────────────────────────────

const WelfareSchema = z.object({
  concern: z.boolean().describe('True if anything suggests the child may be unsafe, harmed, at risk, or in distress beyond normal sport disappointment.'),
  severity: z.enum(['none', 'low', 'medium', 'high']),
  reason: z.string().describe('One short sentence for the safeguarding officer. Empty if no concern.'),
})
export type WelfareResult = z.infer<typeof WelfareSchema>

const WELFARE_SYSTEM = `You help a youth football club's safeguarding officer. You read a child's short post-match reflection (anonymised) and decide whether a trained adult should look at it.

Flag (concern=true) when the text suggests the child may be unsafe, hurt, bullied, frightened of someone, harming themselves, neglected, or in real distress — including indirect or misspelt wording.
Do not flag ordinary football feelings: being upset about losing, frustration with their own mistakes, nervousness before games, tiredness, or minor knocks from play.
When unsure, flag with severity "low" — a person will review it. Never diagnose or judge the child; the reason is a neutral one-line note.`

export async function classifyWelfare(text: string): Promise<WelfareResult> {
  if (fake()) {
    await recordFake('welfare', { text })
    const t = text.toLowerCase()
    return /worried at home|nobody helps me|fake-concern/.test(t) ? { concern: true, severity: 'medium', reason: 'Mentions feeling unsupported (test).' } : { concern: false, severity: 'none', reason: '' }
  }
  const res = await anthropic().messages.parse({
    model: AI_MODEL,
    max_tokens: 2000,
    system: WELFARE_SYSTEM,
    messages: [{ role: 'user', content: `<reflection>\n${text}\n</reflection>` }],
    output_config: { effort: 'low', format: zodOutputFormat(WelfareSchema) },
  })
  if (res.stop_reason === 'refusal') return { concern: true, severity: 'low', reason: 'The automatic check could not assess this text — please read it.' }
  if (!res.parsed_output) throw new Error('The AI check returned no result')
  return res.parsed_output
}

// ── Weekend report ───────────────────────────────────────────────────────────

const Theme = z.object({
  pillar: z.string().describe('One of the pillar names given'),
  theme: z.string().describe('A short plain-English theme, e.g. "Scanning before receiving"'),
  players: z.number().int().describe('How many different players mentioned it'),
})
export const ReportSchema = z.object({
  headline: z.string().describe('One encouraging, factual sentence about the weekend.'),
  strength_themes: z.array(Theme).describe('Up to 4 things players felt went well'),
  improvement_themes: z.array(Theme).describe('Up to 4 things players want to work on'),
  focus_themes: z.array(z.object({ theme: z.string(), players: z.number().int() })).describe('Up to 4 common focuses for next game'),
  coach_suggestions: z.array(z.string()).describe('2–4 practical training ideas for coaches that match the improvement themes'),
  notable_examples: z.array(z.object({ player: z.string().describe('The anonymous label, e.g. "Player C"'), quote: z.string(), why: z.string() })).describe('Up to 3 short quotes worth a coach noticing'),
})
export type ReportSummary = z.infer<typeof ReportSchema>

export type ReportInput = {
  scope: string
  period: string
  pillars: string[]
  /** Pre-computed numbers — the AI must not recalculate them. */
  numbers: string
  reflections: { player: string; feeling: number | null; great: { pillar: string; comment: string }[]; improve: { pillar: string; comment: string }[]; focus: string }[]
}

const REPORT_SYSTEM = `You write a short weekly summary of junior footballers' post-match reflections for their coaches and the club's management.

Rules:
- Summarise only what players wrote. Group similar comments into themes and count how many different players mentioned each.
- The numbers you are given were calculated exactly; do not recalculate or contradict them.
- Players are anonymous ("Player A"). Never guess who anyone is. Keep "[name]" placeholders as they are.
- Be positive and constructive. Never diagnose, label or judge a child, and never comment on a child's wellbeing, mood or home life — wellbeing concerns are handled separately by a person.
- Quotes in notable_examples must be copied word for word from a single player's comment, and kept short.
- Use Australian English and football terms coaches use.`

export async function summariseReport(input: ReportInput): Promise<ReportSummary> {
  if (fake()) {
    await recordFake('report', input)
    return {
      headline: `${input.reflections.length} players reflected on the ${input.period} games (${input.scope}).`,
      strength_themes: [{ pillar: input.pillars[1] ?? 'Passing', theme: 'Accurate short passing', players: Math.min(2, input.reflections.length) }],
      improvement_themes: [{ pillar: input.pillars[0] ?? 'Physical', theme: 'Getting back to defend', players: 1 }],
      focus_themes: [{ theme: 'Scanning before receiving', players: 1 }],
      coach_suggestions: ['Rondo with a scan call before each pass.'],
      notable_examples: input.reflections[0] ? [{ player: input.reflections[0].player, quote: input.reflections[0].great[0]?.comment.slice(0, 60) ?? '', why: 'Clear self-awareness.' }] : [],
    }
  }
  const user = `<scope>${input.scope}</scope>
<period>${input.period}</period>
<pillars>${input.pillars.join(', ')}</pillars>
<numbers>
${input.numbers}
</numbers>
<reflections>
${JSON.stringify(input.reflections, null, 1)}
</reflections>`
  const res = await anthropic().messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    system: REPORT_SYSTEM,
    messages: [{ role: 'user', content: user }],
    output_config: { format: zodOutputFormat(ReportSchema) },
  })
  if (res.stop_reason === 'refusal') throw new Error('The AI declined to write this summary')
  if (res.stop_reason === 'max_tokens') throw new Error('The AI summary was cut off')
  if (!res.parsed_output) throw new Error('The AI returned an unreadable summary')
  return tidySummary(res.parsed_output, input)
}

/** Keeps lists short, drops quotes that aren't really from a player, and anything naming a real person. */
export function tidySummary(s: ReportSummary, input: Pick<ReportInput, 'reflections'>): ReportSummary {
  const said = new Map(input.reflections.map((r) => [r.player, [...r.great, ...r.improve].map((m) => m.comment.toLowerCase()).concat(r.focus.toLowerCase())]))
  return {
    headline: s.headline.slice(0, 300),
    strength_themes: s.strength_themes.slice(0, 4),
    improvement_themes: s.improvement_themes.slice(0, 4),
    focus_themes: s.focus_themes.slice(0, 4),
    coach_suggestions: s.coach_suggestions.slice(0, 4).map((x) => x.slice(0, 300)),
    notable_examples: s.notable_examples
      .filter((e) => /^Player [A-Z]+$/.test(e.player) && (said.get(e.player) ?? []).some((c) => c.includes(e.quote.toLowerCase().replace(/^["“]|["”]$/g, '').trim())))
      .slice(0, 3),
  }
}
