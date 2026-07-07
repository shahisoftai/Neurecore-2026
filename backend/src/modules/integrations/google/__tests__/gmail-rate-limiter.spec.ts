import { withGoogleRetry, GoogleApiError, RetryOptions } from '../gmail-rate-limiter';

function mockResponse(overrides: {
  ok?: boolean;
  status?: number;
  headers?: { get: jest.Mock };
  text?: jest.Mock;
  json?: jest.Mock;
} = {}): Response {
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    headers: overrides.headers ?? { get: jest.fn().mockReturnValue(null) as never },
    text: overrides.text ?? jest.fn().mockResolvedValue(''),
    json: overrides.json ?? jest.fn().mockResolvedValue({}),
  } as unknown as Response;
}

let randomSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
  jest.useRealTimers();
  randomSpy.mockRestore();
});

describe('GoogleApiError', () => {
  it('extends Error with status and body properties', () => {
    const err = new GoogleApiError(429, 'rate limit exceeded');

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('GoogleApiError');
    expect(err.status).toBe(429);
    expect(err.body).toBe('rate limit exceeded');
    expect(err.message).toContain('429');
    expect(err.message).toContain('rate limit exceeded');
  });
});

describe('withGoogleRetry', () => {
  it('returns parsed result on first success', async () => {
    const fetcher = jest.fn().mockResolvedValue(mockResponse({ ok: true }));
    const parser = jest.fn().mockResolvedValue('parsed-data');

    const result = await withGoogleRetry(fetcher, parser);

    expect(result).toBe('parsed-data');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retries on HTTP 429 (Too Many Requests) — 2 attempts then success', async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce(mockResponse({ ok: false, status: 429 }))
      .mockResolvedValueOnce(mockResponse({ ok: true }));
    const parser = jest.fn().mockResolvedValue('parsed-data');

    const promise = withGoogleRetry(fetcher, parser);
    await jest.runAllTimersAsync();

    const result = await promise;
    expect(result).toBe('parsed-data');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('retries on HTTP 5xx — 2 attempts then success', async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce(mockResponse({ ok: false, status: 503 }))
      .mockResolvedValueOnce(mockResponse({ ok: true }));
    const parser = jest.fn().mockResolvedValue('parsed-data');

    const promise = withGoogleRetry(fetcher, parser);
    await jest.runAllTimersAsync();

    const result = await promise;
    expect(result).toBe('parsed-data');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('throws GoogleApiError after exhausting maxAttempts (4) on 429s', async () => {
    const errorText = jest.fn().mockResolvedValue('quota exceeded');
    const fetcher = jest.fn().mockResolvedValue(
      mockResponse({ ok: false, status: 429, text: errorText }),
    );
    const parser = jest.fn();

    const promise = withGoogleRetry(fetcher, parser);
    const catcher = promise.catch((e: any) => e);
    await jest.runAllTimersAsync();

    const err = await catcher as GoogleApiError;
    expect(err).toBeInstanceOf(GoogleApiError);
    expect(err.status).toBe(429);
    expect(err.body).toBe('quota exceeded');
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('throws GoogleApiError immediately on non-retryable 4xx (e.g. 400)', async () => {
    const errorText = jest.fn().mockResolvedValue('bad request');
    const fetcher = jest.fn().mockResolvedValue(
      mockResponse({ ok: false, status: 400, text: errorText }),
    );
    const parser = jest.fn();

    const err: any = await withGoogleRetry(fetcher, parser).catch(
      (e: any) => e,
    );

    expect(err).toBeInstanceOf(GoogleApiError);
    expect(err.status).toBe(400);
    expect(err.body).toBe('bad request');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retries on network errors (fetch throws)', async () => {
    const fetcher = jest.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(mockResponse({ ok: true }));
    const parser = jest.fn().mockResolvedValue('recovered');

    const promise = withGoogleRetry(fetcher, parser);
    await jest.runAllTimersAsync();

    const result = await promise;
    expect(result).toBe('recovered');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('uses Retry-After header value when present in 429 response', async () => {
    const retryHeaders = {
      get: jest.fn((name: string) => (name === 'retry-after' ? '2' : null)),
    };
    const fetcher = jest.fn()
      .mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 429,
          headers: retryHeaders as unknown as { get: jest.Mock },
        }),
      )
      .mockResolvedValueOnce(mockResponse({ ok: true }));
    const parser = jest.fn().mockResolvedValue('parsed-data');

    const promise = withGoogleRetry(fetcher, parser);
    await jest.runAllTimersAsync();

    const result = await promise;
    expect(result).toBe('parsed-data');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('respects custom RetryOptions (maxAttempts=2, baseMs=10)', async () => {
    const opts: RetryOptions = { maxAttempts: 2, baseMs: 10 };
    const fetcher = jest.fn()
      .mockResolvedValueOnce(mockResponse({ ok: false, status: 429 }))
      .mockResolvedValueOnce(mockResponse({ ok: true }));
    const parser = jest.fn().mockResolvedValue('parsed-data');

    const promise = withGoogleRetry(fetcher, parser, opts);
    await jest.runAllTimersAsync();

    const result = await promise;
    expect(result).toBe('parsed-data');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
