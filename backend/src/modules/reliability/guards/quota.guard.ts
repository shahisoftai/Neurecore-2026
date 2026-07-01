import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { QuotaEnforcerService } from '../services/quota-enforcer.service';
import {
  QUOTA_KEY_METADATA,
  QUOTA_UNITS_METADATA,
} from '../decorators/quota.decorator';
import type { JwtPayload } from '../../auth/interfaces/token.interface';

/**
 * QuotaGuard
 * SRP: reads quota metadata from the handler and delegates enforcement to
 *      QuotaEnforcerService. Does not contain any business logic itself.
 *
 * Usage (route level):
 *   @UseGuards(JwtAuthGuard, QuotaGuard)
 *   @Quota('agent_executions')
 *   @Post('run')
 *   async runAgent(...) { ... }
 */
@Injectable()
export class QuotaGuard implements CanActivate {
  private readonly logger = new Logger(QuotaGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly enforcer: QuotaEnforcerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const quotaKey = this.reflector.get<string | undefined>(
      QUOTA_KEY_METADATA,
      context.getHandler(),
    );

    // No @Quota decorator → pass through
    if (!quotaKey) return true;

    const units =
      this.reflector.get<number>(QUOTA_UNITS_METADATA, context.getHandler()) ??
      1;
    const req = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = req.user;

    if (!user?.tenantId) return true; // SUPER_ADMIN has no quota

    try {
      await this.enforcer.enforceAndRecord(
        { tenantId: user.tenantId, quotaKey },
        units,
      );
    } catch (err) {
      this.logger.warn(
        `Quota exceeded: ${quotaKey} for tenant ${user.tenantId}`,
      );
      throw new HttpException(
        `Quota exceeded for ${quotaKey}`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
