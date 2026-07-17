import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateServiceIdentityDto } from './dto/create-service-identity.dto';
import { IssueTokenDto } from './dto/issue-token.dto';

const TOKEN_PREFIX = 'nsi_';
const DEFAULT_TTL = 3600; // 1 hour

/**
 * ServiceIdentitiesService — Phase 1 (Simulation-5).
 *
 * A ServiceIdentity is a workload (simulation engine, webhook dispatcher,
 * scheduled job, external integration, CLI). NOT a User. NOT a Tenant.
 *
 * Tokens are SHA-256 hashed at rest. The plaintext is returned ONCE at
 * issuance. The service identity stores scopes; the token stores a snapshot
 * of scopes at issuance so revocation of a scope does not retroactively
 * invalidate already-issued tokens until they expire.
 */
@Injectable()
export class ServiceIdentitiesService {
  private readonly logger = new Logger(ServiceIdentitiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, createdByUserId: string, dto: CreateServiceIdentityDto) {
    const existing = await this.prisma.serviceIdentity.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException({
        code: 'SERVICE_IDENTITY_NAME_TAKEN',
        message: `Service identity with name '${dto.name}' already exists for this tenant.`,
      });
    }
    return this.prisma.serviceIdentity.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        scopes: dto.scopes,
        createdByUserId,
      },
    });
  }

  async list(tenantId: string) {
    return this.prisma.serviceIdentity.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(tenantId: string, id: string, revokedByUserId: string) {
    const found = await this.prisma.serviceIdentity.findFirst({
      where: { id, tenantId },
    });
    if (!found) {
      throw new NotFoundException({
        code: 'SERVICE_IDENTITY_NOT_FOUND',
        message: 'Service identity not found for this tenant.',
      });
    }
    if (found.revokedAt) {
      return found;
    }
    return this.prisma.serviceIdentity.update({
      where: { id },
      data: { revokedAt: new Date(), revokedBy: revokedByUserId, enabled: false },
    });
  }

  /**
   * Issue a new bearer token for a service identity. The plaintext token is
   * returned ONCE in the response. The server stores only its SHA-256 hash.
   */
  async issueToken(tenantId: string, identityId: string, dto: IssueTokenDto) {
    const identity = await this.prisma.serviceIdentity.findFirst({
      where: { id: identityId, tenantId },
    });
    if (!identity) {
      throw new NotFoundException({
        code: 'SERVICE_IDENTITY_NOT_FOUND',
        message: 'Service identity not found for this tenant.',
      });
    }
    if (identity.revokedAt || !identity.enabled) {
      throw new ForbiddenException({
        code: 'SERVICE_IDENTITY_REVOKED',
        message: 'Cannot issue tokens for a revoked or disabled identity.',
      });
    }

    const ttl = dto.ttlSeconds ?? DEFAULT_TTL;
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const plaintext = TOKEN_PREFIX + randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(plaintext).digest('hex');

    const row = await this.prisma.serviceToken.create({
      data: {
        serviceIdentityId: identity.id,
        tenantId,
        scopes: identity.scopes,
        tokenHash,
        expiresAt,
      },
    });

    return {
      tokenId: row.id,
      token: plaintext,
      scopes: row.scopes,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  /**
   * Look up and validate a service token by its plaintext. Used by the
   * ServiceIdentityGuard. Returns the token row + parent identity if valid,
   * or null if invalid (expired, revoked, or unknown).
   */
  async validateToken(plaintext: string): Promise<{
    token: { id: string; serviceIdentityId: string; tenantId: string; scopes: string[] };
    identity: { id: string; name: string; tenantId: string; scopes: string[]; enabled: boolean };
  } | null> {
    if (!plaintext || !plaintext.startsWith(TOKEN_PREFIX)) return null;
    const tokenHash = createHash('sha256').update(plaintext).digest('hex');
    const token = await this.prisma.serviceToken.findUnique({
      where: { tokenHash },
    });
    if (!token) return null;
    if (token.revokedAt) return null;
    if (token.expiresAt < new Date()) return null;
    const identity = await this.prisma.serviceIdentity.findUnique({
      where: { id: token.serviceIdentityId },
    });
    if (!identity) return null;
    if (identity.revokedAt || !identity.enabled) return null;
    // Update lastUsedAt (best-effort; do not block)
    this.prisma.serviceToken
      .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
      .catch((err) => this.logger.warn(`Failed to update lastUsedAt for token ${token.id}: ${err?.message}`));
    this.prisma.serviceIdentity
      .update({ where: { id: identity.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
    return {
      token: {
        id: token.id,
        serviceIdentityId: token.serviceIdentityId,
        tenantId: token.tenantId,
        scopes: token.scopes,
      },
      identity: {
        id: identity.id,
        name: identity.name,
        tenantId: identity.tenantId,
        scopes: identity.scopes,
        enabled: identity.enabled,
      },
    };
  }

  /**
   * Verify a token has the required scope. Returns null if not.
   * Used by the guard to enforce scope per-endpoint.
   */
  hasScope(token: { scopes: string[] }, required: string): boolean {
    return token.scopes.includes(required);
  }
}