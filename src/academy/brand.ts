/**
 * Sender identity for every message (Spam Act 2003: messages must identify the sender and how to contact them).
 * Foundation Academy is its own product run by Foundation Sports Australia; at Rowville it appears as RFA.
 */
export const academyBrand = {
  name: 'Foundation Academy',
  localName: 'Rowville Foundation Academy',
  legalName: 'Foundation Sports Australia Pty Ltd',
  abn: '51 685 528 143',
  phone: '0451 525 684',
  address: '208 Dandelion Drive, Rowville VIC 3178',
  email: process.env.ACADEMY_CONTACT_EMAIL || 'academy@rowvilleeagles.com.au',
  smsSignOff: '– Foundation Academy',
} as const

export const clubBrand = {
  name: 'Rowville Eagles Football Club',
  address: '208 Dandelion Drive, Rowville VIC 3178',
  email: process.env.CLUB_CONTACT_EMAIL || 'refc.secretary@outlook.com',
} as const

export type Brand = 'club' | 'academy'

/** One-line identity used in email footers and plain-text versions. */
export function senderIdentity(brand: Brand) {
  return brand === 'academy'
    ? `${academyBrand.name} — ${academyBrand.legalName} · ABN ${academyBrand.abn} · ${academyBrand.address} · ${academyBrand.phone} · ${academyBrand.email}`
    : `${clubBrand.name} · ${clubBrand.address} · ${clubBrand.email}`
}
