import { HEARD_FROM } from '@/tracking/heard'
import { inputCls } from './Field'

/** Optional "How did you hear about us?" for booking forms. */
export function HeardFrom({ defaultValue }: { defaultValue?: string }) {
  return (
    <label className="block max-w-sm">
      <span className="mb-1.5 block text-sm font-medium">How did you hear about us? <span className="font-normal text-muted">(optional)</span></span>
      <select name="heardFrom" defaultValue={defaultValue ?? ''} className={inputCls}>
        <option value="">Choose…</option>
        {HEARD_FROM.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}
