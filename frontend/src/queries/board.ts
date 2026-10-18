import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addMember,
  boardQueryKey,
  boardsQueryKey,
  createBoard,
  getBoard,
  listBoards,
  listMembers,
  membersQueryKey,
} from '../api/board'
import type { AddMemberArgs } from '../api/board'
import type { BoardMember, BoardSummary } from '../api/types'

/** The board and everything on it — the one query the board view reads from. */
export function useBoard(boardId: string) {
  return useQuery({
    queryKey: boardQueryKey(boardId),
    queryFn: () => getBoard(boardId),
  })
}

/** Every board the signed-in user can open. */
export function useBoards() {
  return useQuery({
    queryKey: boardsQueryKey,
    queryFn: listBoards,
  })
}

export function useCreateBoard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createBoard,
    onSuccess: (board) =>
      queryClient.setQueryData<BoardSummary[]>(boardsQueryKey, (boards) => [
        ...(boards ?? []),
        board,
      ]),
  })
}

export function useMembers(boardId: string) {
  return useQuery({
    queryKey: membersQueryKey(boardId),
    queryFn: () => listMembers(boardId),
  })
}

export function useAddMember(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (args: Omit<AddMemberArgs, 'boardId'>) => addMember({ ...args, boardId }),
    onSuccess: (member) =>
      queryClient.setQueryData<BoardMember[]>(membersQueryKey(boardId), (members) => [
        ...(members ?? []),
        member,
      ]),
  })
}
