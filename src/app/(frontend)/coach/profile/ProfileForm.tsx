'use client'

import Image from 'next/image'
import { startTransition, useActionState, useState } from 'react'
import { Field, inputCls } from '@/components/forms/Field'
import { saveCoachProfile, type ProfileState } from './actions'

type Props = { displayName: string; bio: string; specialties: string[]; photoUrl: string | null; active: boolean }

/** Shrink to max 1200px JPEG in the browser so uploads are small and fast. */
async function resize(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
  return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file
}

export function ProfileForm(props: Props) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveCoachProfile, {})
  const [name, setName] = useState(props.displayName)
  const [bio, setBio] = useState(props.bio)
  const [specialties, setSpecialties] = useState(props.specialties.join(', '))
  const [preview, setPreview] = useState<string | null>(props.photoUrl)
  const [photo, setPhoto] = useState<File | null>(null)
  const tags = specialties.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6)

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          fd.delete('photo')
          if (photo) fd.set('photo', photo)
          startTransition(() => action(fd))
        }}
      >
        <Field label="Name shown to families">
          <input name="displayName" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
        </Field>
        <Field label="Photo" hint="A clear, friendly head-and-shoulders photo works best.">
          <input
            name="photo"
            type="file"
            accept="image/*"
            className="block w-full text-sm text-muted file:mr-4 file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              const small = await resize(f)
              setPhoto(small)
              setPreview(URL.createObjectURL(small))
            }}
          />
        </Field>
        <Field label={`Short bio (${bio.length}/400)`} hint="Your coaching background and what a session with you looks like.">
          <textarea name="bio" rows={5} maxLength={400} value={bio} onChange={(e) => setBio(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Specialties" hint="Up to 6, separated by commas — e.g. Finishing, Ball mastery, Goalkeeping, 1v1 attacking">
          <input name="specialties" value={specialties} onChange={(e) => setSpecialties(e.target.value)} className={inputCls} />
        </Field>
        {state.saved && !pending && <p role="status" className="border border-white/30 px-4 py-3 text-sm">Profile saved.</p>}
        {state.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>}
        <button type="submit" disabled={pending} className="bg-white px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-black hover:bg-white/85 disabled:opacity-50">
          {pending ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <aside>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-muted">How families see you</p>
        <div className="panel gloss-sheen overflow-hidden border border-line">
          <div className="relative aspect-[4/5] bg-surface-2">
            {preview ? (
              <Image src={preview} alt="" fill sizes="20rem" className="object-cover" unoptimized={preview.startsWith('blob:')} />
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted">No photo yet</div>
            )}
          </div>
          <div className="p-5">
            <p className="font-display text-2xl font-semibold uppercase">{name || 'Your name'}</p>
            <p className="mt-2 text-sm text-muted">{bio || 'Your bio appears here.'}</p>
            {tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {tags.map((t) => <span key={t} className="border border-line px-2 py-0.5 text-xs uppercase tracking-wider">{t}</span>)}
              </div>
            )}
          </div>
        </div>
        {!props.active && <p className="mt-3 text-xs text-muted">Hidden from families until an admin activates your profile.</p>}
      </aside>
    </div>
  )
}
