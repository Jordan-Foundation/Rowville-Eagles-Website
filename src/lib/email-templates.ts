import { siteUrl } from './payments'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

type Block = { heading: string; intro: string; rows?: [string, string][]; cta?: { label: string; href: string }; after?: string }

/** Table-based, inline-styled layout that renders in Gmail/Outlook/Apple Mail. */
export function emailLayout(brand: 'club' | 'academy', blocks: Block[], footerNote?: string) {
  const a = brand === 'academy'
  const c = a
    ? { head: '#000000', bg: '#0b0b0c', card: '#141416', ink: '#ffffff', muted: '#a1a3a8', line: '#2a2a2e', btn: '#ffffff', btnInk: '#000000', logo: '/brand/rfa-logo-white.png', logoW: 120 }
    : { head: '#0f2a55', bg: '#f3f5f9', card: '#ffffff', ink: '#0d1424', muted: '#5b6577', line: '#e1e5ed', btn: '#f1cb22', btnInk: '#141000', logo: '/brand/rowville-eagles-crest.png', logoW: 56 }
  const base = siteUrl()
  const block = (b: Block) => `
    <tr><td style="padding:32px 32px 8px">
      <h1 style="margin:0 0 12px;font:700 24px/1.2 Arial,Helvetica,sans-serif;color:${c.ink};text-transform:uppercase;letter-spacing:.5px">${esc(b.heading)}</h1>
      <p style="margin:0;font:15px/1.6 Arial,Helvetica,sans-serif;color:${c.muted}">${b.intro}</p>
    </td></tr>
    ${b.rows?.length ? `<tr><td style="padding:16px 32px 0"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${c.line};border-radius:8px">
      ${b.rows.map(([k, v]) => `<tr><td style="padding:10px 16px;font:14px Arial,sans-serif;color:${c.muted};border-bottom:1px solid ${c.line}">${esc(k)}</td><td style="padding:10px 16px;font:bold 14px Arial,sans-serif;color:${c.ink};text-align:right;border-bottom:1px solid ${c.line}">${esc(v)}</td></tr>`).join('')}
    </table></td></tr>` : ''}
    ${b.cta ? `<tr><td style="padding:24px 32px 0"><a href="${b.cta.href}" style="display:inline-block;background:${c.btn};color:${c.btnInk};font:bold 15px Arial,sans-serif;text-decoration:none;padding:14px 26px;border-radius:${a ? '0' : '999px'};${a ? 'text-transform:uppercase;letter-spacing:2px;font-size:13px' : ''}">${esc(b.cta.label)}</a></td></tr>` : ''}
    ${b.after ? `<tr><td style="padding:16px 32px 0;font:14px/1.6 Arial,sans-serif;color:${c.muted}">${b.after}</td></tr>` : ''}
    <tr><td style="padding:0 32px 24px"></td></tr>`
  return `<!doctype html><html><body style="margin:0;background:${c.bg}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${c.bg};padding:24px 0"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${c.card};border-radius:12px;overflow:hidden">
    <tr><td style="background:${c.head};padding:24px 32px"><img src="${base}${c.logo}" width="${c.logoW}" alt="${a ? 'Rowville Foundation Academy' : 'Rowville Eagles FC'}" style="display:block;border:0"></td></tr>
    ${blocks.map(block).join(`<tr><td style="padding:0 32px"><hr style="border:0;border-top:1px solid ${c.line};margin:8px 0"></td></tr>`)}
    <tr><td style="padding:20px 32px;background:${c.head};font:12px/1.5 Arial,sans-serif;color:#ffffffaa">
      ${footerNote ? esc(footerNote) + '<br>' : ''}Rowville Eagles Football Club · 208 Dandelion Drive, Rowville VIC 3178 · <a href="${base}" style="color:#ffffffcc">${base.replace(/^https?:\/\//, '')}</a>
    </td></tr>
  </table></td></tr></table></body></html>`
}

/** The RFA promo block appended to club trial / EOI emails. */
export const rfaPromoBlock = (): Block => ({
  heading: 'Want more? Rowville Foundation Academy',
  intro:
    'Our elite development program runs alongside the club season: small groups, specialist coaches and an individual plan for every player. Book a trial night at the current term — places are limited per age group.',
  cta: { label: 'Book an RFA trial', href: `${siteUrl()}/academy/trial` },
})

export { esc }
