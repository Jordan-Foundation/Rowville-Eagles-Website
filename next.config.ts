import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  experimental: {
    // Branded 404 for addresses that match no page (the app has two root layouts: website and admin)
    globalNotFound: true,
    // Coach profile photos are resized in the browser first; this leaves headroom for the form data
    serverActions: { bodySizeLimit: '3mb' },
  },
  async headers() {
    // The offline helper must always be re-checked, and may only run the site's own code
    return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }, { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" }] }]
  },
  async redirects() {
    // Fixtures now live on each team's private page — old links go to the player portal (login first if needed)
    return [
      { source: '/fixtures', destination: '/account', permanent: true },
      { source: '/teams', destination: '/account', permanent: true },
      // "Staff" is now "Management" — old links in emails and bookmarks keep working
      { source: '/staff', destination: '/management', permanent: true },
      { source: '/staff/:path*', destination: '/management/:path*', permanent: true },
      // Old "register interest" address → the Join page
      { source: '/interest', destination: '/join', permanent: true },
    ]
  },
  images: {
    // Uploaded photos come straight from Vercel Blob storage
    remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }],
    formats: ['image/avif', 'image/webp'],
    localPatterns: [
      { pathname: '/api/media/file/**' },
      { pathname: '/brand/**' },
      { pathname: '/sponsors/**' },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
