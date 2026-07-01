/**
 * Retail DTOs — Phase 8.
 *
 * The retail controller exposes:
 *   - GET  /retail/actions      — list 12 retail AI actions
 *   - GET  /retail/widgets      — list 6 retail widgets
 *   - POST /retail/widgets/:id/compute — compute widget value
 *   - POST /retail/actions/:id/execute — execute a retail AI action
 *   - POST /retail/integrations/shopify/sync — manually trigger Shopify sync
 *   - POST /retail/integrations/square/sync  — manually trigger Square sync
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class ComputeRetailWidgetDto {
  @ApiProperty({
    description: 'Entity type the widget is being computed against',
    example: 'FACILITY',
  })
  entityType!: string;

  @ApiProperty({
    description: 'Entity id (e.g. retail-store uuid)',
    example: 'b3a7c8a8-1f0e-4d6d-9c7b-1f6a8d7c8e2e',
  })
  entityId!: string;

  @ApiProperty({
    description: 'Widget params (e.g. { days: 30, topN: 30 })',
    required: false,
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}

export class ExecuteRetailActionDto {
  @ApiProperty({ description: 'Entity type', example: 'FACILITY' })
  entityType!: string;

  @ApiProperty({
    description: 'Entity id',
    example: 'b3a7c8a8-1f0e-4d6d-9c7b-1f6a8d7c8e2e',
  })
  entityId!: string;

  @ApiProperty({
    description: 'Action-specific parameters',
    required: false,
  })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;
}

export class SyncIntegrationDto {
  @ApiProperty({
    description: 'Optional sync window start (ISO 8601)',
    required: false,
  })
  @IsOptional()
  since?: string;
}
