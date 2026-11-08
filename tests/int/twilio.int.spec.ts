import { describe, expect, it } from 'vitest'
import { dialTwiml, smsKeyword, twilioSignature, validTwilioSignature, voicemailTwiml } from '@/lib/twilio'
import { signatureUrls } from '@/lib/twilio-inbound'

describe('twilio', () => {
  // Example from Twilio's security docs
  const token = '12345'
  const url = 'https://mycompany.com/myapp.php?foo=1&bar=2'
  const params = { CallSid: 'CA1234567890ABCDE', Caller: '+12349013030', Digits: '1234', From: '+12349013030', To: '+18005551212' }
  it('signs requests the way Twilio does', () => {
    expect(twilioSignature(token, url, params)).toBe('0/KCTR6DLpKmkAf8muzZqo1nDgQ=')
  })
  it('accepts only matching signatures', () => {
    expect(validTwilioSignature(token, '0/KCTR6DLpKmkAf8muzZqo1nDgQ=', ['https://other.example/x', url], params)).toBe(true)
    expect(validTwilioSignature(token, '0/KCTR6DLpKmkAf8muzZqo1nDgQ=', [url], { ...params, Digits: '9999' })).toBe(false)
    expect(validTwilioSignature(token, null, [url], params)).toBe(false)
  })
  it('recognises STOP / START replies', () => {
    expect(smsKeyword(' stop ')).toBe('stop')
    expect(smsKeyword('Unsubscribe')).toBe('stop')
    expect(smsKeyword('START')).toBe('start')
    expect(smsKeyword('Can we stop at 5?')).toBeNull()
  })
  it('forwards calls with the caller’s number and falls back to voicemail', () => {
    expect(dialTwiml({ to: '+61451525684', callerId: '+61412345678', action: '/twilio/voice/after' })).toBe('<Dial callerId="+61412345678" timeout="20" action="/twilio/voice/after" method="POST"><Number>+61451525684</Number></Dial>')
    expect(voicemailTwiml({ greeting: 'Hi & welcome', action: '/d', transcribeCallback: '/t' })).toContain('Hi &amp; welcome')
  })
})


describe('webhook addresses Twilio may sign', () => {
  it('accepts the address with or without :443 (Twilio adds it on some follow-up requests)', () => {
    const urls = signatureUrls('https://club.vercel.app/twilio/voice/after', 'https://club.vercel.app', 'club.vercel.app')
    expect(urls).toContain('https://club.vercel.app/twilio/voice/after')
    expect(urls).toContain('https://club.vercel.app:443/twilio/voice/after')
    const params = { CallSid: 'CA1', DialCallStatus: 'no-answer' }
    const sig = twilioSignature('tok', 'https://club.vercel.app:443/twilio/voice/after', params)
    expect(validTwilioSignature('tok', sig, urls, params)).toBe(true)
    expect(validTwilioSignature('tok', sig, ['https://club.vercel.app/twilio/voice/after'], params)).toBe(false)
  })
})


describe('webhook address variants', () => {
  it('accepts an address entered with a trailing slash', () => {
    const urls = signatureUrls('https://club.vercel.app/twilio/voice', 'https://club.vercel.app', null)
    expect(urls).toContain('https://club.vercel.app/twilio/voice/')
    const withQuery = signatureUrls('https://club.vercel.app/twilio/voice?From=%2B61', 'https://club.vercel.app', null)
    expect(withQuery).toContain('https://club.vercel.app/twilio/voice/?From=%2B61')
  })
})

import { screenTwiml, spokenNumber } from '@/lib/twilio'

describe('call screening', () => {
  it('asks the person who picks up to press 1, so a phone voicemail can’t take the call', () => {
    expect(spokenNumber('+61412345678')).toBe('0 4 1 2 3 4 5 6 7 8')
    expect(spokenNumber('anonymous')).toBe('a private number')
    const x = screenTwiml({ from: '+61412345678', action: 'https://x/twilio/voice/screen' })
    expect(x).toContain('<Gather numDigits="1"')
    expect(x).toContain('Press 1 to take the call.')
    expect(x.endsWith('<Hangup/>')).toBe(true)
  })
})
