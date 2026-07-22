/**
 * WS-6.1: Gmail / Google API exponential-backoff retry wrapper.
 *
 * Node 18+ built-in fetch returns a Response; transient errors do NOT throw with a
 * `.status` property. We must inspect the response status code directly. The
 * previous implementation read `err.status` which never fired.
 *
 * Usage:
 *   const data = await withGoogleRetry(
 *     () => fetch(url, { headers: { Authorization: `Bearer ${token}` }}),
 *     (res) => res.json(),
 *   );
 */
export class GoogleApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Google API error ${status}: ${body}`);
    this.name = 'GoogleApiError';
  }
}

export interface RetryOptions {
  maxAttempts?: number;
  baseMs?: number;
  maxDelayMs?: number;
}

export async function withGoogleRetry<T>(
  fetcher: () => Promise<Response>,
  parser: (res: Response) => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const { maxAttempts = 4, baseMs = 500, maxDelayMs = 8_000 } = opts;
  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let res: Response;
    try {
      res = await fetcher();
    } catch (networkErr) {
      if (attempt >= maxAttempts - 1) {
        throw new GoogleApiError(
          0,
          networkErr instanceof Error ? networkErr.message : 'network',
        );
      }
      await sleep(jittered(backoffMs(attempt, baseMs, maxDelayMs)));
      attempt++;
      continue;
    }

    if (res.ok) return parser(res);

    const status = res.status;
    const retryable = status === 429 || (status >= 500 && status < 600);
    if (!retryable || attempt >= maxAttempts - 1) {
      const body = await res.text().catch(() => 'unknown');
      throw new GoogleApiError(status, body);
    }

    const retryAfter = Number(res.headers.get('retry-after'));
    const baseDelay =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : backoffMs(attempt, baseMs, maxDelayMs);

    await sleep(jittered(baseDelay));
    attempt++;
  }
}

function backoffMs(
  attempt: number,
  baseMs: number,
  maxDelayMs: number,
): number {
  return Math.min(maxDelayMs, baseMs * 2 ** attempt);
}

function jittered(ms: number): number {
  return ms + Math.random() * 100;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
