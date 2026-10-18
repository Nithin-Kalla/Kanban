import { useEffect, useState } from 'react'

/** Seconds since `since`, ticking once a second. */
function useElapsed(since: number | null) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (since === null) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [since])

  return since === null ? 0 : Math.floor((now - since) / 1000)
}

/**
 * Explains a long wait instead of leaving the user staring at a dead button.
 *
 * A counter rather than a spinner: on a free-tier host this takes up to a
 * minute, and a spinner that long reads as "broken" while a number climbing
 * reads as "working". Non-blocking by design — the request they already made
 * is queued and will go through the moment the host is up.
 */
export function ServerWakeBanner({ since }: { since: number | null }) {
  const seconds = useElapsed(since)

  return (
    <div className="wake-banner" role="status" aria-live="polite">
      <span className="wake-spinner" aria-hidden="true" />
      <span>
        <strong>Waking the server…</strong>{' '}
        <span className="muted">
          The free tier sleeps after 15 minutes idle; the first request can take
          up to a minute. Nothing is lost — it will go through.
        </span>
      </span>
      <span className="wake-elapsed">{seconds}s</span>
    </div>
  )
}
