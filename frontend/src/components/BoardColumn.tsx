import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Column } from '../api/types'
import { useAddCard } from '../queries/card'
import { SortableCard } from './SortableCard'

export function BoardColumn({ boardId, column }: { boardId: string; column: Column }) {
  // The column itself is a drop target so an empty column — which has no
  // sortable children to hover — can still receive a card.
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  const { mutate: addCard, isPending } = useAddCard(boardId)
  const [title, setTitle] = useState('')

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return

    addCard({ columnId: column.id, title: trimmed })
    // Cleared straight away so the next card can be typed without waiting for
    // the round trip; a failed create surfaces as the card never appearing.
    setTitle('')
  }

  return (
    <section className={`column${isOver ? ' is-over' : ''}`}>
      <header className="column-header">
        <h2 className="column-name">{column.name}</h2>
        <span className="column-count">{column.cards.length}</span>
      </header>

      <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="column-cards">
          {column.cards.map((card) => (
            <SortableCard key={card.id} boardId={boardId} card={card} />
          ))}
        </div>
      </SortableContext>

      <form className="column-footer row" onSubmit={submit}>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New card"
          aria-label={`New card in ${column.name}`}
        />
        <button type="submit" className="btn" disabled={isPending || !title.trim()}>
          Add
        </button>
      </form>
    </section>
  )
}
