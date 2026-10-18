export type Card = {
  id: string
  title: string
  position: number
}

export type Column = {
  id: string
  name: string
  position: number
  cards: Card[]
}

export type Board = {
  id: string
  name: string
  createdAt: string
  ownerId: string
  columns: Column[]
}

/** A board as it appears in the list — no columns, plus the caller's role. */
export type BoardSummary = {
  id: string
  name: string
  createdAt: string
  ownerId: string
  role: BoardRole
}

export type BoardRole = 'owner' | 'member'

export type AuthUser = {
  id: string
  username: string
}

/** What register and login return. */
export type Session = {
  token: string
  user: AuthUser
}

export type BoardMember = AuthUser & { role: BoardRole }
