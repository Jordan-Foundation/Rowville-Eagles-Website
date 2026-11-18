import Link from 'next/link'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { appPageMetadata, appViewer } from '@/lib/app-viewer'
import { APP } from '@/lib/app-brand'
import { APP_BENEFITS, appProgress } from '@/lib/app-install'
import { pushKeys } from '@/push/send'
import { InstallGuide } from '@/components/app/InstallGuide'

export const dynamic = 'force-dynamic'
export const generateMetadata = () => appPageMetadata({ title: 'Get the app', robots: { index: false } })

/** The install walkthrough: add the app to the home screen, then turn on notifications. */
export default async function GetTheAppPage() {
  const { user, brand } = await appViewer()
  if (!user) redirect('/login?next=/account/app')
  const p = await payload()
  const { publicKey } = await pushKeys(p)
  const progress = appProgress(user)
  const app = APP[brand]
  return (
    <div className="container-x max-w-3xl space-y-10 py-14" data-brand={brand === 'academy' ? 'academy' : undefined} data-page-brand={brand === 'academy' ? 'academy' : undefined}>
      <div>
        <Link href="/account" className="text-sm text-muted hover:text-ink">← My account</Link>
        <p className="eyebrow mt-6 !text-brand">Takes about a minute</p>
        <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Get the {app.name} app</h1>
        <ul className="mt-5 grid gap-2 text-sm text-muted sm:grid-cols-2">
          {APP_BENEFITS.map((b) => <li key={b}>✓ {b}</li>)}
        </ul>
      </div>
      <InstallGuide appName={app.name} icon={app.icon192} publicKey={publicKey} installed={progress.installed} pushBefore={progress.push} />
    </div>
  )
}
