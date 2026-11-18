import { appManifest } from '@/lib/app-brand'

/** The Foundation Academy app's manifest (families whose players are Foundation Academy only). */
export const dynamic = 'force-static'
export function GET() {
  return new Response(JSON.stringify(appManifest('academy')), { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=3600' } })
}
