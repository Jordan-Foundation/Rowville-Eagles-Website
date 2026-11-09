import { describe, expect, it } from 'vitest'
import { forWho, whoDoes } from '@/lib/setup-checklist'

describe('setup checklist: developer vs committee', () => {
  it('technical jobs go to the developer, the rest to the committee', () => {
    expect(['resend', 'stripe-club', 'twilio-webhooks', 'cron', 'db-pooled', 'stream'].map(whoDoes)).toEqual(Array(6).fill('developer'))
    expect(['policies', 'shop-photos', 'prices-reviewed', 'six-pillars', 'fplus-plans'].map(whoDoes)).toEqual(Array(5).fill('committee'))
  })
  it('drops empty groups', () => {
    const g = [{ title: 'Email', items: [{ key: 'resend', title: '', how: '', status: 'todo' as const, auto: true }] }, { title: 'Content', items: [{ key: 'policies', title: '', how: '', status: 'todo' as const, auto: true }] }]
    expect(forWho(g, 'committee').map((x) => x.title)).toEqual(['Content'])
  })
})
