import axios from 'axios'
import { currentToken, useAuthStore } from '../auth/store'

/**
 * Where the API lives.
 *
 * Baked in at build time from VITE_API_URL — Vite substitutes it into the
 * bundle, so a deployed build points at the deployed API while a local one
 * falls back to the dev server. There is no runtime lookup; rebuilding is what
 * changes it.
 */
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

/**
 * The API client every request goes through.
 *
 * Carrying the token in an interceptor rather than at each call site means
 * it's read fresh per request — a login, a logout, or a token replaced in
 * another tab all take effect on the next call with no wiring.
 */
export const api = axios.create({ baseURL: API_BASE })

api.interceptors.request.use((config) => {
  const token = currentToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // A 401 while holding a token means it expired or was revoked: drop it so
    // the app falls back to the sign-in screen instead of looping on failed
    // requests. A 401 with no token is just a failed login — leave it alone.
    if (error.response?.status === 401 && currentToken()) {
      useAuthStore.getState().signOut()
    }
    return Promise.reject(error)
  },
)

/**
 * Turns an axios failure into the message the server sent.
 *
 * The API answers errors as `{ error: string }`, which is far more useful on
 * screen than axios's own "Request failed with status code 409".
 */
export const errorMessage = (error: unknown, fallback = 'Something went wrong'): string => {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { error?: string } | undefined
    return body?.error ?? error.message
  }
  return error instanceof Error ? error.message : fallback
}

/**
 * Carried by every board mutation. The socket id lets the server leave us out
 * of the broadcast — we apply our own changes locally. It's undefined until
 * the connection is established, which is harmless: the write still lands, we
 * just get our own event echoed back, and the cache helpers are idempotent.
 */
export type WithSocket = { socketId?: string }

/** A mutation's args as a caller supplies them; the socket id is filled in for them. */
export type Sent<A> = Omit<A, 'socketId'>
