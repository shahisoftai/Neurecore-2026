import { HermesRouterService } from '../../src/modules/hermes/services/hermes-router.service';
import { HermesAgentType } from '@prisma/client';

function buildMocks() {
  const mockRegistry = {
    findByType: jest.fn(),
    findAll: jest.fn(),
  };

  const svc = new HermesRouterService(mockRegistry as any);
  return { svc, registry: mockRegistry };
}

describe('HermesRouterService', () => {
  let svc: HermesRouterService;
  let registry: ReturnType<typeof buildMocks>['registry'];

  beforeEach(() => {
    const { svc: service, registry: reg } = buildMocks();
    svc = service;
    registry = reg;
    jest.clearAllMocks();
  });

  describe('route', () => {
    it('should route finance tasks to FINANCE agent', async () => {
      registry.findByType.mockResolvedValueOnce([{ id: 'finance-1', type: HermesAgentType.FINANCE, isActive: true }]);

      const result = await svc.route('Process invoice #123 for $5,000', 'tenant-1');

      expect(result.agentType).toBe(HermesAgentType.FINANCE);
      expect(result.confidence).toBe(0.9);
    });

    it('should route HR tasks to HR agent', async () => {
      registry.findByType.mockResolvedValueOnce([{ id: 'hr-1', type: HermesAgentType.HR, isActive: true }]);

      const result = await svc.route('Onboard new employee John starting Monday', 'tenant-1');

      expect(result.agentType).toBe(HermesAgentType.HR);
    });

    it('should route sales tasks to SALES agent', async () => {
      registry.findByType.mockResolvedValueOnce([{ id: 'sales-1', type: HermesAgentType.SALES, isActive: true }]);

      const result = await svc.route('Follow up with lead from Acme Corp about the enterprise deal', 'tenant-1');

      expect(result.agentType).toBe(HermesAgentType.SALES);
    });

    it('should route marketing tasks to MARKETING agent', async () => {
      registry.findByType.mockResolvedValueOnce([{ id: 'mkt-1', type: HermesAgentType.MARKETING, isActive: true }]);

      const result = await svc.route('Create a social media campaign for product launch', 'tenant-1');

      expect(result.agentType).toBe(HermesAgentType.MARKETING);
    });

    it('should route security tasks to SECURITY agent', async () => {
      registry.findByType.mockResolvedValueOnce([{ id: 'sec-1', type: HermesAgentType.SECURITY, isActive: true }]);

      const result = await svc.route('Check for vulnerabilities in the authentication flow', 'tenant-1');

      expect(result.agentType).toBe(HermesAgentType.SECURITY);
    });

    it('should use preferred agent type when provided', async () => {
      registry.findByType.mockResolvedValueOnce([{ id: 'hr-1', type: HermesAgentType.HR, isActive: true }]);

      const result = await svc.route('What is the revenue forecast?', 'tenant-1', HermesAgentType.HR);

      expect(result.agentType).toBe(HermesAgentType.HR);
      expect(result.confidence).toBe(1.0);
      expect(result.reasoning).toContain('Preferred');
    });

    it('should fall back to first available agent when no match', async () => {
      registry.findByType.mockResolvedValue([]);
      registry.findAll.mockResolvedValueOnce({ data: [{ id: 'any-1', type: HermesAgentType.CUSTOM, isActive: true }] });

      const result = await svc.route('Do something generic', 'tenant-1');

      expect(result.confidence).toBe(0.5);
      expect(result.reasoning).toContain('Fallback');
    });

    it('should throw when no agents available', async () => {
      registry.findByType.mockResolvedValue([]);
      registry.findAll.mockResolvedValueOnce({ data: [] });

      await expect(svc.route('Any task', 'tenant-1')).rejects.toThrow('No active Hermes agents found');
    });

    it('should not use inactive agents', async () => {
      registry.findByType.mockResolvedValueOnce([{ id: 'finance-1', type: HermesAgentType.FINANCE, isActive: false }]);
      registry.findAll.mockResolvedValueOnce({ data: [{ id: 'sales-1', type: HermesAgentType.SALES, isActive: true }] });

      const result = await svc.route('Invoice processing', 'tenant-1');

      expect(result.agentType).toBe(HermesAgentType.SALES);
    });
  });

  describe('keyword classification', () => {
    it('should classify customer support tasks by refund keyword', async () => {
      registry.findByType.mockResolvedValueOnce([{ id: 'cs-1', type: HermesAgentType.CUSTOMER_SUPPORT, isActive: true }]);

      const result = await svc.route('Request a refund for my recent purchase', 'tenant-1');

      expect(result.agentType).toBe(HermesAgentType.CUSTOMER_SUPPORT);
    });

    it('should classify engineering tasks', async () => {
      registry.findByType.mockResolvedValueOnce([{ id: 'eng-1', type: HermesAgentType.ENGINEERING, isActive: true }]);

      const result = await svc.route('Debug the API endpoint returning 500 errors', 'tenant-1');

      expect(result.agentType).toBe(HermesAgentType.ENGINEERING);
    });

    it('should classify QA tasks', async () => {
      registry.findByType.mockResolvedValueOnce([{ id: 'qa-1', type: HermesAgentType.QA, isActive: true }]);

      const result = await svc.route('Run regression tests on the checkout flow', 'tenant-1');

      expect(result.agentType).toBe(HermesAgentType.QA);
    });

    it('should classify research tasks', async () => {
      registry.findByType.mockResolvedValueOnce([{ id: 'res-1', type: HermesAgentType.RESEARCH, isActive: true }]);

      const result = await svc.route('Analyze market data for Q4 trends', 'tenant-1');

      expect(result.agentType).toBe(HermesAgentType.RESEARCH);
    });
  });
});
