/**
 * IThrottler
 * Strategy interface for request throttling.
 * OCP: swap implementations (in-memory, Redis sliding window, token bucket) without
 *      changing the consumers.
 */
export interface IThrottler {
  /** Returns true if the request is within the allowed rate */
  isAllowed(
    key: string,
    limitPerWindow: number,
    windowMs: number,
  ): Promise<boolean>;

  /** Returns the current request count in the window */
  count(key: string): Promise<number>;

  /** Penalise a key (e.g. block for duration after abuse detection) */
  penalise(key: string, blockMs: number): Promise<void>;
}

export const THROTTLER_SERVICE = Symbol('IThrottler');
