import { ArgumentMetadata, Injectable, PipeTransform, BadRequestException } from '@nestjs/common';

/**
 * FlexibleIdPipe - accepts both UUIDs and human-readable string IDs.
 * Use this instead of ParseUUIDPipe for resources that use non-UUID IDs.
 */
@Injectable()
export class FlexibleIdPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!value || typeof value !== 'string' || value.trim() === '') {
      throw new BadRequestException('ID is required');
    }
    // Accept any non-empty string (UUIDs, prefixed IDs like "agent-cfo-mali", etc.)
    return value.trim();
  }
}
