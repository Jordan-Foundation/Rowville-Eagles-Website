import { redirect } from 'next/navigation'

/** /admin/prices moved to Management → Set prices (one page for all prices, in the site's own look). */
export async function PricesView() {
  redirect('/management/prices')
}
