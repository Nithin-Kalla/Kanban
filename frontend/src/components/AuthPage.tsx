import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { errorMessage } from '../api/client'
import { useLogin, useRegister } from '../queries/auth'

/**
 * Sign in or create an account.
 *
 * One form for both: the fields are identical, so a toggle beats two screens
 * that would otherwise be copies of each other.
 */
export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const loginMutation = useLogin()
  const registerMutation = useRegister()
  const active = mode === 'login' ? loginMutation : registerMutation

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    active.mutate({ username: username.trim(), password })
  }

  const switchTo = (next: 'login' | 'register') => {
    setMode(next)
    // Drop the other form's failure, which no longer describes what's on screen.
    loginMutation.reset()
    registerMutation.reset()
  }

  return (
    <div className="page" style={{ maxWidth: 380 }}>
      <h1 style={{ fontSize: 22 }}>Kanban</h1>
      <p className="muted small" style={{ margin: '4px 0 0' }}>
        A collaborative board — changes appear live for everyone watching.
      </p>

      <div className="segmented">
        {(['login', 'register'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            onClick={() => switchTo(option)}
          >
            {option === 'login' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <form className="panel" onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <label className="field">
          <span className="small muted">Username</span>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="field">
          <span className="small muted">Password</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
          {mode === 'register' ? (
            <span className="small faint">
              Username 3+ characters, password 8+.
            </span>
          ) : null}
        </label>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={active.isPending || !username.trim() || !password}
        >
          {active.isPending ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        {active.isError ? (
          <div role="alert" className="error">
            {errorMessage(active.error)}
          </div>
        ) : null}
      </form>
    </div>
  )
}
