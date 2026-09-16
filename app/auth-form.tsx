'use client'

import { useActionState } from 'react'
import { signIn, signUp } from './auth-actions'

function Fields() {
  return (
    <>
      <input className="m-field" name="email" type="email" placeholder="Email" required />
      <input className="m-field" name="password" type="password" placeholder="Password" required minLength={8} />
    </>
  )
}

export function AuthForm() {
  const [signInState, signInAction, signingIn] = useActionState(signIn, null)
  const [signUpState, signUpAction, signingUp] = useActionState(signUp, null)

  return (
    <>
      <form action={signInAction}>
        <Fields />
        <button className="m-btn" data-variant="primary" disabled={signingIn}>
          Sign in
        </button>
        {signInState?.error && <p className="m-meta" role="alert">{signInState.error}</p>}
      </form>

      <p className="m-meta">or</p>

      <form action={signUpAction}>
        <input className="m-field" name="name" type="text" placeholder="Name" required />
        <Fields />
        <button className="m-btn" data-variant="quiet" disabled={signingUp}>
          Create an account
        </button>
        {signUpState?.error && <p className="m-meta" role="alert">{signUpState.error}</p>}
      </form>
    </>
  )
}
