import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { boardQueryKey } from '../api/board'
import type { AuthUser, Board } from '../api/types'
import {
  addCardToBoard,
  addColumnToBoard,
  moveCardInBoard,
  removeCardFromBoard,
  renameCardInBoard,
} from '../boardOps'
import { socket } from './socket'
import type { BoardEvents } from './socket'

/**
 * Keeps this tab's board in sync with changes made by other people.
 *
 * Joins the board's room for as long as the view is mounted, and applies every
 * incoming event to the query cache — using the same `boardOps` helpers the
 * local mutations write through, so a remote change and a local one take the
 * identical code path.
 *
 * Returns who else is currently in the room. That one lives in component state
 * rather than the query cache: it is not the board, it is never fetched, and
 * it is only meaningful while this view is open.
 */
export function useBoardRealtime(boardId: string) {
  const queryClient = useQueryClient()
  const [present, setPresent] = useState<AuthUser[]>([])

  useEffect(() => {
    // Rooms are per-connection, and a reconnect is a *new* connection: for as
    // long as the socket was down this tab was not in the room, so every
    // broadcast in that window went undelivered and is never retried.
    // Re-joining restores the feed but not the gap, so the board is refetched
    // to resync — the one case where the full fetch is the cheap answer.
    //
    // Skipped on the very first connect, where the initial fetch is already
    // in flight.
    let reconnecting = false

    const onConnect = () => {
      socket.emit('join-board', boardId)

      if (reconnecting) {
        queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) })
      }
      reconnecting = true
    }

    /** Rewrite the cached board, if there is one. An event must never conjure
     *  a board that hasn't loaded — the normal fetch does that. */
    const apply = (change: (board: Board) => Board) =>
      queryClient.setQueryData<Board>(boardQueryKey(boardId), (current) =>
        current ? change(current) : current,
      )

    /**
     * Wraps a handler so it ignores events for a board we aren't looking at:
     * one connection can outlive a board switch.
     */
    const forThisBoard =
      <P extends { boardId: string }>(handle: (payload: P) => void) =>
      (payload: P) => {
        if (payload.boardId !== boardId) return
        handle(payload)
      }

    const onCardMoved = forThisBoard((e: BoardEvents['card-moved']) =>
      apply((board) => moveCardInBoard(board, e.cardId, e.toColumnId, e.toIndex)),
    )
    const onCardCreated = forThisBoard((e: BoardEvents['card-created']) =>
      apply((board) => addCardToBoard(board, e.columnId, e.card)),
    )
    const onCardUpdated = forThisBoard((e: BoardEvents['card-updated']) =>
      apply((board) => renameCardInBoard(board, e.cardId, e.title)),
    )
    const onCardDeleted = forThisBoard((e: BoardEvents['card-deleted']) =>
      apply((board) => removeCardFromBoard(board, e.cardId)),
    )
    const onColumnCreated = forThisBoard((e: BoardEvents['column-created']) =>
      apply((board) => addColumnToBoard(board, e.column)),
    )
    const onPresence = forThisBoard((e: BoardEvents['presence']) => setPresent(e.users))

    socket.on('connect', onConnect)
    socket.connect()

    // An already-open socket emits no 'connect' event, so join explicitly.
    if (socket.connected) onConnect()

    socket.on('card-moved', onCardMoved)
    socket.on('card-created', onCardCreated)
    socket.on('card-updated', onCardUpdated)
    socket.on('card-deleted', onCardDeleted)
    socket.on('column-created', onColumnCreated)
    socket.on('presence', onPresence)

    return () => {
      socket.emit('leave-board', boardId)

      // `off` only removes a listener given the same function reference `on`
      // got, which is why each one is a named const above.
      socket.off('connect', onConnect)
      socket.off('card-moved', onCardMoved)
      socket.off('card-created', onCardCreated)
      socket.off('card-updated', onCardUpdated)
      socket.off('card-deleted', onCardDeleted)
      socket.off('column-created', onColumnCreated)
      socket.off('presence', onPresence)

      socket.disconnect()
      // Leaving the board means we know nothing about who's on it any more —
      // keeping the old list would show stale faces on the next board.
      setPresent([])
    }
  }, [boardId, queryClient])

  return { present }
}
