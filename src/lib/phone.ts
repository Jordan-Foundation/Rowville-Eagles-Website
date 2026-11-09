/** Australian phone numbers, shown and dialled the same way everywhere (pure — unit tested). */

const digits = (raw: string | null | undefined) => {
  let d = (raw ?? '').replace(/[^\d+]/g, '')
  if (d.startsWith('+61')) d = `0${d.slice(3)}`
  else if (/^61\d{9}$/.test(d)) d = `0${d.slice(2)}`
  return d.replace(/\+/g, '')
}

/** "0412 345 678", "03 9123 4567", "1300 123 456"; anything else is returned tidied but unchanged. */
export function formatPhone(raw: string | null | undefined) {
  const d = digits(raw)
  if (/^04\d{8}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
  if (/^0[2378]\d{8}$/.test(d)) return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`
  if (/^1[38]00\d{6}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
  return (raw ?? '').trim()
}

/** tel: / sms: target ("+61412345678"), or null when it isn't a phone number. */
export function dialable(raw: string | null | undefined) {
  const d = digits(raw)
  if (/^0[2-478]\d{8}$/.test(d)) return `+61${d.slice(1)}`
  if (/^1[38]00\d{6}$/.test(d)) return d
  return null
}

/** Mobiles only (can be texted). */
export const isMobile = (raw: string | null | undefined) => /^04\d{8}$/.test(digits(raw))
