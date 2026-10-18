import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser, Session } from '../api/types'

type AuthState = {
  token: string | null
  user: AuthUser | null
  signIn: (session: Session) => void
  signOut: () => void
}

/**
 * The signed-in session.
 *
 * Persisted to localStorage so a refresh doesn't log you out — which matters
 * here, since testing the collaborative half means keeping two tabs open. The
 * tradeoff is the standard one for a token in a SPA: anything that can run
 * JavaScript on this origin can read it, so an XSS hole becomes a stolen
 * session. The alternative that doesn't have that property is an httpOnly
 * cookie, which needs CSRF protection instead.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      signIn: ({ token, user }) => set({ token, user }),
      signOut: () => set({ token: null, user: null }),
    }),
    { name: 'kanban-auth' },
  ),
)

/** Reads the current token outside React — for axios and the socket handshake. */
export const currentToken = () => useAuthStore.getState().token
