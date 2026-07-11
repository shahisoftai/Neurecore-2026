import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ModelRoutingService } from './services/model-routing.service';
import type { ModelSelectionInput } from './services/model-routing.service';

@Controller({ path: 'models', version: '1' })
@ApiCommon('models')
@Roles('SUPER_ADMIN')
export class ModelsController {
  constructor(private readonly modelRoutingService: ModelRoutingService) {}

  @Get('available')
  getAvailableModels() {
    return this.modelRoutingService.getAvailableModels();
  }

  @Post('select')
  selectModel(@Body() input: ModelSelectionInput) {
    return this.modelRoutingService.selectModel(input);
  }
}
