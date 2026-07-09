/**
 * projects-lifecycle.integration.spec.ts — Integration tests for the
 * project lifecycle state machine through ProjectsService.transitionStatus.
 *
 * Uses NestJS Testing utilities with a mocked IProjectRepository.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ProjectsService } from '../projects.service';
import type {
  IProjectRepository,
  Project,
} from '../interfaces/project.interface';
import { PROJECT_REPOSITORY } from '../interfaces/project.interface';

const TENANT_ID = 'test-tenant';
const PROJECT_ID = 'proj-1';

function makeRepository(
  overrides: Partial<IProjectRepository> = {},
): IProjectRepository {
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
    createStages: jest.fn(),
    cloneFromProject: jest.fn(),
    ...overrides,
  };
}

function makeProject(status: string): Project {
  return {
    id: PROJECT_ID,
    tenantId: TENANT_ID,
    name: 'Test Project',
    description: null,
    status: status as Project['status'],
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
  };
}

describe('ProjectsService — lifecycle integration', () => {
  let service: ProjectsService;
  let repo: jest.Mocked<IProjectRepository>;

  beforeEach(async () => {
    repo = makeRepository() as jest.Mocked<IProjectRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PROJECT_REPOSITORY, useValue: repo },
        { provide: 'PROJECT_TYPES_SERVICE', useValue: {} },
        // Phase 2B: ProjectsAdapter is optional. Lifecycle tests
        // don't exercise create(), so the adapter is omitted here.
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  describe('transitionStatus', () => {
    it('transitions LEAD → PROPOSAL_SENT', async () => {
      repo.findById.mockResolvedValue(makeProject('LEAD'));
      repo.setStatus.mockResolvedValue(makeProject('PROPOSAL_SENT'));

      const result = await service.transitionStatus(
        PROJECT_ID,
        TENANT_ID,
        'PROPOSAL_SENT',
      );

      expect(repo.setStatus).toHaveBeenCalledWith(
        PROJECT_ID,
        TENANT_ID,
        'PROPOSAL_SENT',
        {
          lostReason: undefined,
          completedAt: undefined,
        },
      );
      expect(result.status).toBe('PROPOSAL_SENT');
    });

    it('transitions PROPOSAL_SENT → WON', async () => {
      repo.findById.mockResolvedValue(makeProject('PROPOSAL_SENT'));
      repo.setStatus.mockResolvedValue(makeProject('WON'));

      const result = await service.transitionStatus(
        PROJECT_ID,
        TENANT_ID,
        'WON',
      );

      expect(repo.setStatus).toHaveBeenCalledWith(
        PROJECT_ID,
        TENANT_ID,
        'WON',
        {
          lostReason: undefined,
          completedAt: undefined,
        },
      );
      expect(result.status).toBe('WON');
    });

    it('transitions WON → ACTIVE', async () => {
      repo.findById.mockResolvedValue(makeProject('WON'));
      repo.setStatus.mockResolvedValue(makeProject('ACTIVE'));

      const result = await service.transitionStatus(
        PROJECT_ID,
        TENANT_ID,
        'ACTIVE',
      );

      expect(repo.setStatus).toHaveBeenCalledWith(
        PROJECT_ID,
        TENANT_ID,
        'ACTIVE',
        {
          lostReason: undefined,
          completedAt: undefined,
        },
      );
      expect(result.status).toBe('ACTIVE');
    });

    it('transitions through full pipeline: LEAD→PROPOSAL_SENT→WON→ACTIVE', async () => {
      const project = makeProject('LEAD');
      repo.findById.mockResolvedValue(project);
      repo.setStatus.mockResolvedValue(makeProject('PROPOSAL_SENT'));

      const step1 = await service.transitionStatus(
        PROJECT_ID,
        TENANT_ID,
        'PROPOSAL_SENT',
      );
      expect(step1.status).toBe('PROPOSAL_SENT');

      repo.findById.mockResolvedValue(makeProject('PROPOSAL_SENT'));
      repo.setStatus.mockResolvedValue(makeProject('WON'));

      const step2 = await service.transitionStatus(
        PROJECT_ID,
        TENANT_ID,
        'WON',
      );
      expect(step2.status).toBe('WON');

      repo.findById.mockResolvedValue(makeProject('WON'));
      repo.setStatus.mockResolvedValue(makeProject('ACTIVE'));

      const step3 = await service.transitionStatus(
        PROJECT_ID,
        TENANT_ID,
        'ACTIVE',
      );
      expect(step3.status).toBe('ACTIVE');
    });

    it('rejects invalid transition LEAD → WON', async () => {
      repo.findById.mockResolvedValue(makeProject('LEAD'));

      await expect(
        service.transitionStatus(PROJECT_ID, TENANT_ID, 'WON'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid transition ACTIVE → WON', async () => {
      repo.findById.mockResolvedValue(makeProject('ACTIVE'));

      await expect(
        service.transitionStatus(PROJECT_ID, TENANT_ID, 'WON'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects transition from ARCHIVED (terminal)', async () => {
      repo.findById.mockResolvedValue(makeProject('ARCHIVED'));

      await expect(
        service.transitionStatus(PROJECT_ID, TENANT_ID, 'ACTIVE'),
      ).rejects.toThrow(BadRequestException);
    });

    it('requires lostReason when transitioning to LOST', async () => {
      repo.findById.mockResolvedValue(makeProject('PROPOSAL_SENT'));

      await expect(
        service.transitionStatus(PROJECT_ID, TENANT_ID, 'LOST'),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts LOST transition with a reason', async () => {
      repo.findById.mockResolvedValue(makeProject('PROPOSAL_SENT'));
      repo.setStatus.mockResolvedValue(makeProject('LOST'));

      const result = await service.transitionStatus(
        PROJECT_ID,
        TENANT_ID,
        'LOST',
        'Client chose a competitor',
      );

      expect(repo.setStatus).toHaveBeenCalledWith(
        PROJECT_ID,
        TENANT_ID,
        'LOST',
        {
          lostReason: 'Client chose a competitor',
          completedAt: undefined,
        },
      );
      expect(result.status).toBe('LOST');
    });

    it('stamps completedAt when transitioning to COMPLETED', async () => {
      repo.findById.mockResolvedValue(makeProject('ACTIVE'));
      repo.setStatus.mockResolvedValue(makeProject('COMPLETED'));

      await service.transitionStatus(PROJECT_ID, TENANT_ID, 'COMPLETED');

      expect(repo.setStatus).toHaveBeenCalledWith(
        PROJECT_ID,
        TENANT_ID,
        'COMPLETED',
        {
          lostReason: undefined,
          completedAt: expect.any(Date) as Date,
        },
      );
    });

    it('transitions ACTIVE → ON_HOLD', async () => {
      repo.findById.mockResolvedValue(makeProject('ACTIVE'));
      repo.setStatus.mockResolvedValue(makeProject('ON_HOLD'));

      const result = await service.transitionStatus(
        PROJECT_ID,
        TENANT_ID,
        'ON_HOLD',
      );

      expect(result.status).toBe('ON_HOLD');
    });

    it('transitions ACTIVE → REVIEW', async () => {
      repo.findById.mockResolvedValue(makeProject('ACTIVE'));
      repo.setStatus.mockResolvedValue(makeProject('REVIEW'));

      const result = await service.transitionStatus(
        PROJECT_ID,
        TENANT_ID,
        'REVIEW',
      );

      expect(result.status).toBe('REVIEW');
    });

    it('transitions ON_HOLD → ACTIVE (resume)', async () => {
      repo.findById.mockResolvedValue(makeProject('ON_HOLD'));
      repo.setStatus.mockResolvedValue(makeProject('ACTIVE'));

      const result = await service.transitionStatus(
        PROJECT_ID,
        TENANT_ID,
        'ACTIVE',
      );

      expect(result.status).toBe('ACTIVE');
    });

    it('transitions REVIEW → COMPLETED', async () => {
      repo.findById.mockResolvedValue(makeProject('REVIEW'));
      repo.setStatus.mockResolvedValue(makeProject('COMPLETED'));

      const result = await service.transitionStatus(
        PROJECT_ID,
        TENANT_ID,
        'COMPLETED',
      );

      expect(result.status).toBe('COMPLETED');
      expect(repo.setStatus).toHaveBeenCalledWith(
        PROJECT_ID,
        TENANT_ID,
        'COMPLETED',
        {
          lostReason: undefined,
          completedAt: expect.any(Date) as Date,
        },
      );
    });

    it('transitions COMPLETED → ARCHIVED', async () => {
      repo.findById.mockResolvedValue(makeProject('COMPLETED'));
      repo.setStatus.mockResolvedValue(makeProject('ARCHIVED'));

      const result = await service.transitionStatus(
        PROJECT_ID,
        TENANT_ID,
        'ARCHIVED',
      );

      expect(result.status).toBe('ARCHIVED');
    });

    it('rejects transition when project is not found', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        service.transitionStatus('nonexistent', TENANT_ID, 'ACTIVE'),
      ).rejects.toThrow();
    });
  });
});
