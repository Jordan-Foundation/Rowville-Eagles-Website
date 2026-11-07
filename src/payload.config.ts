import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Participants } from './collections/Participants'
import { Teams } from './collections/Teams'
import { Programs } from './collections/Programs'
import { Bookings } from './collections/Bookings'
import { Posts } from './collections/Posts'
import { Sponsors } from './collections/Sponsors'
import { Products } from './collections/Products'
import { Orders } from './collections/Orders'
import { TrialSessions } from './collections/TrialSessions'
import { SelectionEntries } from './selections/collections/SelectionEntries'
import { SelectionRounds } from './selections/collections/SelectionRounds'
import { Squads } from './selections/collections/Squads'
import { resendAdapter } from '@payloadcms/email-resend'
import { InviteTokens } from './collections/InviteTokens'
import { ConsentRecords } from './collections/ConsentRecords'
import { MessageLog } from './collections/MessageLog'
import { AcademyTerms } from './academy/collections/AcademyTerms'
import { AcademyCoaches } from './academy/collections/AcademyCoaches'
import { AcademyAvailability } from './academy/collections/AcademyAvailability'
import { AcademyReminderLog } from './academy/collections/AcademyReminderLog'
import { AcademyBookings } from './academy/collections/AcademyBookings'
import { AcademySessions } from './academy/collections/AcademySessions'
import { AcademyCredits } from './academy/collections/AcademyCredits'
import { SiteSettings } from './globals/SiteSettings'
import { About } from './globals/About'
import { AcademySettings } from './academy/AcademySettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
const usePostgres = /^postgres(ql)?:\/\//.test(databaseUrl)

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: { titleSuffix: ' · Rowville Eagles Admin' },
    importMap: { baseDir: path.resolve(dirname) },
  },
  collections: [AcademyBookings, AcademySessions, AcademyTerms, AcademyCoaches, AcademyAvailability, AcademyReminderLog, AcademyCredits, Posts, SelectionRounds, Squads, SelectionEntries, TrialSessions, Programs, Bookings, Products, Orders, Teams, Sponsors, Participants, Users, ConsentRecords, MessageLog, InviteTokens, Media],
  globals: [SiteSettings, About, AcademySettings],
  editor: lexicalEditor(),
  ...(process.env.RESEND_API_KEY
    ? {
        email: resendAdapter({
          apiKey: process.env.RESEND_API_KEY,
          defaultFromAddress: process.env.EMAIL_DEFAULT_FROM_ADDRESS || 'hello@rowvilleeagles.com.au',
          defaultFromName: 'Rowville Eagles FC',
        }),
      }
    : {}),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  // Postgres (Neon) when DATABASE_URL is a postgres URL — production & previews. SQLite file for quick local dev.
  db: usePostgres
    ? postgresAdapter({
        pool: { connectionString: databaseUrl },
        migrationDir: path.resolve(dirname, 'migrations'),
        push: false, // schema changes ship as migrations (npm run migrate:create)
      })
    : sqliteAdapter({ client: { url: databaseUrl } }),
  sharp,
  plugins: [
    // Uploaded images go to Vercel Blob when configured (Vercel's filesystem is not persistent).
    vercelBlobStorage({
      enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      collections: { media: true },
      token: process.env.BLOB_READ_WRITE_TOKEN || '',
      // Upload straight from the browser to Blob — avoids Vercel's 4.5 MB request limit for large photos
      clientUploads: true,
    }),
  ],
})
