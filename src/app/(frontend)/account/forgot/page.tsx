import type { Metadata } from 'next'
import { ForgotForm } from './ForgotForm'

export const metadata: Metadata = { title: 'Forgot password', robots: { index: false } }

export default function ForgotPage() {
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-line p-8 sm:p-10">
        <h1 className="text-center font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase">Forgot password</h1>
        <div className="mt-8"><ForgotForm /></div>
      </div>
    </div>
  )
}
