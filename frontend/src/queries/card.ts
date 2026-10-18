import { useMutation } from '@tanstack/react-query'
import { createCard, deleteCard, moveCard, updateCard } from '../api/card'
import type { CreateCardArgs, DeleteCardArgs, MoveCardArgs, UpdateCardArgs } from '../api/card'
import type { Sent } from '../api/client'
import { addCardToBoard, removeCardFromBoard, renameCardInBoard } from '../boardOps'
import { socket } from '../realtime/socket'
import { useBoardCache } from './boardCache'

/**
 * Each mutation below writes the change into the query cache so it shows up
 * immediately, sends it to the server, and lets the server have the last word
 * once it settles. The server then broadcasts the same change to everyone else
 * in the room — `useBoardRealtime` applies those events through the very same
 * `boardOps` helpers, so a remote change and a local one take an identical
 * code path.
 *
 * `socket.id` goes out with every request so the server knows to leave us out
 * of that broadcast; we have already applied the change ourselves.
 */

export function useMoveCard(boardId: string) {
  const { hold, settle } = useBoardCache(boardId)

  return useMutation({
    mutationFn: (args: Sent<MoveCardArgs>) => moveCard({ ...args, socketId: socket.id }),
    // The cache was already updated during the drag, so there is nothing to
    // apply on success.
    onMutate: hold,
    onSettled: settle,
  })
}

export function useAddCard(boardId: string) {
  const { apply, settle } = useBoardCache(boardId)

  return useMutation({
    mutationFn: (args: Sent<CreateCardArgs>) => createCard({ ...args, socketId: socket.id }),
    // Nothing to show optimistically: the id and position are the server's to
    // assign, so the card only exists once it answers.
    onSuccess: (card, { columnId }) => apply((board) => addCardToBoard(board, columnId, card)),
    onSettled: settle,
  })
}

export function useRenameCard(boardId: string) {
  const { apply, hold, settle } = useBoardCache(boardId)

  return useMutation({
    mutationFn: (args: Sent<UpdateCardArgs>) => updateCard({ ...args, socketId: socket.id }),
    onMutate: async ({ cardId, title }) => {
      await hold()
      apply((board) => renameCardInBoard(board, cardId, title))
    },
    onSettled: settle,
  })
}

export function useRemoveCard(boardId: string) {
  const { apply, hold, settle } = useBoardCache(boardId)

  return useMutation({
    mutationFn: (args: Sent<DeleteCardArgs>) => deleteCard({ ...args, socketId: socket.id }),
    onMutate: async ({ cardId }) => {
      await hold()
      apply((board) => removeCardFromBoard(board, cardId))
    },
    onSettled: settle,
  })
}
