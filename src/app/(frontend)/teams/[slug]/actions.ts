'use server'

import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { blastNotice, teamAccess, teamTitle } from '@/teams/service'
import { sendEmail } from '@/lib/email'
import { emailLayout, esc } from '@/lib/email-templates'
import { siteUrl } from '@/lib/payments'
import type { ForumThread, Team, User } from '@/payload-types'

export type TeamState = { error?: string; done?: string }

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()

async function gate(fd: FormData, need: 'view' | 'manage') {
  const user = await currentUser()
  if (!user) return { error: 'Please log in again.' } as const
  const p = await payload()
  const team = (await p.find({ collection: 'teams', where: { slug: { equals: s(fd, 'slug') } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as Team | undefined
  if (!team) return { error: 'Team not found.' } as const
  const access = await teamAccess(p, user, team)
  if (!access[need]) return { error: need === 'manage' ? 'Only this team’s coaches and admins can do that.' : 'You don’t have access to this team.' } as const
  return { p, user, team, access } as const
}
const done = (team: Team, msg: string): TeamState => {
  revalidatePath(`/teams/${team.slug}`)
  return { done: msg }
}

// ── Notice board (coaches/admins) ────────────────────────────────────────────

export async function saveNotice(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const g = await gate(fd, 'manage')
  if ('error' in g) return { error: g.error }
  const { p, user, team } = g
  const title = s(fd, 'title').slice(0, 140)
  const body = s(fd, 'body').slice(0, 5000)
  if (!title || !body) return { error: 'Add a title and a message.' }
  const id = Number(fd.get('id')) || null
  const send = fd.get('send') === 'on'
  if (id) {
    const existing = await p.findByID({ collection: 'team-posts', id, depth: 0, overrideAccess: true, disableErrors: true })
    if (!existing || (typeof existing.team === 'object' ? existing.team.id : existing.team) !== team.id) return { error: 'Notice not found.' }
  }
  const post = id
    ? await p.update({ collection: 'team-posts', id, overrideAccess: true, data: { title, body, pinned: fd.get('pinned') === 'on', editedAt: new Date().toISOString() } })
    : await p.create({ collection: 'team-posts', overrideAccess: true, data: { team: team.id, title, body, pinned: fd.get('pinned') === 'on', author: user.id } })
  const sent = send ? await blastNotice(p, team, post, user) : 0
  return done(team, `${id ? 'Notice updated' : 'Notice posted'}${send ? ` and sent to ${sent} famil${sent === 1 ? 'y' : 'ies'} (email${process.env.TWILIO_ACCOUNT_SID ? ' + text' : ''}).` : '.'}`)
}

export async function noticeAction(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const g = await gate(fd, 'manage')
  if ('error' in g) return { error: g.error }
  const post = await g.p.findByID({ collection: 'team-posts', id: Number(fd.get('id')), depth: 0, overrideAccess: true, disableErrors: true })
  if (!post || (typeof post.team === 'object' ? post.team.id : post.team) !== g.team.id) return { error: 'Notice not found.' }
  if (fd.get('op') === 'delete') {
    await g.p.delete({ collection: 'team-posts', id: post.id, overrideAccess: true })
    return done(g.team, 'Notice deleted.')
  }
  await g.p.update({ collection: 'team-posts', id: post.id, overrideAccess: true, data: { pinned: !post.pinned } })
  return done(g.team, post.pinned ? 'Unpinned.' : 'Pinned to the top.')
}

// ── Training & fixtures (coaches/admins) ─────────────────────────────────────

export async function saveTraining(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const g = await gate(fd, 'manage')
  if ('error' in g) return { error: g.error }
  const days = fd.getAll('day').map(String)
  const rows = days
    .map((day, i) => ({ day, start: String(fd.getAll('start')[i] ?? ''), end: String(fd.getAll('end')[i] ?? ''), location: String(fd.getAll('location')[i] ?? '').trim() }))
    .filter((r) => r.day && r.start)
  if (rows.some((r) => !TIME.test(r.start) || (r.end && !TIME.test(r.end)))) return { error: 'Use 24-hour times, e.g. 17:00.' }
  await g.p.update({
    collection: 'teams',
    id: g.team.id,
    overrideAccess: true,
    data: { training: rows as Team['training'], trainingChangedAt: new Date().toISOString() },
  })
  return done(g.team, 'Training updated — families will see it highlighted.')
}

export async function saveFixture(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const g = await gate(fd, 'manage')
  if ('error' in g) return { error: g.error }
  const fixtures = [...(g.team.fixtures ?? [])]
  const op = s(fd, 'op')
  const idx = fixtures.findIndex((f) => f.id === s(fd, 'fixtureId'))
  if (op === 'delete' && idx >= 0) fixtures.splice(idx, 1)
  else if (op === 'result' && idx >= 0) fixtures[idx] = { ...fixtures[idx], result: s(fd, 'result') || null }
  else if (op === 'add') {
    const date = s(fd, 'date')
    const time = s(fd, 'time') || '09:00'
    if (!date || !s(fd, 'opponent')) return { error: 'Add the date and opponent.' }
    const { localToUtc } = await import('@/lib/time')
    fixtures.push({ startsAt: localToUtc(date, time).toISOString(), opponent: s(fd, 'opponent'), venue: s(fd, 'venue') || null })
  } else return { error: 'Nothing to change.' }
  fixtures.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  await g.p.update({ collection: 'teams', id: g.team.id, overrideAccess: true, data: { fixtures } })
  return done(g.team, 'Fixtures updated.')
}

// ── Parent forum (members + coaches) ─────────────────────────────────────────

const name = (u: User) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email

export async function newThread(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const g = await gate(fd, 'view')
  if ('error' in g) return { error: g.error }
  if (g.team.type === 'tournament' || g.team.sections?.forum === false) return { error: 'This team doesn’t have Team Chat.' }
  const title = s(fd, 'title').slice(0, 140)
  const body = s(fd, 'body').slice(0, 4000)
  if (!title || !body) return { error: 'Add a title and your question.' }
  await g.p.create({ collection: 'forum-threads', overrideAccess: true, data: { team: g.team.id, title, body, author: g.user.id, lastActivityAt: new Date().toISOString() } })
  return done(g.team, 'Posted — coaches will answer here.')
}

export async function replyThread(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const g = await gate(fd, 'view')
  if ('error' in g) return { error: g.error }
  const thread = (await g.p.findByID({ collection: 'forum-threads', id: Number(fd.get('thread')), depth: 1, overrideAccess: true, disableErrors: true })) as ForumThread | null
  if (!thread || (typeof thread.team === 'object' ? thread.team.id : thread.team) !== g.team.id || thread.removedAt) return { error: 'Thread not found.' }
  if (thread.locked && !g.access.manage) return { error: 'This thread is locked.' }
  const body = s(fd, 'body').slice(0, 4000)
  if (!body) return { error: 'Write a reply first.' }
  await g.p.create({ collection: 'forum-replies', overrideAccess: true, data: { thread: thread.id, body, author: g.user.id } })
  await g.p.update({ collection: 'forum-threads', id: thread.id, overrideAccess: true, data: { lastActivityAt: new Date().toISOString() } })
  // Let the person who asked know when a coach answers
  const starter = typeof thread.author === 'object' ? (thread.author as User) : null
  if (g.access.manage && starter && starter.id !== g.user.id) {
    const brand = g.team.brand === 'academy' ? 'academy' : 'club'
    const html = emailLayout(brand, [
      {
        heading: 'A coach replied',
        intro: `${esc(name(g.user))} answered your question “${esc(thread.title)}” on the ${esc(teamTitle(g.team))} Team Chat:<br><br>${esc(body).replace(/\n/g, '<br>')}`,
        cta: { label: 'Open Team Chat', href: `${siteUrl()}/teams/${g.team.slug}#team-chat` },
      },
    ])
    await sendEmail(g.p, { to: starter.email, subject: `Reply: ${thread.title}`, html, sender: brand, userId: starter.id })
  }
  return done(g.team, 'Reply posted.')
}

export async function moderate(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const g = await gate(fd, 'manage')
  if ('error' in g) return { error: g.error }
  const op = s(fd, 'op')
  const now = new Date().toISOString()
  if (op === 'remove-reply') {
    const reply = await g.p.findByID({ collection: 'forum-replies', id: Number(fd.get('id')), depth: 1, overrideAccess: true, disableErrors: true })
    const replyTeam = reply && typeof reply.thread === 'object' ? (typeof reply.thread.team === 'object' ? reply.thread.team.id : reply.thread.team) : null
    if (!reply || replyTeam !== g.team.id) return { error: 'Reply not found.' }
    await g.p.update({ collection: 'forum-replies', id: reply.id, overrideAccess: true, data: { removedAt: now, removedBy: g.user.id } })
    return done(g.team, 'Reply removed.')
  }
  const thread = await g.p.findByID({ collection: 'forum-threads', id: Number(fd.get('id')), depth: 0, overrideAccess: true, disableErrors: true })
  if (!thread || (typeof thread.team === 'object' ? thread.team.id : thread.team) !== g.team.id) return { error: 'Thread not found.' }
  const data = op === 'pin' ? { pinned: !thread.pinned } : op === 'lock' ? { locked: !thread.locked } : op === 'remove' ? { removedAt: now, removedBy: g.user.id } : null
  if (!data) return { error: 'Unknown action.' }
  await g.p.update({ collection: 'forum-threads', id: thread.id, overrideAccess: true, data })
  return done(g.team, op === 'remove' ? 'Thread removed.' : 'Updated.')
}
