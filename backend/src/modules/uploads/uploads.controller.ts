import {
  BadRequestException,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { UploadsService } from './uploads.service';
import { LOGO_UPLOAD } from './storage/storage.interface';

@ApiTags('uploads')
@Controller({ path: 'uploads', version: '1' })
@ApiCommon('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  private requireTenant(user: JwtPayload): string {
    if (!user.tenantId) {
      throw new BadRequestException('User has no tenant context');
    }
    return user.tenantId;
  }

  @Post('logo')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
  )
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      // Hard limit is enforced again in service.uploadLogo against in-memory
      // buffer size (Multer `limits` is bytes per part, applies pre-parse).
      limits: { fileSize: LOGO_UPLOAD.maxBytes },
    }),
  )
  @ApiOperation({ summary: 'Upload a tenant logo (PNG/JPEG/WEBP/SVG, ≤5MB)' })
  async uploadLogo(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number },
  ) {
    if (!file) throw new BadRequestException('Missing file field "file"');
    const result = await this.uploads.uploadLogo(
      this.requireTenant(user),
      file.buffer,
      file.mimetype,
    );
    return { url: result.url, key: result.key, size: result.size };
  }

  @Delete('logo/:key')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a previously-uploaded logo' })
  async deleteLogo(@CurrentUser() user: JwtPayload, @Param('key') key: string) {
    // Scoping by tenant is the caller's responsibility — keys are opaque.
    // Service idempotently no-ops if the key is missing.
    this.requireTenant(user);
    await this.uploads.deleteLogo(key);
    return { ok: true };
  }
}
