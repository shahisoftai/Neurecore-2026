import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { OnboardingService } from './onboarding.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import {
  AcceptInviteDto,
  InviteMembersDto,
  SelectTemplateDto,
  SelectTierDto,
  UpdateOnboardingStateDto,
} from './dto/onboarding.dto';

@Controller({ path: 'onboarding', version: '1' })
@ApiCommon('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  private requireTenant(user: JwtPayload): string {
    if (!user.tenantId) {
      throw new Error('User has no tenant context');
    }
    return user.tenantId;
  }

  @Get('state')
  async getState(@CurrentUser() user: JwtPayload) {
    return this.onboarding.getState(this.requireTenant(user));
  }

  @Put('state')
  @HttpCode(HttpStatus.OK)
  async updateState(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateOnboardingStateDto,
  ) {
    // WS-2.1: pass through ALL fields the DTO accepts, not just company.
    // Bug fix: timezone / currency were accepted by the DTO but silently
    // dropped by the controller (and never persisted by the service).
    const partial = {
      step: dto.step as never,
      company: {
        name: dto.companyName,
        logoUrl: dto.logoUrl,
        industry: dto.industry,
      },
      timezone: dto.timezone,
      currency: dto.currency,
    };
    return this.onboarding.updateState(this.requireTenant(user), partial);
  }

  @Post('select-tier')
  @HttpCode(HttpStatus.OK)
  async selectTier(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SelectTierDto,
  ) {
    return this.onboarding.selectTier(this.requireTenant(user), dto.tierId);
  }

  @Post('select-template')
  @HttpCode(HttpStatus.OK)
  async selectTemplate(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SelectTemplateDto,
  ) {
    return this.onboarding.selectTemplate(
      this.requireTenant(user),
      dto.templateSlug,
      dto.agentOverrides,
    );
  }

  @Post('invite')
  @HttpCode(HttpStatus.OK)
  async invite(@CurrentUser() user: JwtPayload, @Body() dto: InviteMembersDto) {
    const invites = (dto.invites ?? []).map((i) => ({
      email: i.email,
      role: i.role ?? ('USER' as never),
    }));
    return this.onboarding.inviteMembers(
      this.requireTenant(user),
      user.sub,
      invites,
    );
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  async complete(@CurrentUser() user: JwtPayload) {
    return this.onboarding.complete(this.requireTenant(user));
  }

  @Public()
  @Post('accept-invite/:token')
  @HttpCode(HttpStatus.OK)
  async acceptInvite(
    @Param('token') token: string,
    @Body() dto: AcceptInviteDto,
  ) {
    return this.onboarding.acceptInvite(token, dto);
  }
}
