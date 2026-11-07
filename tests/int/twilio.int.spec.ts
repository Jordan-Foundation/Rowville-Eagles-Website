import { describe, expect, it } from 'vitest'
import { dialTwiml, smsKeyword, twilioSignature, validTwilioSignature, voicemailTwiml } from '@/lib/twilio'

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
