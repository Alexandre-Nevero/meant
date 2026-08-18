import { auth } from '@clerk/nextjs/server'
import { SignInButton } from '@clerk/nextjs'
import { redirect } from 'next/navigation'

export default async function Home() {
  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  return (
    <p className="m-meta">
      Sign in to continue.{' '}
      <SignInButton>
        <button className="m-btn" data-variant="primary">
          Sign in
        </button>
      </SignInButton>
    </p>
  )
}
