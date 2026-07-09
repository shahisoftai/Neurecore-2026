/**
 * projects-engine.integration.spec.ts — Phase 2B integration tests
 *
 * Verifies ProjectsService.create() with engine ON:
 *   - When projectTypeId is set, the adapter resolves requirements,
 *     seeds InformationResponse rows, and writes EntityCompleteness.
 *   - When projectTypeId is null, the adapter still runs but writes
 *     an empty (score=100) completeness row.
 *   - Backwards-compat: validateCustomFields still fires for fieldSchema.
 *   - Stages are still auto-generated (delegated to repo).
 *
 * Uses Test.createTestingModule + manual providers per the codebase
 * pattern (see projects-lifecycle.integration.spec.ts).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from '../projects.service';
import { PROJECT_REPOSITORY } from '../interfaces/project.interface';
import type {
  IProjectRepository,
  Project,
} from '../interfaces/project.interface';
import type { ProjectTypeVersion } from '../../project-types/interfaces/project-type.interface';
import { ProjectsAdapter } from '../../information-engine/clients/projects.adapter';
import { RequirementsService } from '../../information-engine/requirements/requirements.service';
import { AdaptiveQuestioningService } from '../../information-engine/requirements/adaptive-questioning.service';
import { ResponseService } from '../../information-engine/responses/response.service';
import { CompletenessService } from '../../information-engine/completeness/completeness.service';
import { ProjectTypePacksService } from '../../information-engine/project-type-packs/project-type-packs.service';
import { SourceService } from '../../information-engine/sources/source.service';
import { QuestionPackService } from '../../information-engine/packs/question-packs.service';
import {
  COMPLETENESS_REPOSITORY,
  type ICompletenessRepository,
} from '../../information-engine/completeness/interfaces/completeness.interface';
import {
  RESPONSE_REPOSITORY,
  type IResponseRepository,
} from '../../information-engine/responses/interfaces/response.interface';
import {
  SOURCE_REPOSITORY,
  type ISourceRepository,
} from '../../information-engine/sources/interfaces/source.interface';
import {
  PROJECT_TYPE_PACK_REPOSITORY,
  type IProjectTypePackRepository,
} from '../../information-engine/project-type-packs/interfaces/project-type-pack.interface';
import {
  QUESTION_PACK_REPOSITORY,
  type IQuestionPackRepository,
} from '../../information-engine/packs/interfaces/question-pack.interface';

const TENANT_ID = 'tenant_1';
const PROJECT_ID = 'proj_1';

function makeProjectRepo(): jest.Mocked<IProjectRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findByDepartment: jest.fn(),
    update: jest.fn(),
    setStatus: jest.fn(),
    delete: jest.fn(),
    addGoal: jest.fn(),
    removeGoal: jest.fn(),
    createStages: jest.fn().mockResolvedValue(undefined),
    cloneFromProject: jest.fn(),
  } as unknown as jest.Mocked<IProjectRepository>;
}

function makeSourceRepo(): jest.Mocked<ISourceRepository> {
  let counter = 0;
  return {
    create: jest.fn().mockImplementation(async (input) => {
      counter += 1;
      return {
        id: `src_${counter}`,
        type: input.type,
        label: input.label,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        confidence: input.confidence,
        verified: false,
        verifiedBy: null,
        verifiedAt: null,
        createdAt: new Date(),
      };
    }),
    findById: jest.fn(),
    markVerified: jest.fn(),
  } as unknown as jest.Mocked<ISourceRepository>;
}

function makeResponseRepo(): jest.Mocked<IResponseRepository> {
  let counter = 0;
  return {
    findCurrentByEntityAndQuestion: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(async (input) => {
      counter += 1;
      return {
        id: `r_${counter}`,
        entityType: input.entityType,
        entityId: input.entityId,
        questionId: input.questionId,
        value: input.value,
        sourceId: input.sourceId,
        confidence: input.confidence,
        supersededById: null,
        createdAt: new Date(),
      };
    }),
    markSuperseded: jest.fn(),
    listCurrent: jest.fn().mockResolvedValue([]),
    listHistory: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<IResponseRepository>;
}

function makeCompletenessRepo(): jest.Mocked<ICompletenessRepository> {
  return {
    upsert: jest.fn().mockImplementation(async (input) => ({
      id: 'cmp_1',
      ...input,
    })),
    findByEntity: jest.fn(),
  } as unknown as jest.Mocked<ICompletenessRepository>;
}

function makeProjectTypePackRepo(): jest.Mocked<IProjectTypePackRepository> {
  return {
    listForProjectType: jest.fn().mockResolvedValue([]),
    replaceForProjectType: jest.fn(),
  } as unknown as jest.Mocked<IProjectTypePackRepository>;
}

function makeQuestionPackRepo(): jest.Mocked<IQuestionPackRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByKey: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<IQuestionPackRepository>;
}

function makeProjectTypesServiceStub(version: ProjectTypeVersion | null) {
  return {
    getCurrentVersion: jest.fn().mockResolvedValue(version),
    validateCustomFields: jest.fn(),
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: PROJECT_ID,
    tenantId: TENANT_ID,
    name: 'Test Project',
    description: null,
    status: 'LEAD',
    customerId: null,
    projectTypeId: null,
    projectTypeVersion: null,
    budgetType: null,
    budgetAmount: null,
    budgetCurrency: null,
    goalIds: [],
    departmentId: null,
    parentProjectId: null,
    clonedFromProjectId: null,
    lostReason: null,
    customFieldValues: null,
    targetDate: null,
    startDate: null,
    completedAt: null,
    priority: null,
    tags: [],
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ProjectsService.create — engine integration', () => {
  async function buildModule(opts: {
    projectRepo: jest.Mocked<IProjectRepository>;
    sourceRepo: jest.Mocked<ISourceRepository>;
    responseRepo: jest.Mocked<IResponseRepository>;
    completenessRepo: jest.Mocked<ICompletenessRepository>;
    packRepo: jest.Mocked<IProjectTypePackRepository>;
    questionPackRepo: jest.Mocked<IQuestionPackRepository>;
    projectTypesService: ReturnType<typeof makeProjectTypesServiceStub>;
  }): Promise<{
    service: ProjectsService;
    adapter: ProjectsAdapter;
    module: TestingModule;
  }> {
    // Construct ProjectsService directly — bypasses Nest DI complications.
    const adapter = new ProjectsAdapter(
      opts.projectRepo,
      opts.projectTypesService as never,
      new RequirementsService(),
      new ResponseService(opts.responseRepo, opts.sourceRepo as never),
      new CompletenessService(opts.completenessRepo),
      new ProjectTypePacksService(
        opts.packRepo,
        new QuestionPackService(opts.questionPackRepo),
      ),
    );

    const service = new ProjectsService(
      opts.projectRepo,
      opts.projectTypesService as never,
      adapter,
    );

    const module = {
      get: <T>(_token: unknown) => service as unknown as T,
    } as unknown as TestingModule;

    return { service, adapter, module };
  }

  it('with no projectTypeId: writes empty EntityCompleteness and skips engine work', async () => {
    const projectRepo = makeProjectRepo();
    const responseRepo = makeResponseRepo();
    const completenessRepo = makeCompletenessRepo();

    projectRepo.create.mockResolvedValue(makeProject({ projectTypeId: null }));

    const { service, adapter } = await buildModule({
      projectRepo,
      sourceRepo: makeSourceRepo(),
      responseRepo,
      completenessRepo,
      packRepo: makeProjectTypePackRepo(),
      questionPackRepo: makeQuestionPackRepo(),
      projectTypesService: makeProjectTypesServiceStub(null),
    });

    const adapterSpy = jest.spyOn(adapter, 'onProjectCreated');

    await service.create({ name: 'No-type' }, TENANT_ID);

    // eslint-disable-next-line no-console
    console.log('adapter called:', adapterSpy.mock.calls.length);
    // eslint-disable-next-line no-console
    console.log(
      'upsert calls:',
      (completenessRepo.upsert as jest.Mock).mock.calls.length,
    );

    expect(completenessRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'PROJECT',
        entityId: PROJECT_ID,
        score: 100,
        totalRequired: 0,
      }),
    );
    expect(responseRepo.create).not.toHaveBeenCalled();
  });

  it('with projectTypeId + informationRequirements: seeds responses and recomputes', async () => {
    const projectRepo = makeProjectRepo();
    const responseRepo = makeResponseRepo();
    const completenessRepo = makeCompletenessRepo();

    const version: ProjectTypeVersion = {
      id: 'v_1',
      projectTypeId: 'pt_1',
      version: 1,
      fieldSchema: [],
      stageTemplate: [],
      approvalTemplate: [],
      goalTemplate: null,
      roleTemplate: null,
      informationRequirements: [
        { id: 'taxYear', label: 'Tax Year', type: 'TEXT', required: true },
        {
          id: 'filingStatus',
          label: 'Filing Status',
          type: 'SELECT',
          required: false,
          options: ['single', 'married'],
        },
      ],
      createdAt: new Date(),
    };

    projectRepo.create.mockResolvedValue(
      makeProject({
        projectTypeId: 'pt_1',
        projectTypeVersion: 1,
        customFieldValues: { taxYear: '2026' },
      }),
    );

    // Mock listCurrent to return one answered question after seeding.
    responseRepo.listCurrent.mockResolvedValue([
      {
        id: 'r_1',
        entityType: 'PROJECT',
        entityId: PROJECT_ID,
        questionId: 'taxYear',
        value: '2026',
        sourceId: 'src_1',
        confidence: 100,
        supersededById: null,
        createdAt: new Date(),
      },
    ]);

    const { service } = await buildModule({
      projectRepo,
      sourceRepo: makeSourceRepo(),
      responseRepo,
      completenessRepo,
      packRepo: makeProjectTypePackRepo(),
      questionPackRepo: makeQuestionPackRepo(),
      projectTypesService: makeProjectTypesServiceStub(version),
    });

    await service.create(
      {
        name: 'Tax Return',
        projectTypeId: 'pt_1',
        customFieldValues: { taxYear: '2026' },
      },
      TENANT_ID,
    );

    // Exactly one required question (taxYear); answered → score 100.
    expect(completenessRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'PROJECT',
        entityId: PROJECT_ID,
        score: 100,
        totalRequired: 1,
      }),
    );

    // taxYear (required) was seeded from customFieldValues (USER_INPUT).
    // filingStatus (optional) should NOT be seeded as a SYSTEM null because
    // it's optional — we only seed missing required ones.
    const created = (responseRepo.create as jest.Mock).mock.calls.map(
      (c) => c[0],
    );
    const taxYearCalls = created.filter(
      (c: { questionId: string }) => c.questionId === 'taxYear',
    );
    const filingStatusCalls = created.filter(
      (c: { questionId: string }) => c.questionId === 'filingStatus',
    );
    expect(taxYearCalls.length).toBeGreaterThanOrEqual(1);
    expect(taxYearCalls[0].value).toBe('2026');
    expect(filingStatusCalls.length).toBe(0);
  });

  it('with projectTypeId + stageTemplate: still auto-generates stages', async () => {
    const projectRepo = makeProjectRepo();
    const responseRepo = makeResponseRepo();
    const completenessRepo = makeCompletenessRepo();

    const version: ProjectTypeVersion = {
      id: 'v_1',
      projectTypeId: 'pt_1',
      version: 1,
      fieldSchema: [],
      stageTemplate: [
        { name: 'Intake', order: 0 },
        { name: 'Review', order: 1 },
      ],
      approvalTemplate: [],
      goalTemplate: null,
      roleTemplate: null,
      informationRequirements: [],
      createdAt: new Date(),
    };

    projectRepo.create.mockResolvedValue(
      makeProject({ projectTypeId: 'pt_1', projectTypeVersion: 1 }),
    );

    const { service } = await buildModule({
      projectRepo,
      sourceRepo: makeSourceRepo(),
      responseRepo,
      completenessRepo,
      packRepo: makeProjectTypePackRepo(),
      questionPackRepo: makeQuestionPackRepo(),
      projectTypesService: makeProjectTypesServiceStub(version),
    });

    await service.create({ name: 'P', projectTypeId: 'pt_1' }, TENANT_ID);

    expect(projectRepo.createStages).toHaveBeenCalledWith(PROJECT_ID, [
      { name: 'Intake', order: 0, description: undefined },
      { name: 'Review', order: 1, description: undefined },
    ]);
  });

  it('validateCustomFields is still called for backwards-compat', async () => {
    const projectRepo = makeProjectRepo();
    const responseRepo = makeResponseRepo();
    const completenessRepo = makeCompletenessRepo();
    const projectTypesService = makeProjectTypesServiceStub({
      id: 'v_1',
      projectTypeId: 'pt_1',
      version: 1,
      fieldSchema: [
        { key: 'taxYear', label: 'Tax Year', type: 'TEXT', required: true },
      ],
      stageTemplate: [],
      approvalTemplate: [],
      goalTemplate: null,
      roleTemplate: null,
      informationRequirements: [],
      createdAt: new Date(),
    });

    projectRepo.create.mockResolvedValue(
      makeProject({ projectTypeId: 'pt_1', projectTypeVersion: 1 }),
    );

    const { service } = await buildModule({
      projectRepo,
      sourceRepo: makeSourceRepo(),
      responseRepo,
      completenessRepo,
      packRepo: makeProjectTypePackRepo(),
      questionPackRepo: makeQuestionPackRepo(),
      projectTypesService,
    });

    await service.create(
      {
        name: 'P',
        projectTypeId: 'pt_1',
        customFieldValues: { taxYear: '2026' },
      },
      TENANT_ID,
    );

    expect(projectTypesService.validateCustomFields).toHaveBeenCalledWith(
      [{ key: 'taxYear', label: 'Tax Year', type: 'TEXT', required: true }],
      { taxYear: '2026' },
    );
  });
});
