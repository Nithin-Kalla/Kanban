import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { errorMessage } from '../api/client'
import { useAuthStore } from '../auth/store'
import { useBoards, useCreateBoard } from '../queries/board'
import { useSignOut } from '../queries/auth'

/** The boards you own or have been added to, and a form to start another. */
export function BoardList({ onOpen }: { onOpen: (boardId: string) => void }) {
  const username = useAuthStore((state) => state.user?.username)
  const signOut = useSignOut()

  const { data: boards, isPending, isError, error } = useBoards()
  const { mutate: createBoard, isPending: creating, isError: createFailed, error: createError } =
    useCreateBoard()

  const [name, setName] = useState('')

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    createBoard(trimmed)
    setName('')
  }

  return (
    <div className="page">
      <header className="row" style={{ gap: 12 }}>
        <h1 style={{ flex: 1, fontSize: 22 }}>Your boards</h1>
        <span className="small muted">{username}</span>
        <button type="button" className="btn btn-ghost" onClick={signOut}>
          Sign out
        </button>
      </header>

      {isPending ? <p className="muted">Loading…</p> : null}
      {isError ? <p className="error">{errorMessage(error)}</p> : null}

      {boards ? (
        <ul className="board-list">
          {boards.map((board) => (
            <li key={board.id}>
              <button type="button" className="board-link" onClick={() => onOpen(board.id)}>
                <span className="board-link-name">{board.name}</span>
                <span className="tag">{board.role}</span>
              </button>
            </li>
          ))}

          {boards.length === 0 ? (
            <li className="muted small">No boards yet — create your first one below.</li>
          ) : null}
        </ul>
      ) : null}

      <form className="row" onSubmit={submit}>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New board name"
          aria-label="New board name"
        />
        <button type="submit" className="btn btn-primary" disabled={creating || !name.trim()}>
          Create
        </button>
      </form>

      {createFailed ? (
        <p role="alert" className="error">
          {errorMessage(createError)}
        </p>
      ) : null}
    </div>
  )
}
