import { FinanceHermesAgentFactory, FINANCE_CAPABILITIES, FINANCE_TOOL_PERMISSIONS } from '../../src/modules/hermes/agents/finance-hermes-agent';
import { ToolPermissionLevel, HermesAgentType } from '@prisma/client';

function buildMocks() {
  const mockRegistry = {
    register: jest.fn(),
    findByType: jest.fn(),
    addCapability: jest.fn(),
    setToolPermissions: jest.fn(),
  };

  const svc = new FinanceHermesAgentFactory(mockRegistry as any);

  return { svc, registry: mockRegistry };
}

describe('FinanceHermesAgentFactory', () => {
  let svc: FinanceHermesAgentFactory;
  let registry: ReturnType<typeof buildMocks>['registry'];

  beforeEach(() => {
    const { svc: service, registry: reg } = buildMocks();
    svc = service;
    registry = reg;
    jest.clearAllMocks();
  });

  describe('FINANCE_CAPABILITIES', () => {
    it('should have invoice_processing capability', () => {
      const cap = FINANCE_CAPABILITIES.find((c) => c.name === 'invoice_processing');
      expect(cap).toBeDefined();
      expect(cap?.inputSchema.required).toContain('invoiceId');
      expect(cap?.inputSchema.required).toContain('amount');
    });

    it('should have expense_review capability', () => {
      const cap = FINANCE_CAPABILITIES.find((c) => c.name === 'expense_review');
      expect(cap).toBeDefined();
    });

    it('should have budget_query capability', () => {
      const cap = FINANCE_CAPABILITIES.find((c) => c.name === 'budget_query');
      expect(cap).toBeDefined();
    });

    it('should have financial_report_generation capability', () => {
      const cap = FINANCE_CAPABILITIES.find((c) => c.name === 'financial_report_generation');
      expect(cap).toBeDefined();
    });

    it('should have vendor_verification capability', () => {
      const cap = FINANCE_CAPABILITIES.find((c) => c.name === 'vendor_verification');
      expect(cap).toBeDefined();
    });
  });

  describe('FINANCE_TOOL_PERMISSIONS', () => {
    it('should allow read_invoice', () => {
      const perm = FINANCE_TOOL_PERMISSIONS.find((p) => p.toolName === 'read_invoice');
      expect(perm?.permission).toBe(ToolPermissionLevel.ALLOW);
    });

    it('should require approval for approve_invoice', () => {
      const perm = FINANCE_TOOL_PERMISSIONS.find((p) => p.toolName === 'approve_invoice');
      expect(perm?.permission).toBe(ToolPermissionLevel.APPROVAL_REQUIRED);
      expect(perm?.conditions).toEqual({ maxAmount: 10000 });
    });

    it('should require approval for approve_expense', () => {
      const perm = FINANCE_TOOL_PERMISSIONS.find((p) => p.toolName === 'approve_expense');
      expect(perm?.permission).toBe(ToolPermissionLevel.APPROVAL_REQUIRED);
      expect(perm?.conditions).toEqual({ maxAmount: 5000 });
    });

    it('should set web_search to READ_ONLY', () => {
      const perm = FINANCE_TOOL_PERMISSIONS.find((p) => p.toolName === 'web_search');
      expect(perm?.permission).toBe(ToolPermissionLevel.READ_ONLY);
    });
  });

  describe('createFinanceAgent', () => {
    it('should register agent with FINANCE type', async () => {
      const mockAgent = {
        id: 'agent-finance-1',
        name: 'FinanceHermes',
        type: HermesAgentType.FINANCE,
        status: 'IDLE' as const,
        isActive: true,
        tenantId: 'tenant-1',
        permissions: [],
      };
      registry.register.mockResolvedValueOnce(mockAgent);
      registry.addCapability.mockResolvedValue({ id: 'cap-1' });
      registry.setToolPermissions.mockResolvedValue(undefined);

      const agent = await svc.createFinanceAgent('tenant-1', 'ws-1');

      expect(registry.register).toHaveBeenCalledWith(
        expect.objectContaining({
          type: HermesAgentType.FINANCE,
          name: 'FinanceHermes',
          isActive: true,
        }),
        'tenant-1',
      );
    });

    it('should register all 5 capabilities', async () => {
      const mockAgent = { id: 'agent-1', type: HermesAgentType.FINANCE, status: 'IDLE', isActive: true, tenantId: 'tenant-1', permissions: [] };
      registry.register.mockResolvedValueOnce(mockAgent);
      registry.addCapability.mockResolvedValue({ id: 'cap-1' });
      registry.setToolPermissions.mockResolvedValue(undefined);

      await svc.createFinanceAgent('tenant-1', 'ws-1');

      expect(registry.addCapability).toHaveBeenCalledTimes(5);
    });

    it('should set tool permissions', async () => {
      const mockAgent = { id: 'agent-1', type: HermesAgentType.FINANCE, status: 'IDLE', isActive: true, tenantId: 'tenant-1', permissions: [] };
      registry.register.mockResolvedValueOnce(mockAgent);
      registry.addCapability.mockResolvedValue({ id: 'cap-1' });
      registry.setToolPermissions.mockResolvedValue(undefined);

      await svc.createFinanceAgent('tenant-1', 'ws-1');

      expect(registry.setToolPermissions).toHaveBeenCalledWith(
        'agent-1',
        expect.arrayContaining([
          expect.objectContaining({ toolName: 'approve_invoice' }),
        ]),
        'tenant-1',
      );
    });

    it('should use custom name from config', async () => {
      const mockAgent = { id: 'agent-1', type: HermesAgentType.FINANCE, status: 'IDLE', isActive: true, tenantId: 'tenant-1', permissions: [] };
      registry.register.mockResolvedValueOnce(mockAgent);
      registry.addCapability.mockResolvedValue({ id: 'cap-1' });
      registry.setToolPermissions.mockResolvedValue(undefined);

      await svc.createFinanceAgent('tenant-1', 'ws-1', { name: 'MyFinanceBot' });

      expect(registry.register).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'MyFinanceBot' }),
        'tenant-1',
      );
    });
  });

  describe('findFinanceAgent', () => {
    it('should return first finance agent found', async () => {
      const mockAgent = { id: 'agent-1', type: HermesAgentType.FINANCE };
      registry.findByType.mockResolvedValueOnce([mockAgent]);

      const result = await svc.findFinanceAgent('tenant-1');
      expect(result).toEqual(mockAgent);
    });

    it('should return null when no finance agent found', async () => {
      registry.findByType.mockResolvedValueOnce([]);

      const result = await svc.findFinanceAgent('tenant-1');
      expect(result).toBeNull();
    });
  });

  describe('ensureFinanceAgent', () => {
    it('should return existing agent if found', async () => {
      const existingAgent = { id: 'agent-1', type: HermesAgentType.FINANCE };
      registry.findByType.mockResolvedValueOnce([existingAgent]);

      const result = await svc.ensureFinanceAgent('tenant-1', 'ws-1');
      expect(result).toEqual(existingAgent);
      expect(registry.register).not.toHaveBeenCalled();
    });

    it('should create new agent if none exists', async () => {
      registry.findByType.mockResolvedValueOnce([]);
      const mockAgent = { id: 'new-agent', type: HermesAgentType.FINANCE, status: 'IDLE', isActive: true, tenantId: 'tenant-1', permissions: [] };
      registry.register.mockResolvedValueOnce(mockAgent);
      registry.addCapability.mockResolvedValue({ id: 'cap-1' });
      registry.setToolPermissions.mockResolvedValue(undefined);

      const result = await svc.ensureFinanceAgent('tenant-1', 'ws-1');

      expect(registry.register).toHaveBeenCalled();
      expect(result.id).toBe('new-agent');
    });
  });
});
