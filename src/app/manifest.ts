import type { MetadataRoute } from 'next'
import { appManifest } from '@/lib/app-brand'

/** "Add to Home Screen": the Rowville Eagles app (Foundation Academy families get /manifest-academy.webmanifest). */
export default function manifest(): MetadataRoute.Manifest {
  return appManifest('eagles')
}
