/**
 * ActionResult — canonical envelope for action (mutating) endpoints.
 *
 * Phase 1, Task 1.9 (per `EAOS-api-contract.md` §3.3).
 *
 * Action endpoints (POST/PATCH/DELETE that don't return a full entity)
 * MUST return this shape. The success envelope wraps the HTTP response;
 * `data` is the `ActionResult<T>`.
 *
 *   HTTP:
 *     {
 *       "status": "success",
 *       "data": {
 *         "success": true,
 *         "message": "Agent paused",
 *         "data": { ... agent ... },
 *         "warnings": []
 *       }
 *     }
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ActionResult<T = unknown> {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ description: 'Human-readable outcome', example: 'Agent paused' })
  message!: string;

  @ApiPropertyOptional({ description: 'Affected entity (optional)' })
  data?: T;

  @ApiPropertyOptional({
    description: 'Non-fatal advisories',
    type: [String],
  })
  warnings?: string[];
}
