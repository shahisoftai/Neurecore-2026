/**
 * PaginatedResponse — canonical envelope for list endpoints.
 *
 * Phase 1, Task 1.8 (per `EAOS-api-contract.md` §3.2).
 *
 * List endpoints MUST return this shape (not raw arrays, not `{data, total}`).
 * The success envelope (`{ status, data, meta }`) wraps the HTTP response;
 * `data` is the `PaginatedResponse<T>`.
 *
 *   HTTP:
 *     {
 *       "status": "success",
 *       "data": {
 *         "items": [...],
 *         "pagination": { "page": 1, "limit": 20, "total": 47, "totalPages": 3 }
 *       },
 *       "meta": { "timestamp": "...", "requestId": "..." }
 *     }
 */

import { ApiProperty } from '@nestjs/swagger';

export interface PaginationMeta {
  /** 1-indexed page number. */
  page: number;
  /** Page size. */
  limit: number;
  /** Total matching records (before page slicing). */
  total: number;
  /** ceil(total / limit). */
  totalPages: number;
}

export class PaginatedResponse<T> {
  @ApiProperty({ description: 'Page items', isArray: true })
  items!: T[];

  @ApiProperty({ description: 'Pagination metadata' })
  pagination!: PaginationMeta;
}
