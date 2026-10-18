import { useEffect, useState } from 'react'
import { useIsFetching, useIsMutating, useQuery } from '@tanstack/react-query'
import { ping } from '../api/health'

/** How long a request may take before we assume the host is asleep. */
const SLOW_AFTER_MS = 2500

const HEALTH_KEY = ['health'] as const

/**
 * Wakes the API on load, and reports when the app is waiting on a slow one.
 *
 * The banner is driven by the requests the user is actually waiting on —
 * deliberately *not* including the warm-up ping. The ping is a side effect
 * whose only job is to be sent; whether it comes back is irrelevant, and an
 * ad blocker or extension refusing it must not leave a banner on screen
 * claiming the server is down while the board works perfectly.
 *
 * It needs no production check. A local API answers in milliseconds, so the
 * threshold is never crossed and the banner never appears.
 */
export function useServerWake() {
  // Fire-and-forget. A few retries cover a host that is still spinning up;
  // after that we stop, because nothing downstream depends on the answer.
  useQuery({
    queryKey: HEALTH_KEY,
    queryFn: ping,
    retry: 5,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    staleTime: Infinity,
    gcTime: Infinity,
  })

  // Everything except the ping: board loads, logins, card edits — the work a
  // person is sitting and waiting for.
  const fetching = useIsFetching({
    predicate: (query) => query.queryKey[0] !== HEALTH_KEY[0],
  })
  const pending = fetching + useIsMutating() > 0

  // When the current wait crossed the threshold, or null if it hasn't. Only
  // ever written from the timer callback and the cleanup — never synchronously
  // in the effect body, which would cascade a render every time this runs.
  const [slowSince, setSlowSince] = useState<number | null>(null)

  useEffect(() => {
    if (!pending) return

    const startedAt = Date.now()
    const timer = setTimeout(() => setSlowSince(startedAt), SLOW_AFTER_MS)

    return () => {
      clearTimeout(timer)
      setSlowSince(null)
    }
  }, [pending])

  return { slow: pending && slowSince !== null, since: slowSince }
}
