/** Groq's free tier rate-limits by requests and tokens per minute. The spike broke on the
 *  first 429 and lost sessions to it; the eval waits and retries instead. Only 429, 5xx
 *  and network errors are retried — a 400 (e.g. a reply that failed the strict schema) is
 *  the production route's failure too, and retrying it here would measure a judge users
 *  never get. */
const BASE_MS = 2000
const MAX_BACKOFF_MS = 60_000
const MAX_RETRY_AFTER_MS = 120_000

/** Null means "longer than we are willing to wait" — the caller gives up on the call. */
export function retryDelayMs(attempt: number, retryAfter: string | null): number | null {
  const s = retryAfter === null ? NaN : Number(retryAfter)
  if (Number.isFinite(s)) {
    const ms = Math.ceil(s * 1000)
    return ms > MAX_RETRY_AFTER_MS ? null : ms
  }
  return Math.min(BASE_MS * 2 ** attempt, MAX_BACKOFF_MS)
}

const retryable = (status: number) => status === 429 || status >= 500

/** Returns the final Response (ok or not), or null if every attempt failed on the network. */
export async function fetchWithRetry(
  send: () => Promise<Response>,
  { tries = 6, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)) }: { tries?: number; sleep?: (ms: number) => Promise<unknown> } = {},
): Promise<Response | null> {
  let last: Response | null = null
  for (let attempt = 0; attempt < tries; attempt++) {
    let res: Response | null = null
    try {
      res = await send()
    } catch {
      res = null
    }
    if (res && !retryable(res.status)) return res
    last = res
    if (attempt === tries - 1) break
    const wait = retryDelayMs(attempt, res?.headers.get('retry-after') ?? null)
    if (wait === null) break
    await sleep(wait)
  }
  return last
}
