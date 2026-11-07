import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import { hasRole } from '@/access'
import { setupChecklist } from '@/lib/setup-checklist'
import { SetupToggle } from './SetupToggle'

const ICON = { done: '✅', todo: '⬜', later: '⏸️' } as const

/** /admin/setup — what the owner still has to do (accounts, keys, content). */
export async function SetupView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult
  if (!req.user) redirect('/admin/login?redirect=%2Fadmin%2Fsetup')
  const allowed = hasRole(req.user as never, 'admin', 'committee')
  const ticked = allowed ? (((await req.payload.findGlobal({ slug: 'setup-progress', depth: 0, overrideAccess: true })).ticked as Record<string, boolean>) ?? {}) : {}
  const groups = allowed ? await setupChecklist(req.payload, ticked) : []
  const all = groups.flatMap((g) => g.items)
  const todo = all.filter((i) => i.status === 'todo').length
  const later = all.filter((i) => i.status === 'later').length
  return (
    <DefaultTemplate i18n={req.i18n} locale={locale} params={params} payload={req.payload} permissions={permissions} searchParams={searchParams} user={req.user ?? undefined} visibleEntities={visibleEntities}>
      <Gutter>
        <h1 style={{ marginTop: 24 }}>Setup checklist</h1>
        {!allowed ? (
          <p>Admins only.</p>
        ) : (
          <>
            <p style={{ color: 'var(--theme-elevation-600)', maxWidth: 820 }}>
              Things only you can do — accounts, keys and content. <strong>{todo} to do now</strong> · {later} for later · {all.length - todo - later} done. Items marked “auto” tick themselves
              when the setting or key is in place; tick the others yourself. Secret keys are never shown here, only whether they’re present.
            </p>
            {groups.map((g) => (
              <section key={g.title} style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 6, marginBottom: 24 }}>
                <h2 style={{ margin: 0, padding: '14px 20px', fontSize: 18, borderBottom: '1px solid var(--theme-elevation-150)' }}>{g.title}</h2>
                {g.items.map((i, n) => (
                  <div key={i.key} style={{ display: 'flex', gap: 14, padding: '12px 20px', borderTop: n ? '1px solid var(--theme-elevation-100)' : undefined, opacity: i.status === 'done' ? 0.6 : 1 }}>
                    <span style={{ fontSize: 18, lineHeight: '22px' }} aria-label={i.status}>{ICON[i.status]}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>
                        {i.href ? <a href={i.href}>{i.title}</a> : i.title}
                        {i.status === 'later' && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--theme-elevation-500)' }}>LATER</span>}
                        {i.note && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: i.status === 'done' ? 'var(--theme-success-500)' : 'var(--theme-warning-500, #b45309)' }}>{i.note}</span>}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--theme-elevation-600)', marginTop: 2, wordBreak: 'break-word' }}>{i.how}</div>
                    </div>
                    <div style={{ minWidth: 60, textAlign: 'right' }}>{i.auto ? <span style={{ fontSize: 11, color: 'var(--theme-elevation-500)' }}>auto</span> : <SetupToggle itemKey={i.key} done={i.status === 'done'} />}</div>
                  </div>
                ))}
              </section>
            ))}
          </>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}
