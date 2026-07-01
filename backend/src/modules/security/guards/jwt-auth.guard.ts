/**
 * ═══════════════════════════════════════════════════════════════════════════
 * JWT Authentication Guard
 * ═══════════════════════════════════════════════════════════════════════════
 * Re-exports and enhances the JWT auth guard from auth module.
 */

import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../../../common/decorators/roles.decorator';

/**
 * JWT Authentication Guard
 * Validates JWT tokens and enforces authentication
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector
      ? this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
          context.getHandler(),
          context.getClass(),
        ])
      : false;

    if (isPublic) return true;
    return super.canActivate(context);
  }

  /**
   * Handle authentication failures
   */
  handleRequest<TUser = unknown>(err: Error | null, user: TUser): TUser {
    if (err) throw err;
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
