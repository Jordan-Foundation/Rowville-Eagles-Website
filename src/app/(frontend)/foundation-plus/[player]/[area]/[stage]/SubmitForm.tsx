'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { finishUploadAction, startUploadAction } from '../../../actions'

const field = 'w-full border border-line bg-black/40 px-3 py-2.5 text-sm'

export function SubmitForm(props: { player: number; stage: number; path: string; scored: boolean; unit: string; premium: boolean; feedbackLeft: number; canAttempt: string | null }) {
  const router = useRouter()
  const [type, setType] = useState<'verification' | 'feedback'>('verification')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(0)
  const [msg, setMsg] = useState<{ error?: string; done?: string }>({})

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file) return setMsg({ error: 'Choose or record a video first.' })
    setBusy(true)
    setMsg({})
    setPct(0)
    const fd = new FormData(e.currentTarget)
    fd.set('type', type)
    const start = await startUploadAction(fd)
    if (start.error || !start.uploadURL || !start.id) {
      setBusy(false)
      return setMsg({ error: start.error ?? 'Upload couldn’t start.' })
    }
    if (file.size > (start.maxMB ?? 200) * 1024 * 1024) {
      setBusy(false)
      return setMsg({ error: `That video is too big — the limit is ${start.maxMB} MB. Try a shorter clip.` })
    }
    // Straight to Cloudflare Stream (the file doesn't pass through our servers)
    const ok = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', start.uploadURL!)
      xhr.upload.onprogress = (ev) => ev.lengthComputable && setPct(Math.round((ev.loaded / ev.total) * 100))
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
      xhr.onerror = () => resolve(false)
      const body = new FormData()
      body.append('file', file)
      xhr.send(body)
    })
    if (!ok) {
      setBusy(false)
      return setMsg({ error: 'The upload didn’t finish — check your connection and try again.' })
    }
    await finishUploadAction(props.player, start.id, props.path)
    setBusy(false)
    setFile(null)
    setMsg({ done: type === 'feedback' ? 'Sent! A coach will send feedback soon.' : 'Sent! A coach will check it and you’ll get an email when it’s reviewed.' })
    router.refresh()
  }

  if (props.canAttempt) return <p className="text-sm text-muted">{props.canAttempt}</p>
  return (
    <form onSubmit={submit} className="space-y-4">
      {props.premium && (
        <div className="flex flex-wrap gap-2 text-sm" role="radiogroup" aria-label="Type of video">
          {(['verification', 'feedback'] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)} className={`border px-3 py-1.5 ${type === t ? 'border-white bg-white text-black' : 'border-line'}`}>
              {t === 'verification' ? 'Challenge attempt' : `Feedback only (${props.feedbackLeft} left this month)`}
            </button>
          ))}
        </div>
      )}
      <input type="hidden" name="player" value={props.player} />
      <input type="hidden" name="stage" value={props.stage} />
      {type === 'verification' && props.scored && (
        <label className="block text-sm">
          Your score ({props.unit})
          <input name="score" type="number" inputMode="decimal" step="any" min={0} required className={`${field} mt-1 max-w-40`} />
        </label>
      )}
      <label className="block text-sm">
        Video
        <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm file:mr-3 file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black" />
        <span className="mt-1 block text-xs text-muted">Record on your phone or choose a clip. Only you, your parents and Academy coaches can see it.</span>
      </label>
      <label className="block text-sm">
        Note for the coach (optional)
        <textarea name="note" rows={2} maxLength={500} className={`${field} mt-1`} placeholder={type === 'feedback' ? 'What would you like feedback on?' : ''} />
      </label>
      {busy && (
        <div>
          <div className="h-2 w-full bg-white/10"><div className="h-full bg-white transition-all" style={{ width: `${pct}%` }} /></div>
          <p className="mt-1 text-xs text-muted">Uploading… {pct}%</p>
        </div>
      )}
      <button disabled={busy} className="bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-black disabled:opacity-50">
        {busy ? 'Uploading…' : type === 'feedback' ? 'Send for feedback' : 'Send my attempt'}
      </button>
      {msg.error && <p role="alert" className="text-sm text-red-300">{msg.error}</p>}
      {msg.done && <p role="status" className="text-sm text-emerald-300">{msg.done}</p>}
    </form>
  )
}
