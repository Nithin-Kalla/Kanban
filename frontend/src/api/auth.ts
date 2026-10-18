import { api } from './client'
import type { AuthUser, Session } from './types'

export type Credentials = {
  username: string
  password: string
}

export const register = async (credentials: Credentials): Promise<Session> => {
  const { data } = await api.post<Session>('/auth/register', credentials)
  return data
}

export const login = async (credentials: Credentials): Promise<Session> => {
  const { data } = await api.post<Session>('/auth/login', credentials)
  return data
}

/** Confirms a stored token is still good. The 401 interceptor clears it if not. */
export const me = async (): Promise<AuthUser> => {
  const { data } = await api.get<{ user: AuthUser }>('/auth/me')
  return data.user
}
