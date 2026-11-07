import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import path from 'path'

export const alt = 'Foundation+ — online football training'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Share image using the official horizontal lockup (white on ink). */
export default async function OgImage() {
  const logo = await readFile(path.join(process.cwd(), 'public/brand/foundation-plus/foundation-plus_horizontal_white.png'))
  const src = `data:image/png;base64,${logo.toString('base64')}`
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 90, background: '#0B0B0C', color: '#fff' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={700} height={185} alt="" />
        <div style={{ fontSize: 44, marginTop: 50, fontWeight: 700, fontStyle: 'italic' }}>LEVEL UP. EVERY DAY.</div>
        <div style={{ fontSize: 30, marginTop: 18, color: 'rgba(255,255,255,0.75)' }}>Drills · coach-checked video challenges · badges · leaderboards</div>
      </div>
    ),
    size,
  )
}
