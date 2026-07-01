import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MissionFeedCategory, MissionFeedPriority } from '@prisma/client';

export class CreateMissionFeedItemDto {
  @ApiProperty({ enum: MissionFeedCategory })
  @IsEnum(MissionFeedCategory)
  category!: MissionFeedCategory;

  @ApiPropertyOptional({ enum: MissionFeedPriority })
  @IsEnum(MissionFeedPriority)
  @IsOptional()
  priority?: MissionFeedPriority;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  entityType?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Action payload (deep link target etc.)',
  })
  @IsOptional()
  actionPayload?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Source event id for idempotency' })
  @IsString()
  @IsOptional()
  sourceEventId?: string;
}
