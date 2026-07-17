import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ServiceIdentitiesService } from './service-identities.service';
import { CreateServiceIdentityDto } from './dto/create-service-identity.dto';
import { IssueTokenDto } from './dto/issue-token.dto';

@Controller('v1/service-identities')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class ServiceIdentitiesController {
  constructor(private readonly service: ServiceIdentitiesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: { id: string; tenantId: string },
    @Body() dto: CreateServiceIdentityDto,
  ) {
    return this.service.create(user.tenantId, user.id, dto);
  }

  @Get()
  async list(@CurrentUser() user: { tenantId: string }) {
    return { items: await this.service.list(user.tenantId) };
  }

  @Post(':id/tokens')
  @HttpCode(HttpStatus.CREATED)
  async issueToken(
    @CurrentUser() user: { tenantId: string },
    @Param('id') id: string,
    @Body() dto: IssueTokenDto,
  ) {
    return this.service.issueToken(user.tenantId, id, dto);
  }

  @Post(':id/revoke')
  async revoke(
    @CurrentUser() user: { id: string; tenantId: string },
    @Param('id') id: string,
  ) {
    return this.service.revoke(user.tenantId, id, user.id);
  }
}