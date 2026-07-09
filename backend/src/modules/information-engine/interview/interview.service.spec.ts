/**
 * interview.service.spec.ts — Phase 2E unit tests
 *
 * Covers §9.5: ≥6 cases for askNext/parseReply plus structural shape tests.
 */

import { InterviewService } from './interview.service';
import type { ResolvedQuestion } from '../requirements/interfaces/requirements.interface';
import type { IRequirementsService } from '../requirements/interfaces/requirements.interface';
import type { IAdaptiveQuestioningService } from '../requirements/interfaces/requirements.interface';
import type { IResponseRepository, InformationResponse } from '../responses/interfaces/response.interface';
import type { ICompletenessRepository } from '../completeness/interfaces/completeness.interface';
import type { ProjectTypePacksService } from '../project-type-packs/project-type-packs.service';
import type { ProjectTypesService } from '../../project-types/project-types.service';
import { ResponseService } from '../responses/response.service';
import { CompletenessService } from '../completeness/completeness.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

const SAMPLE_QUESTIONS: ResolvedQuestion[] = [
  {
    id: 'core.projectName',
    packKey: 'core',
    questionId: 'projectName',
    label: 'Project name',
    type: 'TEXT',
    required: true,
    askVia: ['interview', 'form'],
  },
  {
    id: 'core.priority',
    packKey: 'core',
    questionId: 'priority',
    label: 'Priority',
    type: 'SELECT',
    required: true,
    options: ['LOW', 'MEDIUM', 'HIGH'],
    askVia: ['interview', 'form'],
  },
];

function makeProject(
  id: string,
  projectTypeId: string | null,
  customerId: string | null = null,
) {
  return { id, projectTypeId, customerId };
}

function makePrisma(project: ReturnType<typeof makeProject> | null) {
  return {
    project: {
      findUnique: jest.fn().mockResolvedValue(project),
    },
  } as unknown as PrismaService;
}

function makeRequirements(): IRequirementsService {
  return {
    resolveForProjectType: jest.fn().mockResolvedValue(SAMPLE_QUESTIONS),
  } as unknown as IRequirementsService;
}

function makeAdaptive(next: ResolvedQuestion | null) {
  return {
    pickNext: jest.fn().mockResolvedValue(next),
  } as unknown as IAdaptiveQuestioningService;
}

function makeProjectTypes(version: unknown) {
  return {
    getCurrentVersion: jest.fn().mockResolvedValue(version),
  } as unknown as ProjectTypesService;
}

function makeProjectTypePacks() {
  return {
    listForProjectType: jest.fn().mockResolvedValue([]),
  } as unknown as ProjectTypePacksService;
}

function makeResponseService() {
  const repo: jest.Mocked<IResponseRepository> = {
    findCurrentByEntityAndQuestion: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(
      async (input) =>
        ({
          id: `r_${Math.random()}`,
          entityType: input.entityType,
          entityId: input.entityId,
          questionId: input.questionId,
          value: input.value,
          sourceId: input.sourceId,
          confidence: input.confidence,
          supersededById: null,
          createdAt: new Date(),
        }) as InformationResponse,
    ),
    markSuperseded: jest.fn(),
    listCurrent: jest.fn().mockResolvedValue([]),
    listHistory: jest.fn().mockResolvedValue([]),
  };
  // Real SourceService with mocked repo so ResponseService can record.
  const sourceService = {
    create: jest.fn().mockImplementation(async (input) => ({
      id: `src_${Math.random()}`,
      type: input.type,
      label: input.label,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      confidence: input.confidence,
      verified: false,
      verifiedBy: null,
      verifiedAt: null,
      createdAt: new Date(),
    })),
    verify: jest.fn(),
  } as never;
  return { service: new ResponseService(repo, sourceService), repo };
}

function makeCompletenessService() {
  const repo: jest.Mocked<ICompletenessRepository> = {
    upsert: jest.fn().mockImplementation(async (input) => ({
      id: 'cmp_1',
      ...input,
    })),
    findByEntity: jest.fn(),
  } as unknown as jest.Mocked<ICompletenessRepository>;
  return new CompletenessService(repo);
}

