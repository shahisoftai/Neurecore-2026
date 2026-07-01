/**
 * IdParamDto — canonical path parameter for endpoints that take a single UUID.
 *
 * Phase 1, Task 1.2 (per `EAOS-api-contract.md` §4.2).
 *
 * Use:
 *   @Get(':id')
 *   findOne(@Param() params: IdParamDto) { ... }
 *
 * Equivalent to `@Param('id', ParseUUIDPipe) id: string` but with the
 * type-safety of a DTO (so the OpenAPI schema is generated correctly).
 */

import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class IdParamDto {
  @ApiProperty({
    description: 'Resource UUID',
    format: 'uuid',
    example: '9d2e1f4a-3b6c-4e8a-9f0b-1a2b3c4d5e6f',
  })
  @IsUUID()
  id!: string;
}
