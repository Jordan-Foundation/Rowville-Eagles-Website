'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { sendOwingEmail } from '@/imports/owing'

/** Send the registration payment email to the ticked players' families. */
export async function sendOwingAction(fd: FormData) {
  const back = '/management/players/owing'
  if (!(await managementOrNull())) redirect(`${back}?error=Management+only.`)
  const ids = fd.getAll('ids').map(Number).filter(Boolean)
  if (!ids.length) redirect(`${back}?error=${encodeURIComponent('Tick at least one player.')}`)
  const p = await payload()
  const failed: string[] = []
  for (const id of ids) await sendOwingEmail(p, id).catch((e) => failed.push(e instanceof Error ? e.message : String(id)))
  revalidatePath(back)
  redirect(`${back}?${failed.length ? `error=${encodeURIComponent(failed.join(' '))}` : `done=${encodeURIComponent(`Payment email sent for ${ids.length} player${ids.length === 1 ? '' : 's'}.`)}`}`)
}
