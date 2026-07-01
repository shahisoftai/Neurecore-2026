/**
 * api-common.decorator.ts — bundle of OpenAPI decorators for controllers.
 *
 * Phase 1, Task 1.9 (per `EAOS-implementation-roadmap.md` v1.3).
 *
 * Single source of truth for the per-controller annotation pattern. Every
 * controller applies `@ApiCommon()` (or the per-tag variant) once at the
 * class level. This replaces 4 separate decorators per controller with
 * 1, eliminating drift (forgetting one of them is a real bug — agents was
 * missing `@ApiBearerAuth` until this bundle was added).
 *
 * SOLID: OCP — adding a new global security scheme is one-line here.
 *
 * Usage:
 *   @Controller({ path: 'agents', version: '1' })
 *   @ApiCommon('agents')
 *   export class AgentsController { ... }
 *
 * For nested resources or special cases, use the individual decorators
 * from `@nestjs/swagger` directly.
 */

import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

/**
 * Bundle of standard OpenAPI decorators for an EAOS controller class.
 * Combines: @ApiTags (resource group), @ApiBearerAuth (JWT auth header),
 * @ApiSecurity X-Tenant-ID (platform role override header).
 *
 * @param tag The OpenAPI tag (usually the resource name in kebab/snake case).
 *             Defaults to 'default'.
 */
export function ApiCommon(tag: string = 'default') {
  return applyDecorators(
    ApiTags(tag),
    ApiBearerAuth('JWT'),
    ApiSecurity('X-Tenant-ID'),
    ApiSecurity('Idempotency-Key'),
  );
}
