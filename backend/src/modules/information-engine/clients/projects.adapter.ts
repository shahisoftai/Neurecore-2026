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
import { ProjectCompletenessService } from './project-completeness.service';

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
    private readonly projectCompleteness: ProjectCompletenessService,
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
    // Seed top-level Project fields (name, description, targetDate) that
    // were collected in Essentials but not stored in customFieldValues.
    // This prevents Discovery from re-asking questions whose answers are
    // already in the project record.
    await this.seedFromProjectTopLevelFields(project, resolved);
    // Per §4.2 step 1: only REQUIRED questions get a SYSTEM null fallback.
    // Optional questions are simply absent; their absence doesn't lower
    // completeness because they're not counted in totalRequired.
    await this.seedMissingAsSystemResponses(project, resolved);

    // Recompute completeness against the responses we just wrote. Delegated
    // to the shared ProjectCompletenessService so the resolve→recompute
    // sequence lives in ONE place (Phase 1.1) and matches on local ids.
    const snapshot = await this.projectCompleteness.recomputeForProject(
      project.id,
      tenantId,
    );

    this.logger.debug(
      `ProjectsAdapter: onProjectCreated ${project.id} → ` +
        `${snapshot.score}% (${snapshot.totalResolved}/${snapshot.totalRequired})`,
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

  /**
   * Seed answers from top-level Project fields that were collected in the
   * Essentials form but are not stored in customFieldValues.
   *
   * Maps:
   *   questionId "projectName"       → Project.name
   *   questionId "projectDescription" → Project.description
   *   questionId "targetEndDate"     → Project.targetDate
   *
   * This runs AFTER seedResponsesFromCustomFields so any customFieldValues
   * answers take precedence. It runs BEFORE seedMissingAsSystemResponses
   * so these questions receive USER_INPUT responses and are not re-asked
   * in the Discovery tab.
   */
  private async seedFromProjectTopLevelFields(
    project: Project,
    resolved: {
      id: string;
      packKey: string;
      questionId: string;
      mapsTo?: { field: string };
    }[],
  ): Promise<void> {
    const topLevelMappings: Array<{
      questionId: string;
      value: unknown;
    }> = [];

    if (project.name) {
      topLevelMappings.push({ questionId: 'projectName', value: project.name });
    }
    if (project.description) {
      topLevelMappings.push({ questionId: 'projectDescription', value: project.description });
    }
    if (project.targetDate) {
      topLevelMappings.push({ questionId: 'targetEndDate', value: project.targetDate });
    }

    if (topLevelMappings.length === 0) return;

    const resolvedByQid = new Map(resolved.map((q) => [q.questionId, q]));

    for (const mapping of topLevelMappings) {
      const q = resolvedByQid.get(mapping.questionId);
      if (!q) continue;
      if (
        mapping.value === null ||
        mapping.value === undefined ||
        mapping.value === ''
      ) {
        continue;
      }
      await this.responseService.record('PROJECT', project.id, {
        questionId: q.questionId,
        value: mapping.value,
        sourceType: 'USER_INPUT',
        sourceLabel: 'Initial project form (top-level field)',
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
