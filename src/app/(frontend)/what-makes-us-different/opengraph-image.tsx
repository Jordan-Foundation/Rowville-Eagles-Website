import { ImageResponse } from 'next/og'

export const alt = 'What makes Rowville different'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Share image for social posts (generated — no photo needed). */
export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: 'linear-gradient(135deg, #0f2a55, #1d4888)', color: '#fff' }}>
        <div style={{ fontSize: 28, letterSpacing: 6, textTransform: 'uppercase', color: '#f1cb22' }}>Rowville Eagles · Foundation Academy</div>
        <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1, marginTop: 24, textTransform: 'uppercase' }}>What makes us different</div>
        <div style={{ fontSize: 32, marginTop: 32, color: 'rgba(255,255,255,0.85)', maxWidth: 900 }}>Paid coaches · a real football curriculum · year-round program · Friday Community Night</div>
      </div>
    ),
    size,
  )
}
