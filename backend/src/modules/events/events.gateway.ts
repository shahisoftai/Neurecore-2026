import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { CookieAuthService, ACCESS_TOKEN_COOKIE } from '../../common/auth/cookie-auth.service';

/**
 * EventsGateway — Phase 9 update (Auth Hardening).
 *
 * Token extraction priority for Socket.IO handshakes:
 *   1. `__Host-nc_at` cookie (browser sends it automatically when
 *      `withCredentials: true` is set on the client AND the server has
 *      `credentials: true` in the CORS config).
 *   2. `handshake.auth.token` (CLI / server-to-server / legacy clients).
 *   3. `Authorization: Bearer` header in handshake.
 *
 * Per `EAOS-implementation-roadmap.md` §13 task 9.6.
 *
 * Phase 10 cleanup (task 10.11): the `userId` / `tenantId` attached to the
 * socket at handshake time are now typed via a module-local SocketData
 * interface instead of `(client as any).userId` casts.
 */

interface AuthedSocketData {
  userId?: string;
  tenantId?: string | null;
}

type AuthedSocket = Socket & AuthedSocketData;
@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly cookieAuth: CookieAuthService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractSocketToken(client);

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = this.jwt.verify<{
        sub: string;
        tenantId?: string | null;
        jti: string;
      }>(token, { secret: this.config.get<string>('JWT_SECRET') });

      // Check blacklist
      if (await this.redis.isTokenBlacklisted(payload.jti)) {
        client.disconnect(true);
        return;
      }

      // Attach user data to socket
      const authed = client as AuthedSocket;
      authed.userId = payload.sub;
      authed.tenantId = payload.tenantId;

      // Join user and tenant rooms
      await client.join(`user:${payload.sub}`);
      if (payload.tenantId) {
        await client.join(`tenant:${payload.tenantId}`);
      }

      // Track socket IDs per user
      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub)!.add(client.id);

      this.logger.debug(`Client connected: ${client.id} user=${payload.sub}`);
    } catch {
      this.logger.warn(`Rejected unauthenticated connection: ${client.id}`);
      client.disconnect(true);
    }
  }

  /**
   * Extract JWT from the Socket.IO handshake. Cookie-first (Phase 9),
   * then explicit auth/header fallbacks.
   */
  private extractSocketToken(client: Socket): string | null {
    // 1. Cookie (Phase 9: httpOnly path — browser sends automatically when
    //    `withCredentials: true` is set on the client).
    if (this.cookieAuth.isEnabled()) {
      const cookieHeader = client.handshake.headers?.cookie;
      if (cookieHeader) {
        for (const piece of cookieHeader.split(';')) {
          const eq = piece.indexOf('=');
          if (eq < 0) continue;
          const name = piece.slice(0, eq).trim();
          if (name === ACCESS_TOKEN_COOKIE) {
            const value = piece.slice(eq + 1).trim();
            if (value) return decodeURIComponent(value);
          }
        }
      }
    }

    // 2. Explicit handshake.auth.token (server-to-server, CLI, older clients).
    const explicit = client.handshake.auth?.token;
    if (typeof explicit === 'string' && explicit.length > 0) return explicit;

    // 3. Authorization: Bearer header (some clients send it).
    const authHeader = client.handshake.headers?.authorization;
    if (typeof authHeader === 'string') {
      const m = authHeader.match(/^Bearer\s+(.+)$/i);
      if (m) return m[1];
    }
    return null;
  }

  handleDisconnect(client: Socket): void {
    const authed = client as AuthedSocket;
    const userId = authed.userId;
    if (userId) {
      this.userSockets.get(userId)?.delete(client.id);
      if (this.userSockets.get(userId)?.size === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket): void {
    client.emit('pong', { timestamp: Date.now() });
  }

  // Emit to all sockets of a specific user
  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Emit to all sockets in a tenant room
  emitToTenant(tenantId: string, event: string, data: unknown): void {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }

  // ── Phase 2 typed helpers ──────────────────────────────────

  emitAgentStatusUpdated(
    tenantId: string,
    agentId: string,
    status: string,
  ): void {
    this.emitToTenant(tenantId, 'agent:status_updated', {
      agentId,
      status,
      timestamp: Date.now(),
    });
  }

  emitTaskStarted(tenantId: string, taskId: string, agentId: string): void {
    this.emitToTenant(tenantId, 'task:started', {
      taskId,
      agentId,
      timestamp: Date.now(),
    });
  }

  emitTaskCompleted(
    tenantId: string,
    taskId: string,
    agentId: string,
    success: boolean,
    error?: string,
  ): void {
    this.emitToTenant(tenantId, success ? 'task:completed' : 'task:failed', {
      taskId,
      agentId,
      success,
      error,
      timestamp: Date.now(),
    });
  }

  emitMemoryUpdated(tenantId: string, agentId: string, entryId: string): void {
    this.emitToTenant(tenantId, 'memory:updated', {
      agentId,
      entryId,
      timestamp: Date.now(),
    });
  }

  emitSystemAlert(
    tenantId: string,
    level: 'info' | 'warn' | 'error',
    message: string,
  ): void {
    this.emitToTenant(tenantId, 'system:alert', {
      level,
      message,
      timestamp: Date.now(),
    });
  }

  /** Emitted when an agent execution encounters an unrecoverable error */
  emitAgentError(
    tenantId: string,
    agentId: string,
    taskId: string | undefined,
    error: string,
  ): void {
    this.emitToTenant(tenantId, 'agent:error', {
      agentId,
      taskId,
      error,
      timestamp: Date.now(),
    });
  }

  /** Emitted when a workflow transitions to a new status */
  emitWorkflowStatusChanged(
    tenantId: string,
    workflowId: string,
    status: string,
  ): void {
    this.emitToTenant(tenantId, 'workflow:status_changed', {
      workflowId,
      status,
      timestamp: Date.now(),
    });
  }

  /** Emitted when a governance rule blocks or requires approval for a task */
  emitGovernanceTriggered(
    tenantId: string,
    agentId: string,
    decision: {
      allowed: boolean;
      triggeredRules: string[];
      requiresApproval: boolean;
    },
  ): void {
    this.emitToTenant(tenantId, 'governance:triggered', {
      agentId,
      ...decision,
      timestamp: Date.now(),
    });
  }
}
