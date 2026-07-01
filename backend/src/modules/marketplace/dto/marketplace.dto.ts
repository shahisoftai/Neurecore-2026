/**
 * Marketplace DTOs (per EAOS-api-contract.md §8.19).
 *
 * Phase 7, Task 7.3 (per EAOS-implementation-roadmap.md §11).
 */

import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class BrowseMarketplaceDto {
  @ApiPropertyOptional({
    description: 'Tab to filter by',
    enum: [
      'packs',
      'agent-templates',
      'connectors',
      'workflows',
      'knowledge-packs',
      'widgets',
      'themes',
      'installed',
    ],
  })
  @IsEnum([
    'packs',
    'agent-templates',
    'connectors',
    'workflows',
    'knowledge-packs',
    'widgets',
    'themes',
    'installed',
  ])
  @IsOptional()
  tab?: string;

  @ApiPropertyOptional({ description: 'Free-text search across all tabs.' })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({
    description: 'If true, restrict to items installed by the calling tenant.',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  installedOnly?: boolean;
}
