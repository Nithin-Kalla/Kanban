import type { Board, Card, Column } from './api/types'

/** Id of the column currently holding `cardId`, or undefined if it holds none. */
export const columnIdOfCard = (board: Board, cardId: string): string | undefined =>
  board.columns.find((column) => column.cards.some((card) => card.id === cardId))?.id

/**
 * A drag can hover either a card or a column's empty space, so `overId` is one
 * of the two. Resolve it to the column being targeted either way.
 */
export const resolveColumnId = (board: Board, overId: string): string | undefined =>
  board.columns.some((column) => column.id === overId)
    ? overId
    : columnIdOfCard(board, overId)

export const indexOfCard = (board: Board, columnId: string, cardId: string): number =>
  board.columns.find((c) => c.id === columnId)?.cards.findIndex((c) => c.id === cardId) ?? -1

/**
 * Returns a new board with `cardId` placed at `toIndex` of `toColumnId`.
 *
 * Purely positional — `position` fields are left untouched, since the server is
 * what assigns them. The UI only ever reads array order.
 */
export const moveCardInBoard = (
  board: Board,
  cardId: string,
  toColumnId: string,
  toIndex: number,
): Board => {
  const fromColumnId = columnIdOfCard(board, cardId)
  if (!fromColumnId) return board

  const card = board.columns
    .find((c) => c.id === fromColumnId)!
    .cards.find((c) => c.id === cardId)!

  // Remove first, then insert, so a same-column move indexes into the list the
  // card is already absent from — matching how the server splices it.
  const withoutCard = board.columns.map((column) =>
    column.id === fromColumnId
      ? { ...column, cards: column.cards.filter((c) => c.id !== cardId) }
      : column,
  )

  return {
    ...board,
    columns: withoutCard.map((column) => {
      if (column.id !== toColumnId) return column
      const cards = [...column.cards]
      cards.splice(Math.min(Math.max(toIndex, 0), cards.length), 0, card)
      return { ...column, cards }
    }),
  }
}

/**
 * Appends `card` to `columnId`, matching where the server puts a new card.
 *
 * Idempotent: a card already on the board is left alone, so the creator's own
 * write and a refetch that lands on top of it can't produce a duplicate.
 */
export const addCardToBoard = (board: Board, columnId: string, card: Card): Board =>
  columnIdOfCard(board, card.id)
    ? board
    : {
        ...board,
        columns: board.columns.map((column) =>
          column.id === columnId ? { ...column, cards: [...column.cards, card] } : column,
        ),
      }

/** Drops `cardId` from whichever column holds it. */
export const removeCardFromBoard = (board: Board, cardId: string): Board => ({
  ...board,
  columns: board.columns.map((column) =>
    column.cards.some((c) => c.id === cardId)
      ? { ...column, cards: column.cards.filter((c) => c.id !== cardId) }
      : column,
  ),
})

/** Retitles `cardId` in place, leaving its position alone. */
export const renameCardInBoard = (board: Board, cardId: string, title: string): Board => ({
  ...board,
  columns: board.columns.map((column) =>
    column.cards.some((c) => c.id === cardId)
      ? {
          ...column,
          cards: column.cards.map((card) => (card.id === cardId ? { ...card, title } : card)),
        }
      : column,
  ),
})

/**
 * Appends a new, empty column. Idempotent for the same reason
 * `addCardToBoard` is.
 */
export const addColumnToBoard = (board: Board, column: Omit<Column, 'cards'>): Board =>
  board.columns.some((c) => c.id === column.id)
    ? board
    : { ...board, columns: [...board.columns, { ...column, cards: [] }] }
