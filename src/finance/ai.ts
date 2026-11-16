import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'

/**
 * Reads a receipt or invoice (photo, PDF or email) with Claude and returns strict JSON for the expense form.
 * Only the receipt itself is sent — nothing else from the mailbox.
 */
export const RECEIPT_MODEL = 'claude-opus-5-5'

const fake = () => (process.env.FINANCE_AI_FAKE === '1' || process.env.REFLECTIONS_AI_FAKE === '1') && process.env.NODE_ENV !== 'production'
export const receiptAiConfigured = () => fake() || Boolean(process.env.ANTHROPIC_API_KEY)

const ReceiptSchema = z.object({
  isReceipt: z.boolean().describe('True only for a receipt, tax invoice or bill for something the business bought. False for newsletters, marketing, shipping updates, quotes, statements, personal items or payments TO the business.'),
  supplier: z.string().describe('Business name of the seller'),
  date: z.string().describe('Date of purchase as YYYY-MM-DD'),
  total: z.number().describe('Total paid including GST, in AUD'),
  gst: z.number().nullable().describe('GST amount in AUD if shown, else null'),
  summary: z.string().describe('Short line summary of what was bought'),
  category: z.string().describe('Best match from the category list given'),
  paymentMethod: z.enum(['card', 'bank transfer', 'direct debit', 'cash', 'other']).nullable(),
})
export type ReceiptData = z.infer<typeof ReceiptSchema>

export type ReceiptInput = { text?: string; file?: { data: Buffer; mediaType: string }; categories: string[] }

const SYSTEM = `You read receipts and invoices for an Australian junior football club's bookkeeping.
Return the fields exactly as shown on the document. Amounts are AUD. If GST isn't shown separately, use null (don't calculate it).
Use the purchase/invoice date, not the email date. If something is not a receipt or invoice for a purchase, set isReceipt to false and fill the other fields as best you can.`

export async function readReceipt(input: ReceiptInput): Promise<ReceiptData> {
  if (fake()) {
    const t = `${input.text ?? ''} ${input.file ? input.file.data.toString('latin1').slice(0, 4000) : ''}`
    if (/newsletter|unsubscribe from our deals/i.test(t) && !/tax invoice|receipt/i.test(t)) return { isReceipt: false, supplier: '', date: '', total: 0, gst: null, summary: '', category: '', paymentMethod: null }
    const amount = Number((t.match(/total[^0-9$]*\$?\s*([0-9]+(?:\.[0-9]{2})?)/i) ?? [])[1] ?? 0)
    const supplier = (t.match(/from[:\s]+([A-Z][A-Za-z ]+?)(?:\s+Pty|\s+-|\n|<|$)/) ?? [])[1]?.trim() || 'Test Supplier'
    const date = (t.match(/(\d{4}-\d{2}-\d{2})/) ?? [])[1] ?? new Date().toISOString().slice(0, 10)
    return { isReceipt: true, supplier, date, total: amount, gst: Math.round((amount / 11) * 100) / 100, summary: 'Test purchase', category: input.categories.find((c) => /equip/i.test(c)) ?? input.categories[0] ?? 'Other', paymentMethod: 'card' }
  }
  const content: Anthropic.ContentBlockParam[] = []
  if (input.file) {
    const data = input.file.data.toString('base64')
    if (input.file.mediaType === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } })
    else content.push({ type: 'image', source: { type: 'base64', media_type: (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(input.file.mediaType) ? input.file.mediaType : 'image/jpeg') as 'image/jpeg', data } })
  }
  content.push({ type: 'text', text: `Categories: ${input.categories.join(', ')}\n${input.text ? `<email>\n${input.text.slice(0, 20000)}\n</email>` : 'Read the attached receipt.'}` })
  const client = new Anthropic({ maxRetries: 2, timeout: 120_000 })
  const res = await client.messages.parse({
    model: RECEIPT_MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: 'user', content }],
    output_config: { effort: 'low', format: zodOutputFormat(ReceiptSchema) },
  })
  if (res.stop_reason === 'refusal') throw new Error('The receipt couldn’t be read automatically — please fill it in.')
  if (!res.parsed_output) throw new Error('The receipt couldn’t be read — please fill it in.')
  const r = res.parsed_output
  return { ...r, date: /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : '', total: Math.round(r.total * 100) / 100, gst: r.gst == null ? null : Math.round(r.gst * 100) / 100 }
}
