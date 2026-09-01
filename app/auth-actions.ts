'use server'

import { auth } from '@/lib/auth/server'
import { redirect } from 'next/navigation'

type State = { error: string } | null

export async function signIn(_prev: State, formData: FormData): Promise<State> {
  const { error } = await auth.signIn.email({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) return { error: error.message || 'Wrong email or password.' }
  redirect('/dashboard')
}

export async function signUp(_prev: State, formData: FormData): Promise<State> {
  const { error } = await auth.signUp.email({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    name: formData.get('name') as string,
  })
  if (error) return { error: error.message || 'Could not create an account.' }
  redirect('/dashboard')
}
