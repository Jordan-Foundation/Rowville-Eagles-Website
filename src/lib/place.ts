/**
 * Where a program runs. A location without a street number (e.g. "Home ground") gets the club ground's address,
 * plus a Google Maps directions link.
 */
export function programPlace(location: string | null | undefined, groundAddress: string | null | undefined) {
  const hasAddress = Boolean(location && /\d/.test(location))
  const place = hasAddress ? location! : [location, groundAddress].filter(Boolean).join(' · ') || null
  const query = hasAddress ? location! : groundAddress || place
  return { place, directions: query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null }
}
