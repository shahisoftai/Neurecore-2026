// services/__tests__/tiers.service.spec.ts — Phase 6 unit tests.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// The service imports the default axios instance from @/services/api.
// Mock the default export so `api.post(...)` is a jest.fn.
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '@/services/api';
import { tiersService } from '../tiers.service';

describe('tiersService — Phase 6 requestTierChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POSTs to /tenants/me/tier-change-requests with toTierId + reason', async () => {
    const fakeResponse = {
      requestId: 'cr-1',
      direction: 'UPGRADE' as const,
      status: 'PENDING' as const,
      toTier: { id: 'tier-pro', slug: 'professional', name: 'Professional' },
    };
    vi.mocked(api.post).mockResolvedValue({
      data: fakeResponse,
    });

    const result = await tiersService.requestTierChange(
      'tier-pro',
      'We need approval chains',
    );

    expect(api.post).toHaveBeenCalledWith(
      '/tenants/me/tier-change-requests',
      { toTierId: 'tier-pro', reason: 'We need approval chains' },
    );
    expect(result).toEqual(fakeResponse);
  });

  it('omits reason when not provided', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        requestId: 'cr-2',
        direction: 'DOWNGRADE' as const,
        status: 'PENDING' as const,
        toTier: { id: 'tier-basic', slug: 'basic', name: 'Basic' },
      },
    });

    await tiersService.requestTierChange('tier-basic');

    expect(api.post).toHaveBeenCalledWith(
      '/tenants/me/tier-change-requests',
      { toTierId: 'tier-basic', reason: undefined },
    );
  });

  it('list() returns the catalogue (no new behaviour)', async () => {
    const tiers = [
      { id: 'tier-basic', slug: 'basic', name: 'Basic', monthlyPrice: 0, yearlyPrice: 0, currency: 'USD', maxUsers: 3, maxAgents: 3, maxDepartments: 1, maxStorageGB: 1, maxApiCalls: 100, maxFileSizeMB: 10 },
    ];
    vi.mocked(api.get).mockResolvedValue({ data: tiers });
    const result = await tiersService.list();
    expect(result).toEqual(tiers);
  });
});
