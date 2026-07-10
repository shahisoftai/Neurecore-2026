import { io, Socket } from "socket.io-client";
import { cookieAuth } from "./cookieAuth";

const SOCKET_URL = (() => {
  if (typeof window === "undefined") return "http://127.0.0.1:3000";
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
})();

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token =
      typeof window !== "undefined" ? cookieAuth.access() : null;

    socket = io(SOCKET_URL, {
      auth: { token },
      withCredentials: true,
      // Polling-only — see FIX-022 / runbook §3.2 for the OLS WebSocket
      // upgrade rationale.
      transports: ["polling"],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(): void {
  getSocket().connect();
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
    socket = null;
  }
}
