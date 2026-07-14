import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { ChiefOfStaffService } from './chief-of-staff.service';
import type { SendCosMessageDto } from './dto/cos.dto';

@Controller({ path: 'projects/:projectId/cos', version: '1' })
@UseGuards(JwtAuthGuard)
export class ChiefOfStaffController {
  constructor(private readonly cosService: ChiefOfStaffService) {}

  @Post('messages')
  async sendMessage(
    @Param('projectId') projectId: string,
    @Body() dto: SendCosMessageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.cosService.sendMessage(
      projectId,
      user.tenantId ?? '',
      dto,
      user.sub ?? 'unknown',
    );
  }

  @Get('snapshot')
  async getSnapshot(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const snapshot = await this.cosService.sendMessage(
      projectId,
      user.tenantId ?? '',
      { message: 'Give me a project status snapshot' },
      user.sub ?? 'snapshot-reader',
    );
    return snapshot.projectSnapshot;
  }
}
