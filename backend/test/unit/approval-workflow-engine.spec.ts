import { ApprovalWorkflowEngine } from '../../src/modules/hermes/services/approval-workflow.engine';

function buildMocks() {
  const mockPrisma = {
    approvalWorkflow: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    approvalWorkflowStep: {
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  };

  const mockNotifications = {
    create: jest.fn(),
  };

  const svc = new ApprovalWorkflowEngine(mockPrisma as any, mockNotifications as any);

  return { svc, prisma: mockPrisma, notifications: mockNotifications };
}

function mockWorkflow(overrides: any = {}) {
  return {
    id: 'wf-1',
    name: 'Test Workflow',
    workflowType: 'BUDGET',
    status: 'PENDING',
    currentStep: 0,
    context: {},
    requesterId: 'user-1',
    tenantId: 'tenant-1',
    workspaceId: null,
    routineRunId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    steps: [
      {
        id: 'step-1',
        approvalWorkflowId: 'wf-1',
        stepOrder: 0,
        approverRole: ['ADMIN'],
        approverId: null,
        status: 'PENDING',
        decision: null,
        comment: null,
        decidedAt: null,
      },
    ],
    ...overrides,
  };
}

describe('ApprovalWorkflowEngine', () => {
  let svc: ApprovalWorkflowEngine;
  let prisma: ReturnType<typeof buildMocks>['prisma'];
  let notifications: ReturnType<typeof buildMocks>['notifications'];

  beforeEach(() => {
    const mocks = buildMocks();
    svc = mocks.svc;
    prisma = mocks.prisma;
    notifications = mocks.notifications;
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a workflow with steps', async () => {
      const wf = mockWorkflow({ steps: [{ ...mockWorkflow().steps[0], approverId: 'admin-user' }] });
      prisma.approvalWorkflow.create.mockResolvedValue(wf);

      const result = await svc.create({
        name: 'Test Workflow',
        workflowType: 'BUDGET',
        context: { amount: 5000 },
        steps: [{ stepOrder: 0, approverRole: ['ADMIN'], approverId: 'admin-user' }],
        requesterId: 'user-1',
        tenantId: 'tenant-1',
      });

      expect(result.name).toBe('Test Workflow');
      expect(result.status).toBe('PENDING');
      expect(prisma.approvalWorkflow.create).toHaveBeenCalled();
      expect(notifications.create).toHaveBeenCalled();
    });

    it('should throw if no steps provided', async () => {
      await expect(
        svc.create({
          name: 'Test',
          workflowType: 'BUDGET',
          context: {},
          steps: [],
          requesterId: 'user-1',
          tenantId: 'tenant-1',
        }),
      ).rejects.toThrow('At least one approval step is required');
    });
  });

  describe('advance', () => {
    it('should approve last step and complete workflow', async () => {
      const wf = mockWorkflow({ currentStep: 0, steps: [{ ...mockWorkflow().steps[0], stepOrder: 0 }] });
      prisma.approvalWorkflow.findUnique.mockResolvedValue(wf);
      prisma.approvalWorkflow.findFirst.mockResolvedValue(wf);
      prisma.user.findFirst.mockResolvedValue({ id: 'user-admin', role: 'ADMIN', tenantId: 'tenant-1' });
      prisma.approvalWorkflow.update.mockResolvedValue({
        ...wf,
        status: 'APPROVED',
        completedAt: new Date(),
      });

      const result = await svc.advance('wf-1', 'user-admin', 'APPROVED', 'Looks good');

      expect(result.status).toBe('APPROVED');
    });

    it('should throw if workflow not found', async () => {
      prisma.approvalWorkflow.findUnique.mockResolvedValue(null);

      await expect(svc.advance('nonexistent', 'user-1', 'APPROVED')).rejects.toThrow();
    });

    it('should throw if workflow not pending', async () => {
      prisma.approvalWorkflow.findUnique.mockResolvedValue(mockWorkflow({ status: 'APPROVED' }));

      await expect(svc.advance('wf-1', 'user-1', 'APPROVED')).rejects.toThrow('not pending');
    });

    it('should reject and complete workflow', async () => {
      const wf = mockWorkflow();
      prisma.approvalWorkflow.findUnique.mockResolvedValue(wf);
      prisma.approvalWorkflow.findFirst.mockResolvedValue(wf);
      prisma.user.findFirst.mockResolvedValue({ id: 'user-admin', role: 'ADMIN', tenantId: 'tenant-1' });
      prisma.approvalWorkflow.update.mockResolvedValue({
        ...wf,
        status: 'REJECTED',
        completedAt: new Date(),
      });

      const result = await svc.advance('wf-1', 'user-admin', 'REJECTED', 'Too expensive');

      expect(result.status).toBe('REJECTED');
    });
  });

  describe('cancel', () => {
    it('should cancel a pending workflow', async () => {
      prisma.approvalWorkflow.findUnique.mockResolvedValue(mockWorkflow());
      prisma.approvalWorkflow.update.mockResolvedValue({ ...mockWorkflow(), status: 'CANCELLED' });

      await svc.cancel('wf-1', 'user-1', 'Changed my mind');

      expect(prisma.approvalWorkflow.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'wf-1' },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('should throw if workflow not pending', async () => {
      prisma.approvalWorkflow.findUnique.mockResolvedValue(mockWorkflow({ status: 'APPROVED' }));

      await expect(svc.cancel('wf-1', 'user-1')).rejects.toThrow('Only pending workflows can be cancelled');
    });
  });

  describe('getStatus', () => {
    it('should return workflow descriptor', async () => {
      const wf = mockWorkflow();
      prisma.approvalWorkflow.findFirst.mockResolvedValue(wf);

      const result = await svc.getStatus('wf-1', 'tenant-1');

      expect(result?.id).toBe('wf-1');
      expect(result?.status).toBe('PENDING');
    });

    it('should return null if not found', async () => {
      prisma.approvalWorkflow.findFirst.mockResolvedValue(null);

      const result = await svc.getStatus('nonexistent', 'tenant-1');

      expect(result).toBeNull();
    });
  });

  describe('canApprove', () => {
    it('should return true when user has matching role', async () => {
      prisma.approvalWorkflow.findFirst.mockResolvedValue(mockWorkflow());
      prisma.user.findFirst.mockResolvedValue({ id: 'user-admin', role: 'ADMIN', tenantId: 'tenant-1' });

      const result = await svc.canApprove('wf-1', 'user-admin', 'tenant-1');

      expect(result).toBe(true);
    });

    it('should return false when user does not have matching role', async () => {
      prisma.approvalWorkflow.findFirst.mockResolvedValue(mockWorkflow());
      prisma.user.findFirst.mockResolvedValue({ id: 'user-user', role: 'USER', tenantId: 'tenant-1' });

      const result = await svc.canApprove('wf-1', 'user-user', 'tenant-1');

      expect(result).toBe(false);
    });

    it('should return false when workflow is not pending', async () => {
      prisma.approvalWorkflow.findFirst.mockResolvedValue(mockWorkflow({ status: 'APPROVED' }));

      const result = await svc.canApprove('wf-1', 'user-admin', 'tenant-1');

      expect(result).toBe(false);
    });
  });

  describe('getPendingForApprover', () => {
    it('should return pending workflows for approver', async () => {
      const wf = mockWorkflow();
      prisma.user.findFirst.mockResolvedValue({ id: 'user-admin', role: 'ADMIN', tenantId: 'tenant-1' });
      prisma.approvalWorkflow.findMany.mockResolvedValue([wf]);

      const results = await svc.getPendingForApprover('user-admin', 'tenant-1');

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('wf-1');
    });

    it('should return empty array when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const results = await svc.getPendingForApprover('unknown', 'tenant-1');

      expect(results).toEqual([]);
    });
  });

  describe('expire', () => {
    it('should expire a pending workflow', async () => {
      prisma.approvalWorkflow.findUnique.mockResolvedValue(mockWorkflow());
      prisma.approvalWorkflow.update.mockResolvedValue({ ...mockWorkflow(), status: 'EXPIRED' });

      await svc.expire('wf-1');

      expect(prisma.approvalWorkflow.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'wf-1' },
          data: expect.objectContaining({ status: 'EXPIRED' }),
        }),
      );
    });

    it('should not expire already completed workflow', async () => {
      prisma.approvalWorkflow.findUnique.mockResolvedValue(mockWorkflow({ status: 'APPROVED' }));

      await svc.expire('wf-1');

      expect(prisma.approvalWorkflow.update).not.toHaveBeenCalled();
    });
  });

  describe('expireOldWorkflows', () => {
    it('should expire workflows older than specified hours', async () => {
      prisma.approvalWorkflow.updateMany.mockResolvedValue({ count: 2 });

      const result = await svc.expireOldWorkflows(48);

      expect(result).toBe(2);
    });

    it('should return 0 when no workflows to expire', async () => {
      prisma.approvalWorkflow.updateMany.mockResolvedValue({ count: 0 });

      const result = await svc.expireOldWorkflows(48);

      expect(result).toBe(0);
    });
  });
});
