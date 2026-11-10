'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { approveAnnouncement } from '@/academy/announcements'

const back = (id: number, msg: string, key: 'done' | 'error' = 'done') => redirect(`/management/announcements/${id}?${key}=${encodeURIComponent(msg)}`)
const s = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? '').trim().slice(0, max)

/** Save the wording (still waiting), approve & send now, or don't send. */
export async function announcementAction(fd: FormData) {
  const id = Number(fd.get('id'))
  const user = await managementOrNull()
  if (!user) return back(id, 'Management only.', 'error')
  const p = await payload()
  const edits = { subject: s(fd, 'subject', 200), message: s(fd, 'message', 4000), smsText: s(fd, 'smsText', 300) }
  if (!edits.subject || !edits.message) return back(id, 'The subject and message can’t be empty.', 'error')
  let msg: string
  try {
    switch (String(fd.get('do'))) {
      case 'approve': {
        const r = await approveAnnouncement(p, id, user.id, edits)
        msg = r ? `Sent — ${r.email.sent} email${r.email.sent === 1 ? '' : 's'} and ${r.sms.sent} text${r.sms.sent === 1 ? '' : 's'}${r.finished ? '' : ' so far (the rest go out shortly)'}. A reminder goes to families who haven’t registered in a week.` : 'Already sending.'
        break
      }
      case 'cancel':
        await p.update({ collection: 'announcements', id, data: { status: 'cancelled' }, overrideAccess: true })
        msg = 'Not sent.'
        break
      default:
        await p.update({ collection: 'announcements', id, data: edits, overrideAccess: true })
        msg = 'Saved.'
    }
  } catch (e) {
    return back(id, e instanceof Error ? e.message : 'Something went wrong.', 'error')
  }
  revalidatePath('/management/announcements')
  back(id, msg)
}
