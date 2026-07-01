/**
 * assertValidEntityType — runtime guard for entity-type query/path params.
 *
 * Centralised here (instead of duplicating the WIDGET_ENTITY_TYPES
 * array per-call site) so adding a new entity type is a single-line
 * change in `dto/widget.dto.ts`.
 */

import { BadRequestException } from '@nestjs/common';
import { WIDGET_ENTITY_TYPES, type WidgetEntityTypeDto } from './widget.dto';

export function assertValidEntityType(
  raw: string,
): WidgetEntityTypeDto {
  if ((WIDGET_ENTITY_TYPES as readonly string[]).includes(raw)) {
    return raw as WidgetEntityTypeDto;
  }
  throw new BadRequestException(
    `Invalid entity type '${raw}'. Allowed: ${WIDGET_ENTITY_TYPES.join(', ')}`,
  );
}