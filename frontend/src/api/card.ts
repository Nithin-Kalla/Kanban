import { api } from './client'
import type { WithSocket } from './client'
import type { Card } from './types'

export type MoveCardArgs = WithSocket & {
  cardId: string
  toColumnId: string
  toIndex: number
}

export const moveCard = async ({
  cardId,
  toColumnId,
  toIndex,
  socketId,
}: MoveCardArgs): Promise<void> => {
  await api.patch(`/card/${cardId}/move`, { toColumnId, toIndex, socketId })
}

export type CreateCardArgs = WithSocket & {
  columnId: string
  title: string
}

/** Resolves to the created card — the id and position are the server's to assign. */
export const createCard = async ({ columnId, title, socketId }: CreateCardArgs): Promise<Card> => {
  const { data } = await api.post<Card>(`/card`, { columnId, title, socketId })
  return data
}

export type UpdateCardArgs = WithSocket & {
  cardId: string
  title: string
}

export const updateCard = async ({ cardId, title, socketId }: UpdateCardArgs): Promise<void> => {
  await api.patch(`/card/${cardId}`, { title, socketId })
}

export type DeleteCardArgs = WithSocket & {
  cardId: string
}

export const deleteCard = async ({ cardId, socketId }: DeleteCardArgs): Promise<void> => {
  // A DELETE has no body, so the socket id goes in the query string. axios
  // drops the param entirely when it's undefined.
  await api.delete(`/card/${cardId}`, { params: { socketId } })
}
