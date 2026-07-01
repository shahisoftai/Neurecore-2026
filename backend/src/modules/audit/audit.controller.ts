import {
  Controller,
  Get,
  Query,
  Param,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { AuditService } from './audit.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { PaginatedResponse } from '../../common/responses/paginated.response';
import type { AuditLogResponseDto } from './dto/audit-log-response.dto';

/**
 * AuditController — SRP: exposes audit-log query endpoints only.
 * RBAC: tenant users see their own logs; admins see platform-wide.
 */
@Controller({ path: 'audit-logs', version: '1' })
@ApiCommon('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /** Platform-wide audit log — super-admin / platform-admin only */
  @Get()
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN', 'SECURITY_OFFICER', 'AUDITOR')
  async findAll(
    @Query('tenantId') tenantId?: string,
    @Query('actor') actor?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
  ): Promise<PaginatedResponse<AuditLogResponseDto>> {
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { data, total } = await this.auditService.findAll({
      tenantId,
      actor,
      action,
      resource,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: pageNum,
      limit: limitNum,
    });
    return {
      items: data as unknown as AuditLogResponseDto[],
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.max(1, Math.ceil(total / limitNum)) },
    };
  }

  /** Tenant-scoped audit log — owner/admin of that tenant */
  @Get('tenant')
  async findForTenant(
    @CurrentUser() user: JwtPayload,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
  ): Promise<PaginatedResponse<AuditLogResponseDto>> {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { data, total } = await this.auditService.findAll({
      tenantId: user.tenantId,
      action,
      resource,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: pageNum,
      limit: limitNum,
    });
    return {
      items: data as unknown as AuditLogResponseDto[],
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.max(1, Math.ceil(total / limitNum)) },
    };
  }

  /** Per-agent audit trail (plan: GET /governance/audit/:agentId) */
  @Get('agent/:agentId')
  async findByAgent(
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @CurrentUser() user: JwtPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<PaginatedResponse<AuditLogResponseDto>> {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { data, total } = await this.auditService.findByAgent(agentId, user.tenantId, {
      page: pageNum,
      limit: limitNum,
    });
    return {
      items: data as unknown as AuditLogResponseDto[],
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.max(1, Math.ceil(total / limitNum)) },
    };
  }
}
