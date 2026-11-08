import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import path from 'path'

export const alt = 'Rowville Eagles Football Club'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Default share image for every page that doesn't have its own: crest + club name on navy. */
export default async function OgImage() {
  const crest = await readFile(path.join(process.cwd(), 'public/brand/rowville-eagles-crest.png'))
  const src = `data:image/png;base64,${crest.toString('base64')}`
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 60, padding: 90, background: '#0f2a55', color: '#fff' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={300} height={360} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1 }}>ROWVILLE EAGLES</div>
          <div style={{ fontSize: 40, marginTop: 12, color: '#f2c94c' }}>Football Club · Est. 1985</div>
          <div style={{ fontSize: 30, marginTop: 40, color: 'rgba(255,255,255,0.8)' }}>MiniRoos · Juniors · Seniors · Foundation Academy</div>
        </div>
      </div>
    ),
    size,
  )
}
