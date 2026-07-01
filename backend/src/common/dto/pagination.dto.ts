/**
 * Pagination DTO — canonical query parameters for all list endpoints.
 *
 * Phase 1, Task 1.2 (per `EAOS-api-contract.md` §4.1).
 *
 * Conventions:
 *   - `page` is 1-indexed (1, 2, 3, ...). Default = 1.
 *   - `limit` is page size. Default = 20, max = 100 (per spec).
 *   - Cursor pagination is P2; offset/limit for v1.
 *
 * Use by extending with resource-specific filters:
 *
 *   ```typescript
 *   export class AgentFilterDto extends PaginationDto {
 *     @IsOptional() @IsEnum(AgentType) type?: AgentType;
 *     @IsOptional() @IsString() search?: string;
 *   }
 *   ```
 */

import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export class PaginationDto {
  @ApiPropertyOptional({
    description: '1-indexed page number',
    minimum: 1,
    default: DEFAULT_PAGE,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_PAGE;

  @ApiPropertyOptional({
    description: 'Page size (max 100)',
    minimum: 1,
    maximum: MAX_LIMIT,
    default: DEFAULT_LIMIT,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;
}
