import type { AuthUser } from '../api/types'

/**
 * Deterministic colour per user, so the same person is the same colour in
 * everyone's browser and across reloads. A hash of the id rather than a random
 * pick or a palette index, which would drift as people come and go.
 */
const hueOf = (id: string) => {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return hash
}

const initials = (username: string) => username.slice(0, 2).toUpperCase()

/** Who else is looking at this board right now. */
export function PresenceBar({ present, currentUserId }: { present: AuthUser[]; currentUserId?: string }) {
  // Your own face is noise — you know you're here. What matters is everyone else.
  const others = present.filter((user) => user.id !== currentUserId)

  if (others.length === 0) {
    return <span className="small faint">Only you</span>
  }

  return (
    <span className="presence">
      {others.map((user) => {
        const hue = hueOf(user.id)
        return (
          <span
            key={user.id}
            className="avatar"
            title={`${user.username} is viewing this board`}
            aria-label={`${user.username} is viewing this board`}
            style={{
              background: `hsl(${hue} 65% 88%)`,
              color: `hsl(${hue} 55% 27%)`,
            }}
          >
            {initials(user.username)}
          </span>
        )
      })}
    </span>
  )
}
