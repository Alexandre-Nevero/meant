import { redirect } from 'next/navigation'
import { currentUserId } from '@/lib/auth/session'
import { AuthForm } from '../auth-form'

export const dynamic = 'force-dynamic'

export default async function SignIn() {
  const userId = await currentUserId()
  if (userId) redirect('/dashboard')

  return (
    <main data-surface="pair">
      <p className="m-mark" data-state="ended" />
      <p className="m-meta">Sign in or create an account to continue.</p>
      <div className="m-landing-auth">
        <AuthForm />
      </div>
      <p className="m-meta">Chrome and Edge. No installer, no admin rights.</p>
    </main>
  )
}
