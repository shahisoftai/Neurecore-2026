/**
 * ProjectTypePacks — Service (Phase 2B)
 */

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PROJECT_TYPE_PACK_REPOSITORY } from './interfaces/project-type-pack.interface';
import type {
  IProjectTypePackService,
  IProjectTypePackRepository,
  ProjectTypePackWithPack,
} from './interfaces/project-type-pack.interface';
import { QuestionPackService } from '../packs/question-packs.service';

@Injectable()
export class ProjectTypePacksService implements IProjectTypePackService {
  constructor(
    @Inject(PROJECT_TYPE_PACK_REPOSITORY)
    private readonly repo: IProjectTypePackRepository,
    private readonly questionPackService: QuestionPackService,
  ) {}

  async listForProjectType(
    projectTypeId: string,
  ): Promise<ProjectTypePackWithPack[]> {
    return this.repo.listForProjectType(projectTypeId);
  }

  async replaceForProjectType(
    projectTypeId: string,
    packIds: string[],
  ): Promise<ProjectTypePackWithPack[]> {
    if (new Set(packIds).size !== packIds.length) {
      throw new BadRequestException('packIds must be unique');
    }
    // Validate every pack exists (write-time validation; §15 question #4).
    for (const id of packIds) {
      await this.questionPackService.findPack(id);
    }
    const links = packIds.map((id, idx) => ({
      questionPackId: id,
      sortOrder: idx,
    }));
    return this.repo.replaceForProjectType(projectTypeId, links);
  }
}
