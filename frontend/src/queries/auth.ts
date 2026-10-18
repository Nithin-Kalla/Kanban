import { useMutation, useQueryClient } from '@tanstack/react-query'
import { login, register } from '../api/auth'
import type { Credentials } from '../api/auth'
import { useAuthStore } from '../auth/store'
import type { Session } from '../api/types'

/**
 * Register and login differ only in which endpoint they call: both answer with
 * a session, and both end by storing it.
 */
const useCredentials = (submit: (credentials: Credentials) => Promise<Session>) => {
  const queryClient = useQueryClient()
  const signIn = useAuthStore((state) => state.signIn)

  return useMutation({
    mutationFn: submit,
    onSuccess: (session) => {
      signIn(session)
      // The previous user's boards must not be shown to the next one.
      queryClient.clear()
    },
  })
}

export const useLogin = () => useCredentials(login)
export const useRegister = () => useCredentials(register)

/** Clears the session and every cached query belonging to it. */
export const useSignOut = () => {
  const queryClient = useQueryClient()
  const signOut = useAuthStore((state) => state.signOut)

  return () => {
    signOut()
    queryClient.clear()
  }
}
