import { useEffect, useState } from 'react'
import { useIsFetching, useIsMutating, useQuery } from '@tanstack/react-query'
import { ping } from '../api/health'

/** How long a request may take before we assume the host is asleep. */
const SLOW_AFTER_MS = 2500

/**
 * Wakes the API on load, and reports when the app is waiting on a slow one.
 *
 * The signal is "something has been in flight for a while", not "the initial
 * ping is pending" — one mechanism covering two separate cases: the cold start
 * on first load, and the host going back to sleep mid-session after a quiet
 * stretch.
 *
 * It needs no production check. A local API answers in milliseconds, so the
 * threshold is never crossed and the banner never appears.
 */
export function useServerWake() {
  // Retries forever with backoff: a sleeping host refuses connections or
  // answers 502 for the first few seconds, and giving up would strand the
  // user on a dead page.
  const { isSuccess } = useQuery({
    queryKey: ['health'],
    queryFn: ping,
    retry: Infinity,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const pending = useIsFetching() + useIsMutating() > 0

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

  return { slow: pending && slowSince !== null, since: slowSince, awake: isSuccess }
}
