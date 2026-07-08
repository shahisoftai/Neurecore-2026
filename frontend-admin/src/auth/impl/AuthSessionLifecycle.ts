// ─── impl/AuthSessionLifecycle.ts ─────────────────────────────────────────────
// SRP: The ONLY place that can atomically kill a session.
// 1. clear cookies (ITokenRepository.clearTokens)
// 2. clear the user store (IUserRepository.clearUser)
// 3. emit SESSION_KILLED on the local event bus
// 4. broadcast over BroadcastChannel for cross-tab sync

import type {
  IAuthSessionLifecycle,
  ITokenRepository,
  IUserRepository,
  IAuthEventBus,
  SessionKillReason,
  SessionKilledEvent,
} from '../core/interfaces';

const BROADCAST_CHANNEL_NAME = 'neurecore-auth';

export class AuthSessionLifecycle implements IAuthSessionLifecycle {
  private listeners = new Set<(event: SessionKilledEvent) => void>();

  constructor(
    private readonly tokenRepository: ITokenRepository,
    private readonly userRepository: IUserRepository,
    private readonly eventBus: IAuthEventBus,
  ) {}

  killSession(reason: SessionKillReason): void {
    // 1. Clear cookies first (idempotent — no-op if no cookies).
    this.tokenRepository.clearTokens();
    // 2. Clear the user store.
    this.userRepository.clearUser();

    const event: SessionKilledEvent = {
      reason,
      timestamp: Date.now(),
    };

    // 3. Cross-tab: BroadcastChannel (only in the browser).
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        channel.postMessage({ type: 'SESSION_KILLED', reason, timestamp: event.timestamp });
        channel.close();
      } catch {
        /* BroadcastChannel is best-effort */
      }
    }

    // 4. Same-tab subscribers (socket disconnect, analytics, etc.).
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        /* never break the kill chain */
      }
    }
    this.eventBus.emit({ type: 'SESSION_KILLED', reason, timestamp: event.timestamp });
  }

  onSessionKilled(listener: (event: SessionKilledEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
