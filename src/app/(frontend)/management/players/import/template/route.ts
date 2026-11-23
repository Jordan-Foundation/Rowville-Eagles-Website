import { managementOrNull } from '@/lib/management'
import { payload } from '@/lib/payload'
import { importContext } from '@/imports/run'
import { buildTemplate } from '@/imports/template'

/** "Download template": the player import spreadsheet, with today's team names and kit sizes in the dropdowns. */
export async function GET() {
  if (!(await managementOrNull())) return new Response('Unauthorised', { status: 401 })
  const ctx = await importContext(await payload())
  const file = await buildTemplate({ teams: [...ctx.teams.values()].sort(), sizes: ctx.sizes })
  return new Response(new Uint8Array(file), { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': 'attachment; filename="Existing-Players-Import-Template.xlsx"' } })
}
