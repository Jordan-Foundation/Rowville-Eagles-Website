import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import { hasRole } from '@/access'
import { loadPrices } from './prices-data'
import { PricesForm } from './PricesForm'

/** /admin/prices — every price on the site in one place, editable inline. */
export async function PricesView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult
  if (!req.user) redirect('/admin/login?redirect=%2Fadmin%2Fprices')
  const allowed = hasRole(req.user as never, 'admin', 'committee')
  const sections = allowed ? await loadPrices(req.payload) : []
  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={req.user ?? undefined}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <h1 style={{ marginTop: 24 }}>Prices</h1>
        <p style={{ color: 'var(--theme-elevation-600)', maxWidth: 760 }}>
          Every price families pay, in one place. Change any amount and press <strong>Save all changes</strong>. New prices apply to new bookings only — anything
          already paid or in a family’s checkout keeps its price. All amounts are AUD incl. GST.
        </p>
        {allowed ? <PricesForm sections={sections} /> : <p>Only admins and committee members can change prices.</p>}
      </Gutter>
    </DefaultTemplate>
  )
}
