import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PORTAL_REPOSITORY } from '../services/portal.service';
import type { IPortalRepository, PortalTokenPayload } from '../interfaces/portal.interface';

@Injectable()
export class PortalAuthGuard implements CanActivate {
  constructor(
    @Inject(PORTAL_REPOSITORY) private readonly portalRepo: IPortalRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Portal ')) {
      throw new UnauthorizedException('Missing or invalid portal authorization header');
    }

    const token = authHeader.slice(7);
    const parts = token.split(':');

    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid portal token');
    }

    const [projectId, contactId, rawToken] = parts;

    const contact = await this.portalRepo.validatePortalToken(contactId, rawToken);

    if (!contact) {
      throw new UnauthorizedException('Invalid or expired portal token');
    }

    (request as Request & { portal: PortalTokenPayload }).portal = {
      contactId,
      projectId,
      email: contact.email,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    };

    return true;
  }
}
