import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom refuses __Host-* cookies without Secure=true. Provide a helper that
// always sets cookies with Secure; path=/.
export function setHostCookie(name: string, value: string): void {
  document.cookie = `${name}=${value}; path=/; Secure`;
}

export function setHostCookies(map: Record<string, string>): void {
  for (const [k, v] of Object.entries(map)) {
    setHostCookie(k, v);
  }
}

export function clearAllHostCookies(): void {
  document.cookie = "";
}

// Make available globally for ergonomic test usage.
declare global {
  function setHostCookie(name: string, value: string): void;
  function setHostCookies(map: Record<string, string>): void;
  function clearAllHostCookies(): void;
}

(globalThis as unknown as { setHostCookie: typeof setHostCookie }).setHostCookie = setHostCookie;
(globalThis as unknown as { setHostCookies: typeof setHostCookies }).setHostCookies = setHostCookies;
(globalThis as unknown as { clearAllHostCookies: typeof clearAllHostCookies }).clearAllHostCookies = clearAllHostCookies;

vi.stubGlobal("setHostCookie", setHostCookie);
vi.stubGlobal("setHostCookies", setHostCookies);
vi.stubGlobal("clearAllHostCookies", clearAllHostCookies);
