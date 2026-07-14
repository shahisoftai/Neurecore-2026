/**
 * project-completeness.service.spec.ts — Phase 1.1 unit tests
 *
 * Proves the reactive completeness sequence owned by
 * ProjectCompletenessService:
 *   - recording a required answer increases totalResolved;
 *   - an optional answer does not alter required completeness;
 *   - superseded answers are not double-counted;
 *   - appliesWhen (hasCustomer) changes the applicable required set;
 *   - null/string/number/boolean/array/object values are supported;
 *   - tenant isolation is preserved (findById is tenant-scoped).
 *
 * These are pure unit tests over mocked ports — no DB, no HTTP.
 */

import { ProjectCompletenessService } from './project-completeness.service';
import { RequirementsService } from '../requirements/requirements.service';
import { CompletenessService } from '../completeness/completeness.service';
import type { IProjectRepository, Project } from '../../projects/interfaces/project.interface';
import type { ICompletenessRepository } from '../completeness/interfaces/completeness.interface';

const TENANT = 'tenant_1';
const PID = 'proj_1';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: PID,
    tenantId: TENANT,
    name: 'P',
    description: null,
    status: 'LEAD',
    customerId: null,
    projectTypeId: 'pt_1',
    projectTypeVersion: 1,
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

// Two required + one optional inline requirement. `customerName` is required
// but only applies when the project has a customer (appliesWhen.hasCustomer).
const VERSION_REQUIREMENTS = [
  { id: 'projectName', label: 'Name', type: 'TEXT' as const, required: true },
  { id: 'priority', label: 'Priority', type: 'TEXT' as const, required: true },
  { id: 'notes', label: 'Notes', type: 'TEXT' as const, required: false },
  {
    id: 'customerName',
    label: 'Customer name',
    type: 'TEXT' as const,
    required: true,
    appliesWhen: { hasCustomer: true },
  },
];

function buildService(opts: {
  project: Project;
  currentResponses: Array<{ questionId: string; value: unknown; confidence: number }>;
}) {
  const projectRepo = {
    findById: jest.fn(async (id: string, tenantId: string) => {
      // Tenant isolation: only return when tenant matches.
      if (id === opts.project.id && tenantId === opts.project.tenantId) {
        return opts.project;
      }
      return null;
    }),
  } as unknown as jest.Mocked<IProjectRepository>;

  const projectTypesService = {
    getCurrentVersion: jest.fn().mockResolvedValue({
      id: 'v1',
      projectTypeId: 'pt_1',
      version: 1,
      fieldSchema: [],
      stageTemplate: [],
      approvalTemplate: [],
      goalTemplate: null,
      roleTemplate: null,
      informationRequirements: VERSION_REQUIREMENTS,
      createdAt: new Date(),
    }),
  };

  const projectTypePacksService = {
    listForProjectType: jest.fn().mockResolvedValue([]),
  };

  const responseService = {
    listCurrent: jest.fn().mockResolvedValue(opts.currentResponses),
  };

  let lastSnapshot: unknown = null;
  const completenessRepo = {
    upsert: jest.fn(async (s) => {
      lastSnapshot = s;
      return { id: 'c1', ...s };
    }),
    findByEntity: jest.fn(),
  } as unknown as jest.Mocked<ICompletenessRepository>;

  const completenessService = new CompletenessService(completenessRepo);
  const requirementsService = new RequirementsService();

  const svc = new ProjectCompletenessService(
    projectRepo,
    projectTypesService as never,
    projectTypePacksService as never,
    requirementsService,
    responseService as never,
    completenessService,
  );

  return { svc, projectRepo, getLastSnapshot: () => lastSnapshot };
}

describe('ProjectCompletenessService (Phase 1.1)', () => {
  it('recording a required answer increases totalResolved', async () => {
    // No customer → customerName does NOT apply. 2 required (projectName, priority).
    const withNone = buildService({
      project: makeProject({ customerId: null }),
      currentResponses: [],
    });
    const snap0 = await withNone.svc.recomputeForProject(PID, TENANT);
    expect(snap0.totalRequired).toBe(2);
    expect(snap0.totalResolved).toBe(0);

    const withOne = buildService({
      project: makeProject({ customerId: null }),
      currentResponses: [{ questionId: 'projectName', value: 'Acme', confidence: 100 }],
    });
    const snap1 = await withOne.svc.recomputeForProject(PID, TENANT);
    expect(snap1.totalRequired).toBe(2);
    expect(snap1.totalResolved).toBe(1);
    expect(snap1.score).toBe(50);
  });

  it('recording an optional answer does not alter required completeness', async () => {
    const svc = buildService({
      project: makeProject({ customerId: null }),
      currentResponses: [{ questionId: 'notes', value: 'hello', confidence: 100 }],
    });
    const snap = await svc.svc.recomputeForProject(PID, TENANT);
    // notes is optional → not counted in totalRequired, does not raise resolved.
    expect(snap.totalRequired).toBe(2);
    expect(snap.totalResolved).toBe(0);
    expect(snap.score).toBe(0);
  });

  it('superseded answers are not double-counted (listCurrent excludes them)', async () => {
    // listCurrent already returns only current rows; recompute must count 1.
    const svc = buildService({
      project: makeProject({ customerId: null }),
      currentResponses: [
        { questionId: 'projectName', value: 'NewName', confidence: 100 },
      ],
    });
    const snap = await svc.svc.recomputeForProject(PID, TENANT);
    expect(snap.totalResolved).toBe(1);
    // Only one current projectName counted; no double count.
    expect(snap.totalRequired).toBe(2);
  });

  it('appliesWhen(hasCustomer) changes the applicable required set', async () => {
    // WITHOUT customer → 2 required.
    const noCust = buildService({
      project: makeProject({ customerId: null }),
      currentResponses: [],
    });
    const s1 = await noCust.svc.recomputeForProject(PID, TENANT);
    expect(s1.totalRequired).toBe(2);

    // WITH customer → customerName becomes applicable → 3 required.
    const withCust = buildService({
      project: makeProject({ customerId: 'cust_1' }),
      currentResponses: [],
    });
    const s2 = await withCust.svc.recomputeForProject(PID, TENANT);
    expect(s2.totalRequired).toBe(3);
  });

  it('supports null/string/number/boolean/array/object response values', async () => {
    const cases: Array<{ value: unknown; resolved: boolean }> = [
      { value: 'text', resolved: true },
      { value: 42, resolved: true },
      { value: true, resolved: true },
      { value: ['a', 'b'], resolved: true },
      { value: { k: 'v' }, resolved: true },
      { value: null, resolved: false }, // null = unanswered
    ];
    for (const c of cases) {
      const svc = buildService({
        project: makeProject({ customerId: null }),
        currentResponses: [
          { questionId: 'projectName', value: c.value, confidence: 100 },
          { questionId: 'priority', value: 'HIGH', confidence: 100 },
        ],
      });
      const snap = await svc.svc.recomputeForProject(PID, TENANT);
      // priority always resolved; projectName resolved iff value is non-null.
      expect(snap.totalResolved).toBe(c.resolved ? 2 : 1);
    }
  });

  it('preserves tenant isolation (wrong tenant returns empty snapshot)', async () => {
    const svc = buildService({
      project: makeProject({ customerId: null }),
      currentResponses: [{ questionId: 'projectName', value: 'X', confidence: 100 }],
    });
    // Wrong tenant → findById returns null → empty snapshot (0 required).
    const snap = await svc.svc.recomputeForProject(PID, 'other_tenant');
    expect(snap.totalRequired).toBe(0);
    expect(snap.score).toBe(100);
  });
});
