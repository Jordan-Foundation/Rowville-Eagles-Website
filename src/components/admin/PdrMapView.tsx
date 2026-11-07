import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import { hasRole } from '@/access'
import { criteriaSummary } from '@/academy/pdr/content'

const chip = (bg: string, fg: string): React.CSSProperties => ({ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color: fg })
const STATUS = {
  live: { label: 'Live', style: chip('#dcfce7', '#166534') },
  draft: { label: 'Written, hidden', style: chip('#e0e7ff', '#3730a3') },
  placeholder: { label: 'PLACEHOLDER', style: chip('#fef3c7', '#92400e') },
}

/** /admin/pdr — every area, level, stage and badge at a glance, with what still needs writing. */
export async function PdrMapView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult
  if (!req.user) redirect('/admin/login?redirect=%2Fadmin%2Fpdr')
  const allowed = hasRole(req.user as never, 'admin', 'committee', 'coach')
  const q = { depth: 0, overrideAccess: true, limit: 1000 } as const
  const [areas, levels, stages, badges] = allowed
    ? await Promise.all([
        req.payload.find({ collection: 'pdr-areas', sort: 'order', ...q }),
        req.payload.find({ collection: 'pdr-levels', sort: 'number', ...q }),
        req.payload.find({ collection: 'pdr-stages', sort: 'sortKey', ...q }),
        req.payload.find({ collection: 'pdr-badges', ...q }),
      ])
    : [{ docs: [] }, { docs: [] }, { docs: [] }, { docs: [] }]
  const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number))
  const live = stages.docs.filter((s) => s.published && !s.placeholder).length
  const todo = stages.docs.filter((s) => s.placeholder).length

  return (
    <DefaultTemplate i18n={req.i18n} locale={locale} params={params} payload={req.payload} permissions={permissions} searchParams={searchParams} user={req.user ?? undefined} visibleEntities={visibleEntities}>
      <Gutter>
        <h1 style={{ marginTop: 24 }}>Player Development — content map</h1>
        {!allowed ? (
          <p>Only staff can see this page.</p>
        ) : (
          <>
            <p style={{ color: 'var(--theme-elevation-600)', maxWidth: 820 }}>
              {live} of {stages.docs.length} stages are live · {todo} still <strong>PLACEHOLDER</strong>. Click any stage or badge to edit it. To add a level, create it under{' '}
              <a href="/admin/collections/pdr-levels/create">Levels</a> (its badge is created automatically), then add its stages under <a href="/admin/collections/pdr-stages/create">Stages</a>. Videos live in the{' '}
              <a href="/admin/collections/pdr-videos">Video library</a>.
            </p>
            {areas.docs.map((a) => {
              const lv = levels.docs.filter((l) => rel(l.area) === a.id)
              return (
                <section key={a.id} style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 6, marginBottom: 28, borderTop: `4px solid ${a.colour || 'var(--theme-elevation-300)'}` }}>
                  <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <h2 style={{ margin: 0, fontSize: 20 }}><a href={`/admin/collections/pdr-areas/${a.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{a.name}</a></h2>
                    <span style={{ fontSize: 13, color: 'var(--theme-elevation-600)' }}>{a.hasLeaderboard ? 'Leaderboard' : 'No leaderboard'} · {lv.length} levels</span>
                  </div>
                  {lv.map((l) => {
                    const st = stages.docs.filter((s) => rel(s.level) === l.id).sort((x, y) => x.stageNumber - y.stageNumber)
                    const badge = badges.docs.find((b) => rel(b.level) === l.id)
                    return (
                      <div key={l.id} style={{ borderTop: '1px solid var(--theme-elevation-100)', padding: '12px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                          <a href={`/admin/collections/pdr-levels/${l.id}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>Level {l.number}{l.title ? ` — ${l.title}` : ''}</a>
                          {badge ? (
                            <a href={`/admin/collections/pdr-badges/${badge.id}`} style={{ fontSize: 13, textDecoration: 'none' }}>
                              🏅 {badge.name} {badge.placeholder && <span style={STATUS.placeholder.style}>PLACEHOLDER</span>}
                            </a>
                          ) : (
                            <span style={{ fontSize: 13, color: 'var(--theme-error-500)' }}>No badge</span>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
                          {st.map((s) => {
                            const status = s.placeholder ? STATUS.placeholder : s.published ? STATUS.live : STATUS.draft
                            return (
                              <a key={s.id} href={`/admin/collections/pdr-stages/${s.id}`} style={{ display: 'block', padding: '10px 12px', border: '1px solid var(--theme-elevation-150)', borderRadius: 4, textDecoration: 'none', color: 'inherit' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                                  <strong>{s.code}</strong>
                                  <span style={status.style}>{status.label}</span>
                                </div>
                                <div style={{ fontSize: 13, marginTop: 4 }}>{s.placeholder ? <em style={{ color: 'var(--theme-elevation-500)' }}>Not written yet</em> : s.skillName}</div>
                                {!s.placeholder && (
                                  <div style={{ fontSize: 12, color: 'var(--theme-elevation-600)', marginTop: 2 }}>
                                    {s.scoring === 'judged' ? 'Judged by a coach' : criteriaSummary(s.criteria) || 'No pass criteria yet'}
                                    {!s.tutorialVideo || !s.demoVideo ? ' · videos missing' : ''}
                                  </div>
                                )}
                              </a>
                            )
                          })}
                          {st.length < 4 && <a href="/admin/collections/pdr-stages/create" style={{ padding: '10px 12px', border: '1px dashed var(--theme-elevation-250)', borderRadius: 4, fontSize: 13 }}>+ Add stage</a>}
                        </div>
                      </div>
                    )
                  })}
                </section>
              )
            })}
          </>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}
