/**
 * Projects — Adapter (Phase 2B)
 *
 * Single entry point ProjectsService.create() calls. Orchestrates:
 *   - backwards-compat fieldSchema validation (delegates to ProjectTypesService)
 *   - stage auto-generation (delegates to repository.createStages)
 *   - engine post-create work (resolve → record responses → recompute)
 *
 * Public contract is unchanged: same Project return, same BadRequestException
 * cases, same stage behaviour.
 */

import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import type {
  IProjectRepository,
  Project,
  CreateProjectInput,
} from '../../projects/interfaces/project.interface';
import { ProjectTypesService } from '../../project-types/project-types.service';
import { PROJECT_REPOSITORY } from '../../projects/interfaces/project.interface';
import { RequirementsService } from '../requirements/requirements.service';
import { ResponseService } from '../responses/response.service';
import { CompletenessService } from '../completeness/completeness.service';
import { ProjectTypePacksService } from '../project-type-packs/project-type-packs.service';

@Injectable()
export class ProjectsAdapter {
  private readonly logger = new Logger(ProjectsAdapter.name);

  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repository: IProjectRepository,
    @Inject(forwardRef(() => ProjectTypesService))
    private readonly projectTypesService: ProjectTypesService,
    private readonly requirementsService: RequirementsService,
    private readonly responseService: ResponseService,
    private readonly completenessService: CompletenessService,
    private readonly projectTypePacksService: ProjectTypePacksService,
  ) {}

  async onProjectCreated(
    project: Project,
    tenantId: string,
    input: CreateProjectInput,
  ): Promise<void> {
    if (!input.projectTypeId) {
      // Untyped projects — engine sees nothing to ask; completeness = 100.
      await this.completenessService.recompute('PROJECT', project.id);
      return;
    }

    const version = await this.projectTypesService.getCurrentVersion(
      input.projectTypeId,
      tenantId,
    );
    if (!version) {
      this.logger.warn(
        `ProjectType ${input.projectTypeId} has no version — skipping engine work`,
      );
      await this.completenessService.recompute('PROJECT', project.id);
      return;
    }

    // ─── Engine post-create work ───────────────────────────────────────────
    const links = await this.projectTypePacksService.listForProjectType(
      input.projectTypeId,
    );

    const linkedPacks = links.map((l) => ({
      key: l.questionPack.key,
      questions: Array.isArray(l.questionPack.questions)
        ? (l.questionPack.questions as never)
        : [],
    }));

    const resolved = await this.requirementsService.resolveForProjectType(
      version.informationRequirements ?? [],
      linkedPacks,
      {
        entityType: 'PROJECT',
        entityId: project.id,
        hasCustomer: !!project.customerId,
        classification: null,
        currentResponses: [],
      },
    );

    // Seed InformationResponse rows from customFieldValues (engine writes
    // customFieldValues too — see anti-patterns §12 rule #1).
    await this.seedResponsesFromCustomFields(project, input, resolved);
    // Per §4.2 step 1: only REQUIRED questions get a SYSTEM null fallback.
    // Optional questions are simply absent; their absence doesn't lower
    // completeness because they're not counted in totalRequired.
    await this.seedMissingAsSystemResponses(project, resolved);

    // Recompute against the responses we just wrote.
    const current = await this.responseService.listCurrent(
      'PROJECT',
      project.id,
    );
    await this.completenessService.recompute('PROJECT', project.id, {
      questions: resolved.map((q) => ({
        id: q.id,
        label: q.label,
        required: q.required,
        ...(q.skipIfConfidenceGte !== undefined
          ? { skipIfConfidenceGte: q.skipIfConfidenceGte }
          : {}),
      })),
      responses: current.map((r) => ({
        questionId: r.questionId,
        value: r.value,
        confidence: r.confidence,
      })),
    });

    this.logger.debug(
      `ProjectsAdapter: wrote ${current.length} responses for project ${project.id}`,
    );
  }

  private async seedResponsesFromCustomFields(
    project: Project,
    input: CreateProjectInput,
    resolved: {
      id: string;
      packKey: string;
      questionId: string;
      mapsTo?: { field: string };
    }[],
  ): Promise<void> {
    const values = input.customFieldValues ?? {};
    if (Object.keys(values).length === 0) return;

    for (const q of resolved) {
      const mapField = q.mapsTo?.field ?? '';
      const key = mapField.startsWith('customFieldValues.')
        ? mapField.slice('customFieldValues.'.length)
        : mapField || q.questionId;
      if (!(key in values)) continue;
      const value = values[key];
      if (value === null || value === undefined) continue;
      await this.responseService.record('PROJECT', project.id, {
        questionId: q.questionId,
        value,
        sourceType: 'USER_INPUT',
        sourceLabel: 'Initial project form',
        confidence: 100,
      });
    }
  }

  private async seedMissingAsSystemResponses(
    project: Project,
    resolved: {
      id: string;
      packKey: string;
      questionId: string;
      required: boolean;
    }[],
  ): Promise<void> {
    const existing = await this.responseService.listCurrent(
      'PROJECT',
      project.id,
    );
    const have = new Set(existing.map((r) => r.questionId));
    for (const q of resolved) {
      if (!q.required) continue; // optional questions are not seeded as SYSTEM nulls
      if (have.has(q.questionId)) continue;
      await this.responseService.record('PROJECT', project.id, {
        questionId: q.questionId,
        value: null,
        sourceType: 'SYSTEM',
        sourceLabel: 'Unanswered at create time',
        confidence: 0,
      });
    }
  }
}
