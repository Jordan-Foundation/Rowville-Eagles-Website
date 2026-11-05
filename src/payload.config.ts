import { sqliteAdapter } from '@payloadcms/db-sqlite'
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
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: { titleSuffix: ' · Rowville Eagles Admin' },
    importMap: { baseDir: path.resolve(dirname) },
  },
  collections: [Posts, Programs, Bookings, Products, Orders, Teams, Sponsors, Participants, Users, Media],
  globals: [SiteSettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  // Local dev uses SQLite. Production swaps to @payloadcms/db-postgres (Neon/Supabase) — same schema.
  db: sqliteAdapter({ client: { url: process.env.DATABASE_URL || '' } }),
  sharp,
  plugins: [],
})
