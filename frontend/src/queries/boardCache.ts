import { useQueryClient } from '@tanstack/react-query'
import { boardQueryKey } from '../api/board'
import type { Board } from '../api/types'

/**
 * The three things every board mutation does to the query cache.
 *
 * Shared by the card and column mutations so they all treat the cached board
 * identically — and so the incoming-event path in `useBoardRealtime` writes
 * through the same door.
 */
export function useBoardCache(boardId: string) {
  const queryClient = useQueryClient()
  const boardKey = boardQueryKey(boardId)

  return {
    /** Rewrite the cached board, if there is one. */
    apply: (change: (board: Board) => Board) =>
      queryClient.setQueryData<Board>(boardKey, (current) => (current ? change(current) : current)),

    /** Stop an in-flight refetch from clobbering what we just wrote locally. */
    hold: () => queryClient.cancelQueries({ queryKey: boardKey }),

    /** Let the server have the last word on ordering and ids. */
    settle: () => queryClient.invalidateQueries({ queryKey: boardKey }),
  }
}
