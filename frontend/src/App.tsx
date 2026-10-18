import { useState } from 'react'
import { useAuthStore } from './auth/store'
import { useServerWake } from './queries/health'
import { AuthPage } from './components/AuthPage'
import { Board } from './components/Board'
import { BoardList } from './components/BoardList'
import { ServerWakeBanner } from './components/ServerWakeBanner'

/**
 * Picks the screen: no token means sign in, no board picked means choose one,
 * otherwise show it.
 *
 * This is routing done by hand. Holding the selection in state instead of the
 * URL is what keeps the app router-free, and the price is real — a board isn't
 * linkable, the back button doesn't work, and a refresh drops you back to the
 * list. Swapping this for `/boards` and `/boards/:id` is the natural next step.
 */
function App() {
  const token = useAuthStore((state) => state.token)
  const [boardId, setBoardId] = useState<string | null>(null)

  // Fires a ping on load, so a sleeping host starts waking before the user
  // has typed anything, and reports when we're waiting on a slow request.
  const { slow, since } = useServerWake()

  // The 401 interceptor clears the token when it expires, which lands here and
  // returns the user to sign-in without any explicit redirect.
  const screen = !token ? (
    <AuthPage />
  ) : boardId ? (
    <Board boardId={boardId} onBack={() => setBoardId(null)} />
  ) : (
    <BoardList onOpen={setBoardId} />
  )

  return (
    <>
      {slow ? <ServerWakeBanner since={since} /> : null}
      {screen}
    </>
  )
}

export default App