function build(opts: {
  prisma?: ReturnType<typeof makePrisma>;
  projectTypeVersion?: unknown;
  next?: ResolvedQuestion | null;
  emptyResolved?: boolean;
}) {
  const prisma = opts.prisma ?? makePrisma(makeProject('p1', 'pt_1'));
  const requirements = opts.emptyResolved
    ? ({
        resolveForProjectType: jest.fn().mockResolvedValue([]),
      } as unknown as IRequirementsService)
    : makeRequirements();
  const adaptive = makeAdaptive(opts.next ?? SAMPLE_QUESTIONS[0]);
  const projectTypes = makeProjectTypes(
    opts.projectTypeVersion ?? {
      id: 'v_1',
      projectTypeId: 'pt_1',
      version: 1,
      fieldSchema: [],
      stageTemplate: [],
      approvalTemplate: [],
      goalTemplate: null,
      roleTemplate: null,
      informationRequirements: [],
      createdAt: new Date(),
    },
  );
  const projectTypePacks = makeProjectTypePacks();
  const { service: responseService } = makeResponseService();
  const completenessService = makeCompletenessService();

  const svc = new InterviewService(
    prisma,
    projectTypes,
    projectTypePacks,
    requirements,
    adaptive,
    responseService,
    completenessService,
  );

  return {
    svc,
    prisma,
    requirements,
    adaptive,
    projectTypes,
    projectTypePacks,
    responseService,
    completenessService,
  };
}

describe('InterviewService', () => {
  it('askNext returns prompt + question + completeness', async () => {
    const { svc, completenessService } = build({});
    jest.spyOn(completenessService, 'get').mockResolvedValue({
      entityType: 'PROJECT',
      entityId: 'p1',
      score: 0,
      totalRequired: 2,
      totalResolved: 0,
      missing: [],
      lastAssessedAt: new Date(),
    });

    const turn = await svc.askNext('p1', 't1', {});
    expect(turn.question?.questionId).toBe('projectName');
    expect(turn.prompt).toContain('Project name');
    expect(turn.completeness.totalRequired).toBe(2);
  });

  it('askNext returns "all done" prompt when no questions are open', async () => {
    const { svc, adaptive } = build({ next: null });
    jest.spyOn(adaptive, 'pickNext').mockResolvedValue(null);
    const turn = await svc.askNext('p1', 't1', {});
    expect(turn.question).toBeNull();
    expect(turn.prompt).toMatch(/all required information has been captured/i);
  });

  it('parseReply accepts "Label: value" pairs', async () => {
    const { svc, responseService } = build({});
    const recorded: InformationResponse[] = [];
    jest.spyOn(responseService, 'record').mockImplementation(async (_entityType, _entityId, dto) => {
      const r = {
        id: `r_${recorded.length}`,
        entityType: 'PROJECT' as const,
        entityId: 'p1',
        questionId: dto.questionId,
        value: dto.value,
        sourceId: 's',
        confidence: 80,
        supersededById: null,
        createdAt: new Date(),
      };
      recorded.push(r);
      return r;
    });
    jest.spyOn(responseService, 'listCurrent').mockResolvedValue([]);

    const out = await svc.parseReply(
      'p1',
      't1',
      'Project name: Q4 launch\nPriority: HIGH',
      {},
    );
    expect(out.extracted.length).toBe(2);
    expect(out.completeness.totalRequired).toBe(2);
  });

  it('parseReply falls back to assigning the message to the current open question', async () => {
    const { svc, responseService } = build({});
    let recordedCount = 0;
    jest.spyOn(responseService, 'record').mockImplementation(async (_entityType, _entityId, dto) => {
      recordedCount += 1;
      return {
        id: `r_${recordedCount}`,
        entityType: 'PROJECT',
        entityId: 'p1',
        questionId: dto.questionId,
        value: dto.value,
        sourceId: 's',
        confidence: 80,
        supersededById: null,
        createdAt: new Date(),
      };
    });
    jest.spyOn(responseService, 'listCurrent').mockResolvedValue([]);

    const out = await svc.parseReply('p1', 't1', 'just a free-form answer', {});
    expect(out.extracted.length).toBeGreaterThanOrEqual(1);
  });

  it('parseReply throws on empty message', async () => {
    const { svc } = build({});
    await expect(svc.parseReply('p1', 't1', '   \n  ', {})).rejects.toThrow(
      /non-whitespace character/i,
    );
  });

  it('parseReply throws when no questions exist', async () => {
    const { svc } = build({ emptyResolved: true });
    await expect(
      svc.parseReply('p1', 't1', 'Project name: x', {}),
    ).rejects.toThrow(/no questions/i);
  });

  it('parseReply throws when no question match can be found AND no current question is open', async () => {
    const { svc, adaptive, requirements } = build({});
    jest.spyOn(adaptive, 'pickNext').mockResolvedValue(null);
    (requirements.resolveForProjectType as jest.Mock)
      .mockResolvedValueOnce(SAMPLE_QUESTIONS)
      .mockResolvedValueOnce([]);
    await expect(
      svc.parseReply('p1', 't1', 'this matches nothing', {}),
    ).rejects.toThrow(/Could not match/);
  });
});
