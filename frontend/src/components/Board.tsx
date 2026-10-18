import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { boardQueryKey } from '../api/board'
import type { Board as BoardData } from '../api/types'
import { columnIdOfCard, moveCardInBoard, resolveColumnId } from '../boardOps'
import { useAuthStore } from '../auth/store'
import { useBoard } from '../queries/board'
import { useMoveCard } from '../queries/card'
import { useAddColumn } from '../queries/column'
import { useBoardRealtime } from '../realtime/useBoardRealtime'
import { BoardColumn } from './BoardColumn'
import { MembersPanel } from './MembersPanel'
import { PresenceBar } from './PresenceBar'

/** One board, with everything scoped to it: its data, its drags, its room. */
export function Board({ boardId, onBack }: { boardId: string; onBack: () => void }) {
  const queryClient = useQueryClient()
  const boardKey = boardQueryKey(boardId)

  const currentUserId = useAuthStore((state) => state.user?.id)
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [columnName, setColumnName] = useState('')

  // Must run before the early returns below — hooks can't be conditional.
  const { present } = useBoardRealtime(boardId)

  const { data: board, isPending, isError, error } = useBoard(boardId)
  const { mutate: persistMove } = useMoveCard(boardId)
  const { mutate: addColumn, isPending: addingColumn } = useAddColumn(boardId)

  const sensors = useSensors(
    // A small threshold keeps a plain click from registering as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (isPending) return <div className="page muted">Loading…</div>
  if (isError) return <div className="page error">{error.message}</div>

  const readBoard = () => queryClient.getQueryData<BoardData>(boardKey) ?? board

  /**
   * Where `overId` would place the dragged card inside `columnId`.
   *
   * The index is taken from the list *including* the dragged card, which is
   * what both `arrayMove` and the server's splice expect.
   */
  const dropIndex = (current: BoardData, columnId: string, overId: string) => {
    const cards = current.columns.find((c) => c.id === columnId)?.cards ?? []
    if (overId === columnId) return cards.length // dropped on column background
    return Math.max(
      cards.findIndex((c) => c.id === overId),
      0,
    )
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(String(event.active.id))
  }

  /**
   * Cross-column preview: as soon as the card hovers a different column, move
   * it there in the cache so it renders in its prospective home mid-drag.
   * Same-column reordering is left to drag end — dnd-kit animates that itself.
   */
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const current = readBoard()
    const activeId = String(active.id)
    const overColumnId = resolveColumnId(current, String(over.id))
    const activeColumnId = columnIdOfCard(current, activeId)

    if (!overColumnId || !activeColumnId || activeColumnId === overColumnId) return

    queryClient.setQueryData<BoardData>(
      boardKey,
      moveCardInBoard(current, activeId, overColumnId, dropIndex(current, overColumnId, String(over.id))),
    )
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveCardId(null)
    if (!over) return

    const current = readBoard()
    const activeId = String(active.id)
    const overColumnId = resolveColumnId(current, String(over.id))
    if (!overColumnId) return

    const toIndex = dropIndex(current, overColumnId, String(over.id))
    queryClient.setQueryData<BoardData>(
      boardKey,
      moveCardInBoard(current, activeId, overColumnId, toIndex),
    )

    persistMove({ cardId: activeId, toColumnId: overColumnId, toIndex })
  }

  const submitColumn = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = columnName.trim()
    if (!trimmed) return

    addColumn({ boardId, name: trimmed })
    setColumnName('')
  }

  const activeCard = activeCardId
    ? board.columns.flatMap((c) => c.cards).find((c) => c.id === activeCardId)
    : undefined

  const isOwner = board.ownerId === currentUserId

  return (
    <div className="board-page">
      <header className="board-header">
        <div className="board-header-main">
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            ← Boards
          </button>
          <h1 className="board-title">{board.name}</h1>
          <PresenceBar present={present} currentUserId={currentUserId} />
        </div>

        <div className="board-header-meta">
          <MembersPanel boardId={boardId} isOwner={isOwner} />
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveCardId(null)}
      >
        <div className="board-scroll">
          <div className="board">
            {board.columns.map((column) => (
              <BoardColumn key={column.id} boardId={boardId} column={column} />
            ))}

            <form className="column" onSubmit={submitColumn}>
              <header className="column-header">
                <h2 className="column-name">Add column</h2>
              </header>
              <div className="column-footer row" style={{ paddingTop: 0 }}>
                <input
                  className="input"
                  value={columnName}
                  onChange={(e) => setColumnName(e.target.value)}
                  placeholder="New column"
                  aria-label="New column name"
                />
                <button type="submit" className="btn" disabled={addingColumn || !columnName.trim()}>
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="card card-overlay">
              <span className="card-title">{activeCard.title}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
