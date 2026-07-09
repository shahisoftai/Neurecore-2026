/**
 * Sources — Service (Phase 2B)
 *
 * Single Responsibility: orchestrate InformationSource CRUD only.
 * No knowledge of responses, completeness, or question packs.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { SOURCE_REPOSITORY } from './interfaces/source.interface';
import type {
  ISourceService,
  ISourceRepository,
  CreateSourceInput,
  InformationSource,
} from './interfaces/source.interface';
import { EngineErrors } from '../common/apperrors';

@Injectable()
export class SourceService implements ISourceService {
  private readonly logger = new Logger(SourceService.name);

  constructor(
    @Inject(SOURCE_REPOSITORY) private readonly repo: ISourceRepository,
  ) {}

  async create(
    input: CreateSourceInput,
    actorId: string,
  ): Promise<InformationSource> {
    if (input.confidence < 0 || input.confidence > 100) {
      throw EngineErrors.badRequest(
        'INVALID_CONFIDENCE',
        'confidence must be between 0 and 100',
      );
    }
    if (!input.label || input.label.trim().length === 0) {
      throw EngineErrors.badRequest('INVALID_LABEL', 'label is required');
    }
    const source = await this.repo.create(input);
    this.logger.debug(
      `Created InformationSource ${source.id} (${source.type}) by ${actorId}`,
    );
    return source;
  }

  async findById(id: string): Promise<InformationSource> {
    const found = await this.repo.findById(id);
    if (!found) throw EngineErrors.notFound('InformationSource', id);
    return found;
  }

  async verify(id: string, actorId: string): Promise<InformationSource> {
    const found = await this.findById(id);
    if (found.verified) return found;
    const updated = await this.repo.markVerified(id, actorId);
    this.logger.log(`Source ${id} verified by ${actorId}`);
    return updated;
  }
}
