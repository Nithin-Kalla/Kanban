import { api } from './client'
import type { Board, BoardMember, BoardSummary } from './types'

/** Shared so the query cache is addressed identically everywhere. */
export const boardQueryKey = (id: string) => ['board', id] as const
export const boardsQueryKey = ['boards'] as const
export const membersQueryKey = (id: string) => ['board', id, 'members'] as const

/** Every board the signed-in user owns or has been added to. */
export const listBoards = async (): Promise<BoardSummary[]> => {
  const { data } = await api.get<{ boards: BoardSummary[] }>('/board')
  return data.boards
}

export const createBoard = async (name: string): Promise<BoardSummary> => {
  const { data } = await api.post<BoardSummary>('/board', { name })
  return data
}

export const getBoard = async (id: string): Promise<Board> => {
  const { data } = await api.get<Board>(`/board/${id}`)
  return data
}

export const listMembers = async (boardId: string): Promise<BoardMember[]> => {
  const { data } = await api.get<{ members: BoardMember[] }>(`/board/${boardId}/members`)
  return data.members
}

export type AddMemberArgs = {
  boardId: string
  username: string
}

/** Owner only — the server answers 403 for a member who tries. */
export const addMember = async ({ boardId, username }: AddMemberArgs): Promise<BoardMember> => {
  const { data } = await api.post<BoardMember>(`/board/${boardId}/members`, { username })
  return data
}
