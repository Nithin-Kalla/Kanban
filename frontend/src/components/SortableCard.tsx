import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Card } from '../api/types'
import { useRemoveCard, useRenameCard } from '../queries/card'

export function SortableCard({ boardId, card }: { boardId: string; card: Card }) {
  const { mutate: renameCard } = useRenameCard(boardId)
  const { mutate: removeCard } = useRemoveCard(boardId)

  // Non-null only while editing, and holds the in-progress text.
  const [draft, setDraft] = useState<string | null>(null)
  const editing = draft !== null

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    // A card being typed into is not a card being dragged.
    disabled: editing,
  })

  const commit = () => {
    const title = draft?.trim()
    if (title && title !== card.title) renameCard({ cardId: card.id, title })
    setDraft(null)
  }

  return (
    <div
      ref={setNodeRef}
      className={`card${editing ? ' is-editing' : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // Leave a hole where the card came from; DragOverlay renders the card
        // that follows the cursor.
        opacity: isDragging ? 0.4 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      {editing ? (
        <input
          autoFocus
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setDraft(null)
          }}
        />
      ) : (
        <>
          <span
            className="card-title"
            title="Double-click to rename"
            onDoubleClick={() => setDraft(card.title)}
          >
            {card.title}
          </span>
          <button
            type="button"
            className="btn-icon"
            aria-label={`Delete ${card.title}`}
            // The drag sensor listens on the card itself; without this the
            // press would be read as the start of a drag instead of a click.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => removeCard({ cardId: card.id })}
          >
            ×
          </button>
        </>
      )}
    </div>
  )
}
