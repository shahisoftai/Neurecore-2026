/**
 * Information Engine — Domain Error Helpers
 *
 * Thin wrappers around Nest's built-in HTTP exceptions so the engine's
 * services throw consistently without scattering constructors across files.
 */

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

export const EngineErrors = {
  notFound(resource: string, id: string): NotFoundException {
    return new NotFoundException(`${resource} ${id} not found`);
  },
  badRequest(
    code: string,
    message: string,
    details?: unknown,
  ): BadRequestException {
    return new BadRequestException({
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    });
  },
  forbidden(message: string): ForbiddenException {
    return new ForbiddenException(message);
  },
};
