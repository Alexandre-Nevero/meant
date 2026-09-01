import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/server'
import { AuthForm } from './auth-form'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const { data: session } = await auth.getSession()
  if (session?.user) redirect('/dashboard')

  return (
    <>
      <p className="m-meta">Sign in or create an account to continue.</p>
      <AuthForm />
    </>
  )
}
