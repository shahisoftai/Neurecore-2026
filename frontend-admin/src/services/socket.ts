import { io, Socket } from "socket.io-client";
import { cookieAuth } from "./cookieAuth";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://127.0.0.1:3000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token =
      typeof window !== "undefined" ? cookieAuth.access() : null;

    socket = io(SOCKET_URL, {
      auth: { token },
      // Polling-only — see FIX-022 / runbook §3.2 for the OLS WebSocket
      // upgrade rationale.
      transports: ["polling"],
      upgrade: false,
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
