import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { errorMessage } from '../api/client'
import { useAddMember, useMembers } from '../queries/board'

/**
 * Who can see this board, and — for the owner — a way to add someone.
 *
 * The add form is hidden for members because the server refuses them with a
 * 403; showing a control that always fails would just be a trap. The server
 * check is the one that counts, this only keeps the UI honest.
 */
export function MembersPanel({ boardId, isOwner }: { boardId: string; isOwner: boolean }) {
  const { data: members } = useMembers(boardId)
  const { mutate: addMember, isPending, isError, error, reset } = useAddMember(boardId)
  const [username, setUsername] = useState('')

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = username.trim()
    if (!trimmed) return

    addMember({ username: trimmed }, { onSuccess: () => setUsername('') })
  }

  return (
    <>
      <span className="small muted">
        {members
          ? members
              .map((member) => `${member.username}${member.role === 'owner' ? ' (owner)' : ''}`)
              .join(' · ')
          : '…'}
      </span>

      {isOwner ? (
        <form className="row" onSubmit={submit}>
          <input
            className="input"
            style={{ width: 150 }}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              if (isError) reset()
            }}
            placeholder="Add by username"
            aria-label="Add a member by username"
          />
          <button type="submit" className="btn" disabled={isPending || !username.trim()}>
            Invite
          </button>
        </form>
      ) : null}

      {isError ? (
        <span role="alert" className="error">
          {errorMessage(error)}
        </span>
      ) : null}
    </>
  )
}
