import { redirect } from 'next/navigation'

/** The Foundation+ figures now live in Management → Programs Overview → Foundation+. */
export async function FoundationPlusView() {
  redirect('/management/programs?program=foundation-plus')
}
