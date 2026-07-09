/**
 * source.service.spec.ts — Phase 2B unit tests
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SourceService } from './source.service';
import type { ISourceRepository } from './interfaces/source.interface';

function makeService(): {
  service: SourceService;
  repo: jest.Mocked<ISourceRepository>;
} {
  const repo: jest.Mocked<ISourceRepository> = {
    create: jest.fn(),
    findById: jest.fn(),
    markVerified: jest.fn(),
  } as unknown as jest.Mocked<ISourceRepository>;
  return { service: new SourceService(repo), repo };
}

describe('SourceService', () => {
  it('create validates confidence range', async () => {
    const { service } = makeService();
    await expect(
      service.create(
        { type: 'USER_INPUT', label: 'lbl', confidence: -1 },
        'user_1',
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create(
        { type: 'USER_INPUT', label: 'lbl', confidence: 101 },
        'user_1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('create rejects empty label', async () => {
    const { service } = makeService();
    await expect(
      service.create(
        { type: 'USER_INPUT', label: '   ', confidence: 50 },
        'user_1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('findById throws NotFound when missing', async () => {
    const { service, repo } = makeService();
    repo.findById.mockResolvedValue(null);
    await expect(service.findById('x')).rejects.toThrow(NotFoundException);
  });

  it('verify is idempotent (returns same source if already verified)', async () => {
    const { service, repo } = makeService();
    const verified = {
      id: 's1',
      type: 'USER_INPUT' as const,
      label: 'lbl',
      refType: null,
      refId: null,
      confidence: 100,
      verified: true,
      verifiedBy: 'u1',
      verifiedAt: new Date(),
      createdAt: new Date(),
    };
    repo.findById.mockResolvedValue(verified);
    const r = await service.verify('s1', 'u1');
    expect(r).toBe(verified);
    expect(repo.markVerified).not.toHaveBeenCalled();
  });

  it('verify calls markVerified when not yet verified', async () => {
    const { service, repo } = makeService();
    repo.findById
      .mockResolvedValueOnce({
        id: 's1',
        type: 'USER_INPUT',
        label: 'lbl',
        refType: null,
        refId: null,
        confidence: 100,
        verified: false,
        verifiedBy: null,
        verifiedAt: null,
        createdAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 's1',
        type: 'USER_INPUT',
        label: 'lbl',
        refType: null,
        refId: null,
        confidence: 100,
        verified: true,
        verifiedBy: 'u1',
        verifiedAt: new Date(),
        createdAt: new Date(),
      });
    repo.markVerified.mockResolvedValue({
      id: 's1',
      type: 'USER_INPUT',
      label: 'lbl',
      refType: null,
      refId: null,
      confidence: 100,
      verified: true,
      verifiedBy: 'u1',
      verifiedAt: new Date(),
      createdAt: new Date(),
    });
    await service.verify('s1', 'u1');
    expect(repo.markVerified).toHaveBeenCalledWith('s1', 'u1');
  });
});
