import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class ExecuteAIActionDto {
  @ApiProperty({ description: 'AI Action id (e.g. ai:summary, ai:forecast)' })
  @IsString()
  @IsNotEmpty()
  action!: string;

  @ApiPropertyOptional({ description: 'Target entity type' })
  @IsString()
  @IsOptional()
  entityType?: string;

  @ApiPropertyOptional({ description: 'Target entity id' })
  @IsString()
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Action-specific parameters' })
  @IsObject()
  @IsOptional()
  parameters?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Idempotency-Key for safe retries (api-contract §7.4)',
  })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}
