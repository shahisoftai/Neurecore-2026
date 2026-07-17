import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ServiceIdentitiesService } from '../../../modules/service-identities/service-identities.service';

export const SERVICE_IDENTITY_SCOPE_KEY = 'service_identity_scope';

/**
 * Decorator: marks an endpoint as requiring a service identity token
 * with the given scope. Example:
 *
 *   @ServiceIdentityScope('simulation-engine')
 *   @Post('/simulations/.../days/:day/run')
 *   runDay() { ... }
 */
export const ServiceIdentityScope = (scope: string) =>
  SetMetadata(SERVICE_IDENTITY_SCOPE_KEY, scope);

/**
 * ServiceIdentityGuard — Phase 1 (Simulation-5).
 *
 * Validates a `Authorization: Bearer <token>` header where the token is a
 * service identity token (not a user JWT). On success, attaches the
 * resolved identity to `req.serviceIdentity` and `req.serviceToken`.
 *
 * Endpoints guarded by this:
 * - May also be accessed by human users (some controllers handle both)
 *   but if the bearer token is a service token, it is the primary path.
 * - Must declare a scope via @ServiceIdentityScope('...'). The guard
 *   enforces that the token's scopes include the required one.
 *
 * This guard does NOT replace JwtAuthGuard. Routes that accept both user
 * JWTs and service tokens should attach both guards; the service-token
 * path is the second half.
 */
@Injectable()
export class ServiceIdentityGuard implements CanActivate {
  private readonly logger = new Logger(ServiceIdentityGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly services: ServiceIdentitiesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredScope = this.reflector.getAllAndOverride<string>(
      SERVICE_IDENTITY_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = (req.headers.authorization ??
      req.headers.Authorization) as string | undefined;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      throw new ForbiddenException({
        code: 'SERVICE_TOKEN_REQUIRED',
        message: 'Service token is required for this endpoint.',
      });
    }

    const plaintext = authHeader.substring(7).trim();
    const resolved = await this.services.validateToken(plaintext);
    if (!resolved) {
      throw new ForbiddenException({
        code: 'SERVICE_TOKEN_INVALID',
        message: 'Service token is invalid, expired, or revoked.',
      });
    }

    if (requiredScope && !this.services.hasScope(resolved.token, requiredScope)) {
      throw new ForbiddenException({
        code: 'SERVICE_IDENTITY_SCOPE_INSUFFICIENT',
        message: `Service identity is missing required scope '${requiredScope}'. Token has: [${resolved.token.scopes.join(', ')}].`,
      });
    }

    // Attach for downstream handlers
    (req as any).serviceIdentity = resolved.identity;
    (req as any).serviceToken = resolved.token;
    return true;
  }
}