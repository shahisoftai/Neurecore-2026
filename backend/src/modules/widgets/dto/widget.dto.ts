import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WidgetSizeDto {
  @ApiProperty({ minimum: 1, maximum: 12, description: 'Grid width (1-12 columns)' })
  @IsInt()
  @Min(1)
  @Max(12)
  w!: number;

  @ApiProperty({ minimum: 1, maximum: 24, description: 'Grid height in rows' })
  @IsInt()
  @Min(1)
  @Max(24)
  h!: number;
}

export class GridItemDto {
  @ApiProperty({ description: 'Widget definition id from the registry' })
  @IsString()
  i!: string;

  @ApiProperty({ type: WidgetSizeDto, description: 'Position & size in grid' })
  @ValidateNested()
  @Type(() => WidgetSizeDto)
  size!: WidgetSizeDto;

  @ApiProperty({
    type: Object,
    required: false,
    description: 'User-provided config values overriding defaults',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class ListWidgetsQueryDto {
  @ApiProperty({
    required: false,
    description: 'Filter to widgets applicable to this entity type',
  })
  @IsOptional()
  @IsString()
  entityType?: string;
}

export class ComputeWidgetResponseDto {
  @ApiProperty()
  @IsString()
  widgetId!: string;

  @ApiProperty()
  @IsString()
  computation!: string;

  @ApiProperty()
  @IsString()
  aggregationType!: string;

  @ApiProperty({ type: [Number], required: false })
  @IsOptional()
  @IsArray()
  value?: number | string | null;

  @ApiProperty()
  @IsInt()
  rawCount!: number;

  @ApiProperty()
  @IsString()
  computedAt!: string;
}

export const WIDGET_ENTITY_TYPES = [
  'AGENT',
  'DEPARTMENT',
  'PROJECT',
  'GOAL',
  'TASK',
  'WORKFLOW',
  'ROUTINE',
  'KNOWLEDGE',
  'INTEGRATION',
  'TOOL',
] as const;
export type WidgetEntityTypeDto = (typeof WIDGET_ENTITY_TYPES)[number];

export class SaveLayoutDto {
  @ApiProperty({
    type: [GridItemDto],
    description: 'Ordered list of grid items with sizes',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GridItemDto)
  items!: GridItemDto[];

  @ApiProperty({ required: false, description: 'Optional density override' })
  @IsOptional()
  @IsIn(['compact', 'default', 'comfortable'])
  density?: 'compact' | 'default' | 'comfortable';
}

export class SaveLayoutResponseDto {
  @ApiProperty()
  @IsString()
  entityType!: string;

  @ApiProperty()
  @IsInt()
  itemCount!: number;

  @ApiProperty()
  @IsString()
  updatedAt!: string;
}

export class ListWidgetsResponseDto {
  @ApiProperty({ type: [Object] })
  widgets!: Record<string, unknown>[];
}