'use client'

import Image from 'next/image'
import { useState } from 'react'

type Photo = { url: string; alt: string; width: number; height: number }

/** Main photo with thumbnails underneath (tap to switch). */
export function ProductGallery({ photos, name }: { photos: Photo[]; name: string }) {
  const [i, setI] = useState(0)
  const main = photos[i] ?? photos[0]
  return (
    <div>
      <div className="overflow-hidden rounded-3xl">
        <Image src={main.url} alt={main.alt || name} width={main.width} height={main.height} sizes="(min-width: 1024px) 40vw, 100vw" preload={i === 0} className="aspect-square w-full object-cover" />
      </div>
      {photos.length > 1 && (
        <ul className="mt-3 grid grid-cols-5 gap-2" aria-label="More photos">
          {photos.map((ph, n) => (
            <li key={ph.url}>
              <button type="button" onClick={() => setI(n)} aria-label={`Photo ${n + 1} of ${photos.length}`} aria-pressed={n === i} className={`block overflow-hidden rounded-xl border-2 ${n === i ? 'border-ink' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                <Image src={ph.url} alt="" width={160} height={160} sizes="20vw" className="aspect-square w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
