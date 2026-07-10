/**
 * IdParamDto — canonical path parameter for endpoints that take a single ID.
 *
 * Use:
 *   @Get(':id')
 *   findOne(@Param() params: IdParamDto) { ... }
 *
 * Uses @IsString() instead of @IsUUID() because NeureCore IDs are CUIDs
 * (e.g. cm9p2x3ka0001abc...), not RFC 4122 UUIDs. See FIX-028.
 */

import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class IdParamDto {
  @ApiProperty({
    description: 'Resource ID (CUID format)',
    example: 'cm9p2x3ka0001abcdefgh',
  })
  @IsString()
  id!: string;
}
