import { api } from './client'

/**
 * Cheapest possible round trip to the API.
 *
 * The path is `/ready`, not `/health`: EasyPrivacy's `||onrender.com/health`
 * rule means Brave and uBlock block that path outright on this host, so the
 * request would never be sent at all.
 *
 * Its real job isn't the answer — it's being sent early. On a free-tier host
 * the instance sleeps after inactivity, and the first request is what wakes
 * it. Firing this on page load means the ~30–50s wake overlaps with the user
 * reading the page and typing, instead of starting when they hit Sign in.
 */
export const ping = async (): Promise<void> => {
  await api.get('/ready')
}
