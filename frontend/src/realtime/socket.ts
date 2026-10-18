import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import { API_BASE } from '../api/client'
import { currentToken } from '../auth/store'
import type { AuthUser, Card, Column } from '../api/types'

/**
 * Mirrors `BoardEvents` in backend/src/realtime/socket.ts — keep the two in
 * step. Every payload names its `boardId` so a listener can ignore a board it
 * is no longer looking at, and carries enough data to apply the change without
 * refetching the board.
 */
export type BoardEvents = {
  'card-moved': { boardId: string; cardId: string; toColumnId: string; toIndex: number }
  'card-created': { boardId: string; columnId: string; card: Card }
  'card-updated': { boardId: string; cardId: string; title: string }
  'card-deleted': { boardId: string; cardId: string }
  'column-created': { boardId: string; column: Omit<Column, 'cards'> }
  /**
   * Who is currently looking at the board — the full list every time, not
   * join/leave deltas, so a client that reconnects is immediately correct
   * instead of having to replay what it missed.
   */
  presence: { boardId: string; users: AuthUser[] }
}

/** What the server sends us: one listener signature per board event. */
type ServerToClient = { [E in keyof BoardEvents]: (payload: BoardEvents[E]) => void }

/** What we send the server — room management, nothing else. */
type ClientToServer = {
  'join-board': (boardId: string) => void
  'leave-board': (boardId: string) => void
}

/**
 * One shared connection for the whole app. `autoConnect: false` leaves the
 * opening to the hook that uses it, so the socket's lifetime follows the board
 * view rather than the module being imported.
 *
 * Typing it with both event maps is what lets `useBoardRealtime` register a
 * listener generically and still have the payload checked against the name.
 * `io()` itself isn't generic in socket.io-client 4.8, so the maps go on the
 * annotation.
 *
 * `auth` is the credentials slot Socket.IO carries through the handshake; the
 * server rejects a connection whose token doesn't verify. It has to be the
 * callback form, not a plain object: an object is evaluated once when this
 * module loads — before anyone has signed in — so it would send an empty
 * token forever, and a stale one after a re-login. The callback runs on every
 * connection attempt, reconnects included.
 */
export const socket: Socket<ServerToClient, ClientToServer> = io(API_BASE, {
  autoConnect: false,
  auth: (cb) => cb({ token: currentToken() ?? '' }),
})
