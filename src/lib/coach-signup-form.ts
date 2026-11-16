import { wwccProblem } from './coach-signup'
import { localYmd } from './time'

const MAX = 3_000_000

/** Read the WWCC part of a form (shared by sign-up and the coach profile). */
export async function wwccFromForm(fd: FormData) {
  const number = String(fd.get('wwccNumber') ?? '').trim()
  const expiry = String(fd.get('wwccExpiry') ?? '')
  const f = fd.get('wwccPhoto')
  const file = f instanceof File && f.size > 0 ? f : null
  const problem = wwccProblem(number, expiry, localYmd(new Date()), Boolean(file))
  if (problem) return { error: problem } as const
  if (!/^image\/|^application\/pdf$/.test(file!.type)) return { error: 'The card photo needs to be a photo (JPG, PNG, HEIC) or a PDF.' } as const
  if (file!.size > MAX) return { error: 'That photo is too large — please take it again a little further away, or choose a smaller file.' } as const
  return { number, expiry, file: { data: Buffer.from(await file!.arrayBuffer()), mimetype: file!.type, name: file!.name || 'wwcc.jpg', size: file!.size } } as const
}

