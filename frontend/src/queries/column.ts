import { useMutation } from '@tanstack/react-query'
import type { Sent } from '../api/client'
import { createColumn } from '../api/column'
import type { CreateColumnArgs } from '../api/column'
import { addColumnToBoard } from '../boardOps'
import { socket } from '../realtime/socket'
import { useBoardCache } from './boardCache'

export function useAddColumn(boardId: string) {
  const { apply, settle } = useBoardCache(boardId)

  return useMutation({
    mutationFn: (args: Sent<CreateColumnArgs>) => createColumn({ ...args, socketId: socket.id }),
    // Like adding a card: the server assigns the id and position, so there is
    // nothing to render until it answers.
    onSuccess: (column) => apply((board) => addColumnToBoard(board, column)),
    onSettled: settle,
  })
}
