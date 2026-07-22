/**
 * MeSecurityController — Self-service endpoints for the authenticated user.
 *
 * Mounted at /api/v1/me/security/*. All routes require a valid JWT and are
 * tenant-scoped (each user can only manage their own security settings).
 *
 * Endpoints:
 *   GET    /status               — get 2FA + session-timeout state
 *   PATCH  /                     — update session timeout
 *   POST   /password             — change own password (alias of /users/:id/password)
 *   POST   /2fa/init             — generate pending TOTP secret
 *   POST   /2fa/enable           — verify code and flip the flag
 *   POST   /2fa/disable          — password-protected disable
 *   POST   /2fa/challenge        — verify a TOTP code on login (no DB write)
 */

import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TwoFactorService } from './services/two-factor.service';
import { UsersService } from './users.service';
import { ChangePasswordDto, Enable2faDto, Disable2faDto } from './dto/user.dto';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

class UpdateSessionSettingsDto {
  @IsOptional() @IsInt() @Min(5) @Max(1440) sessionTimeoutMinutes?: number;
}

@Controller({ path: 'me/security', version: '1' })
@ApiCommon('me-security')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SECURITY_OFFICER,
  UserRole.USER,
)
export class MeSecurityController {
  constructor(
    private readonly twoFactor: TwoFactorService,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('status')
  async getStatus(@CurrentUser() user: JwtPayload) {
    const twoFa = await this.twoFactor.getStatus(user.sub);
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { metadata: true },
    });
    const meta = (dbUser?.metadata ?? {}) as Record<string, unknown>;
    return {
      twoFactor: twoFa,
      sessionTimeoutMinutes: Number(meta.sessionTimeoutMinutes ?? 60),
    };
  }

  @Patch()
  async update(
    @Body() dto: UpdateSessionSettingsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { metadata: true },
    });
    const meta = (dbUser?.metadata ?? {}) as Record<string, unknown>;
    const updated = { ...meta };
    if (dto.sessionTimeoutMinutes !== undefined) {
      updated.sessionTimeoutMinutes = dto.sessionTimeoutMinutes;
    }
    await this.prisma.user.update({
      where: { id: user.sub },
      data: { metadata: updated as never },
    });
    return { sessionTimeoutMinutes: updated.sessionTimeoutMinutes as number };
  }

  @Post('password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Delegate to UsersService.changePassword — same logic, same audit trail.
    return this.users.changePassword(user.sub, dto);
  }

  @Post('2fa/init')
  async init2fa(@CurrentUser() user: JwtPayload) {
    return this.twoFactor.init(user.sub);
  }

  @Post('2fa/enable')
  async enable2fa(@Body() dto: Enable2faDto, @CurrentUser() user: JwtPayload) {
    return this.twoFactor.enable(user.sub, dto.code);
  }

  @Post('2fa/disable')
  async disable2fa(
    @Body() dto: Disable2faDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.twoFactor.disable(user.sub, dto.password);
  }

  /**
   * Used by the auth flow (after password verify) when 2FA is enabled.
   * Returns true if the supplied code matches; false otherwise.
   */
  @Post('2fa/challenge')
  async challenge(@Body('code') code: string, @CurrentUser() user: JwtPayload) {
    const ok = await this.twoFactor.verifyChallenge(user.sub, code);
    if (!ok) return { ok: false };
    // Track last challenge timestamp (used for UI "Last verified")
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { metadata: true },
    });
    const meta = (dbUser?.metadata ?? {}) as Record<string, unknown>;
    await this.prisma.user.update({
      where: { id: user.sub },
      data: {
        metadata: {
          ...meta,
          last2FAChallengeAt: new Date().toISOString(),
        } as never,
      },
    });
    return { ok: true };
  }
}
