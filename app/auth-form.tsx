'use client'

import { useActionState } from 'react'
import { signIn, signUp } from './auth-actions'

/** #49. Five inputs, no labels, and two of them shared the placeholder "Email" — which is not
 *  a label, is announced inconsistently, and disappears exactly when the user is typing and
 *  needs it. The placeholders are gone rather than duplicated: at 3.20:1 they were under the
 *  contrast floor anyway. */
function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label>
      <span className="m-meta">{label}</span>
      <input className="m-field" {...props} />
    </label>
  )
}

function Fields() {
  return (
    <>
      <Field label="Email" name="email" type="email" required />
      <Field label="Password" name="password" type="password" required minLength={8} />
    </>
  )
}

export function AuthForm() {
  const [signInState, signInAction, signingIn] = useActionState(signIn, null)
  const [signUpState, signUpAction, signingUp] = useActionState(signUp, null)

  return (
    <>
      {/* Both forms carry the same two field labels, so the accessible name of the FORM is what
          tells them apart for anyone not reading the buttons. */}
      <form action={signInAction} aria-label="Sign in">
        <Fields />
        <button className="m-btn" data-variant="primary" disabled={signingIn}>
          Sign in
        </button>
        {signInState?.error && <p className="m-meta" role="alert">{signInState.error}</p>}
      </form>

      <p className="m-meta">or</p>

      <form action={signUpAction} aria-label="Create an account">
        <Field label="Name" name="name" type="text" required />
        <Fields />
        <button className="m-btn" data-variant="quiet" disabled={signingUp}>
          Create an account
        </button>
        {signUpState?.error && <p className="m-meta" role="alert">{signUpState.error}</p>}
      </form>
    </>
  )
}
