/** Phone photos are shrunk in the browser (max 2000px JPEG) so they upload quickly and fit the upload limit. */
export async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 900_000) return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale)
    c.height = Math.round(bmp.height * scale)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.82))
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file
  } catch {
    return file
  }
}

/** Submit a form through a server action, shrinking any photo in the `field` file input first. */
export async function withShrunkPhoto(form: HTMLFormElement, field: string) {
  const fd = new FormData(form)
  const f = fd.get(field)
  if (f instanceof File && f.size > 0) fd.set(field, await shrinkPhoto(f))
  return fd
}
