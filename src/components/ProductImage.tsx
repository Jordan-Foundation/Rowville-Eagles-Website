import Image from 'next/image'
import type { Media, Product } from '@/payload-types'
import { Crest, RfaLogo } from './Logos'

export function ProductImage({ product, className = '' }: { product: Product; className?: string }) {
  const img = product.images?.find((i): i is Media => typeof i === 'object')
  if (img?.url) {
    return <Image src={img.url} alt={img.alt} width={img.width ?? 800} height={img.height ?? 800} sizes="(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 100vw" className={`aspect-square w-full object-cover ${className}`} />
  }
  const academy = product.brand === 'academy'
  return (
    <div className={`grid aspect-square w-full place-items-center ${academy ? 'gloss' : 'pitch-lines bg-[#1d4888]'} ${className}`}>
      {academy ? <RfaLogo className="h-14 w-auto" ink="#fff" paper="#000" /> : <Crest className="h-28 w-auto" />}
    </div>
  )
}
