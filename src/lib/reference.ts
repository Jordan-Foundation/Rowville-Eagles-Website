import { randomBytes } from 'crypto'

/** Human-friendly unique reference, e.g. RFA-7K3QX9 (no ambiguous characters like 0/O, 1/I). */
export function makeReference(prefix: string) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return `${prefix}-${Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join('')}`
}
