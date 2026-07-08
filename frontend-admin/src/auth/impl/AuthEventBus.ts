// ─── impl/AuthEventBus.ts ────────────────────────────────────────────────────
// SRP: Pub/sub for auth events. No store, no HTTP.

import type { IAuthEventBus, AuthEvent } from '../core/interfaces';

export class AuthEventBus implements IAuthEventBus {
  private listeners = new Set<(event: AuthEvent) => void>();

  emit(event: AuthEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        /* never let one bad listener break the others */
      }
    }
  }

  subscribe(listener: (event: AuthEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
