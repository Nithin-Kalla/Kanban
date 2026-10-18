import { api } from './client'
import type { WithSocket } from './client'
import type { Column } from './types'

export type CreateColumnArgs = WithSocket & {
  boardId: string
  name: string
}

/** Resolves to the created column, which starts out holding no cards. */
export const createColumn = async ({
  boardId,
  name,
  socketId,
}: CreateColumnArgs): Promise<Omit<Column, 'cards'>> => {
  const { data } = await api.post<Omit<Column, 'cards'>>(`/column`, {
    boardId,
    name,
    socketId,
  })
  return data
}
