/**
 * MeProfileController — Self-service profile management.
 *
 * Mounted at /api/v1/me/profile/*. Authenticated user can read + write their
 * own profile fields (phone, jobTitle, personal timezone, locale, language,
 * theme, default landing page, primary department).
 *
 * Underlying store is `User.*` columns + User.notificationPrefsJson.
 * All routes require a valid JWT; actions are tenant-scoped.
 */

import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import {
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class NotificationPrefsDto {
  @IsOptional() @IsString() @MaxLength(20) digestCadence?:
    | 'off'
    | 'daily'
    | 'weekly'
    | 'monthly';
  @IsOptional() @IsString() @MaxLength(10) quietHoursStart?: string;
  @IsOptional() @IsString() @MaxLength(10) quietHoursEnd?: string;
  @IsOptional() @IsString() @MaxLength(20) theme?: 'dark' | 'light' | 'system';
}

class UpdateMeProfileDto {
  @IsOptional() @IsString() @MaxLength(64) firstName?: string;
  @IsOptional() @IsString() @MaxLength(64) lastName?: string;

  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(80) jobTitle?: string | null;
  @IsOptional() @IsString() @MaxLength(50) timezone?: string | null;
  @IsOptional() @IsString() @MaxLength(15) locale?: string | null;
  @IsOptional() @IsString() @MaxLength(50) language?: string | null;
  @IsOptional() @IsString() @MaxLength(20) theme?: string | null;
  @IsOptional() @IsString() @MaxLength(200) defaultLanding?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPrefsDto)
  notificationPrefs?: NotificationPrefsDto;

  /** Primary department for the user (null to clear). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  primaryDepartmentId?: string | null;
}

@Controller({ path: 'me/profile', version: '1' })
@ApiCommon('me-profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SECURITY_OFFICER,
  UserRole.USER,
)
export class MeProfileController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@CurrentUser() user: JwtPayload) {
    const u = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        departmentId: true,
        phone: true,
        jobTitle: true,
        timezone: true,
        locale: true,
        language: true,
        theme: true,
        defaultLanding: true,
        railCollapsedDefault: true,
        notificationPrefsJson: true,
        avatarUrl: true,
        isActive: true,
      },
    });
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      tenantId: u.tenantId,
      avatarUrl: u.avatarUrl,
      isActive: u.isActive,
      phone: u.phone,
      jobTitle: u.jobTitle,
      timezone: u.timezone,
      locale: u.locale,
      language: u.language,
      theme: u.theme,
      defaultLanding: u.defaultLanding,
      primaryDepartmentId: u.departmentId,
      railCollapsedDefault: u.railCollapsedDefault,
      notificationPrefs: u.notificationPrefsJson ?? null,
    };
  }

  @Patch()
  async update(
    @Body() dto: UpdateMeProfileDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Map departmentId alias → primaryDepartmentId
    const { primaryDepartmentId, notificationPrefs, ...profile } = dto;
    const data: Record<string, unknown> = { ...profile };
    if (primaryDepartmentId !== undefined) {
      data.departmentId = primaryDepartmentId;
    }
    if (notificationPrefs !== undefined) {
      data.notificationPrefsJson = notificationPrefs as never;
    }

    const updated = await this.prisma.user.update({
      where: { id: user.sub },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        departmentId: true,
        phone: true,
        jobTitle: true,
        timezone: true,
        locale: true,
        language: true,
        theme: true,
        defaultLanding: true,
        railCollapsedDefault: true,
        notificationPrefsJson: true,
        avatarUrl: true,
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      role: updated.role,
      tenantId: updated.tenantId,
      avatarUrl: updated.avatarUrl,
      phone: updated.phone,
      jobTitle: updated.jobTitle,
      timezone: updated.timezone,
      locale: updated.locale,
      language: updated.language,
      theme: updated.theme,
      defaultLanding: updated.defaultLanding,
      primaryDepartmentId: updated.departmentId,
      railCollapsedDefault: updated.railCollapsedDefault,
      notificationPrefs: updated.notificationPrefsJson ?? null,
    };
  }
}
