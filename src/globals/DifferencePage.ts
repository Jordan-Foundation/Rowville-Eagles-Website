import type { Field, GlobalConfig } from 'payload'
import { refreshGlobal } from '../lib/revalidate'
import { isStaff } from '../access'
import { DIFFERENCE as D } from '../content/difference'

const text = (name: string, def: string, label?: string, area = false): Field => (area ? { name, label, type: 'textarea', defaultValue: def } : { name, label, type: 'text', defaultValue: def })
const img = (name: string, description: string): Field => ({ name, type: 'upload', relationTo: 'media', admin: { description } })
const section = (name: string, label: string, s: { nav: string; headline: string; body: string; more?: string }, extra: Field[] = []): Field => ({
  type: 'collapsible',
  label,
  admin: { initCollapsed: true },
  fields: [
    {
      name,
      type: 'group',
      label: false,
      fields: [
        { type: 'row', fields: [text('nav', s.nav, 'Jump-link label'), text('headline', s.headline, 'Headline')] },
        text('body', s.body, 'Short copy (2–4 lines)', true),
        ...(s.more !== undefined ? [text('more', s.more, '“Learn more” detail', true)] : []),
        ...extra,
      ],
    },
  ],
})

/** "What Makes Us Different" page copy and photos. Layout and graphics are in code; words are here. */
export const DifferencePage: GlobalConfig = {
  slug: 'difference-page',
  label: 'What Makes Us Different',
  admin: { group: 'Club', description: 'Copy is pre-filled with a draft — check each section and add photos. Empty fields fall back to the draft.' },
  access: { read: () => true, update: isStaff },
  hooks: { afterChange: [refreshGlobal] },
  fields: [
    {
      type: 'collapsible',
      label: 'Hero',
      fields: [{ name: 'hero', type: 'group', label: false, fields: [text('title', D.hero.title, 'Title'), text('intro', D.hero.intro, 'Intro', true), img('image', 'Coaches with players — 2400×1350')] }],
    },
    section('coaches', 'a) Coaches', D.coaches, [img('image', 'Coach leading a session — 1600×1200')]),
    section('curriculum', 'b) Curriculum', D.curriculum, [
      { name: 'strands', type: 'array', defaultValue: D.curriculum.strands.map((x) => ({ ...x })), fields: [{ type: 'row', fields: [{ name: 'name', type: 'text', required: true }, { name: 'line', type: 'text' }] }] },
      img('image', 'Optional: players in a drill — 1600×1200'),
    ]),
    section('sessions', 'c) Lesson sequence', D.sessions, [
      text('lengths', D.sessions.lengths, 'Session lengths'),
      { name: 'stages', type: 'array', minRows: 5, maxRows: 5, defaultValue: D.sessions.stages.map((x) => ({ ...x })), fields: [{ type: 'row', fields: [{ name: 'name', type: 'text', required: true }, { name: 'line', type: 'text' }] }] },
    ]),
    section('reports', 'd) Player reports', D.reports, [img('image', 'Optional: your own sample report image (otherwise a built-in sample with made-up data is shown)')]),
    section('year', 'e) Year-round program', D.year, [
      text('sessionsPerYear', D.year.sessionsPerYear, 'Sessions per year'),
      { name: 'terms', type: 'array', minRows: 4, maxRows: 4, defaultValue: D.year.terms.map((x) => ({ ...x })), fields: [{ type: 'row', fields: [{ name: 'term', type: 'text' }, { name: 'months', type: 'text' }, { name: 'title', type: 'text' }] }, { name: 'detail', type: 'text' }] },
    ]),
    section('pathways', 'f) Two pathways', D.pathways, [img('image', 'Rowville team + RFA training — 1600×1200')]),
    section('community', 'g) Friday Community Night', D.community, [
      { type: 'row', fields: [text('when', D.community.when, 'When'), text('where', D.community.where, 'Where'), text('welcome', D.community.welcome, 'Welcome line')] },
      { name: 'photos', type: 'upload', relationTo: 'media', hasMany: true, maxRows: 4, admin: { description: '3–4 warm photos (dinner, music, the game) — 1200×1200 each. Only children with photo consent.' } },
    ]),
    section('fplus', 'h) Foundation+', D.fplus),
    { type: 'collapsible', label: 'Final call to action', fields: [{ name: 'cta', type: 'group', label: false, fields: [text('headline', D.cta.headline, 'Headline'), text('body', D.cta.body, 'Copy', true)] }] },
  ],
}
