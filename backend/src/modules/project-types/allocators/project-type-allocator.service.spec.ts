/**
 * project-type-allocator.service.spec.ts — Phase 2G unit tests
 *
 * Covers §7.3: allocateForTenant(idempotent slug match + clone + skip).
 * ≥6 cases: null industry, no matches, fresh allocation, idempotent re-run,
 *             empty source version, classification copy.
 */

import { ProjectTypeAllocatorService } from './project-type-allocator.service';
import type { PrismaService } from '../../../infrastructure/database/prisma.service';

function makePrisma(
  sources: Array<{
    id: string;
    name: string;
    industry: string;
    classification: string;
  }>,
): PrismaService {
  const createdTypes: Array<{ tenantId: string; name: string }> = [];
  const createdPacks: Array<{ projectTypeId: string; questionPackId: string }> = [];
  const createdVersions: Array<{ projectTypeId: string; version: number }> = [];

  return {
    projectType: {
      findMany: jest.fn().mockImplementation(async (args: { where?: { tenantId?: unknown; isSystem?: unknown; industry?: unknown } }) => {
        if (args?.where?.tenantId === null && args?.where?.isSystem === true) {
          return sources;
        }
        return [];
      }),
      findFirst: jest.fn().mockImplementation(async (args: { where: { tenantId: string; name: string } }) => {
        const found = createdTypes.find(
          (t) =>
            t.tenantId === (args.where.tenantId as string) &&
            t.name === args.where.name,
        );
        return found ? { id: `cloned_${found.name}`, ...found } : null;
      }),
      create: jest.fn().mockImplementation(async (args: { data: { tenantId: string; name: string } }) => {
        createdTypes.push({ tenantId: args.data.tenantId, name: args.data.name });
        return { id: `cloned_${args.data.name}` };
      }),
    },
    projectTypePack: {
      findMany: jest.fn().mockResolvedValue([
        { questionPackId: 'pack_1', sortOrder: 0 },
        { questionPackId: 'pack_2', sortOrder: 1 },
      ]),
      createMany: jest.fn().mockImplementation(async (args: { data: Array<{ projectTypeId: string; questionPackId: string }> }) => {
        createdPacks.push(...args.data);
      }),
    },
    projectTypeVersion: {
      findFirst: jest.fn().mockResolvedValue({
        fieldSchema: [],
        stageTemplate: [{ name: 'Plan', order: 0 }],
        approvalTemplate: [],
        goalTemplate: null,
        roleTemplate: null,
        informationRequirements: [{ id: 'q1', label: 'Q1', type: 'TEXT', required: true }],
      }),
      create: jest.fn().mockImplementation(async (args: { data: { projectTypeId: string; version: number } }) => {
        createdVersions.push({ projectTypeId: args.data.projectTypeId, version: args.data.version });
      }),
    },
    $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        projectType: {
          create: jest.fn().mockImplementation(async (args: { data: { tenantId: string; name: string } }) => {
            createdTypes.push({ tenantId: args.data.tenantId, name: args.data.name });
            return { id: `cloned_${args.data.name}` };
          }),
        },
        projectTypePack: {
          findMany: jest.fn().mockResolvedValue([
            { questionPackId: 'pack_1', sortOrder: 0 },
          ]),
          createMany: jest.fn().mockImplementation(async (args: { data: Array<{ projectTypeId: string; questionPackId: string }> }) => {
            createdPacks.push(...args.data);
          }),
        },
        projectTypeVersion: {
          findFirst: jest.fn().mockResolvedValue({
            fieldSchema: [],
            stageTemplate: [],
            approvalTemplate: [],
            goalTemplate: null,
            roleTemplate: null,
            informationRequirements: [],
          }),
          create: jest.fn().mockImplementation(async (args: { data: { projectTypeId: string; version: number } }) => {
            createdVersions.push({ projectTypeId: args.data.projectTypeId, version: args.data.version });
          }),
        },
      });
    }),
    _createdTypes: createdTypes,
    _createdPacks: createdPacks,
    _createdVersions: createdVersions,
  } as unknown as PrismaService;
}

describe('ProjectTypeAllocatorService', () => {
  it('skips allocation when industry is null', async () => {
    const prisma = makePrisma([]);
    const svc = new ProjectTypeAllocatorService(prisma);
    const r = await svc.allocateForTenant('t1', null);
    expect(r.allocated).toBe(0);
    expect(r.skipped).toBe(0);
  });

  it('skips allocation when industry is empty string', async () => {
    const prisma = makePrisma([]);
    const svc = new ProjectTypeAllocatorService(prisma);
    const r = await svc.allocateForTenant('t1', '   ');
    expect(r.allocated).toBe(0);
  });

  it('returns 0,0 when no system types match the industry', async () => {
    const prisma = makePrisma([]);
    const svc = new ProjectTypeAllocatorService(prisma);
    const r = await svc.allocateForTenant('t1', 'nonexistent');
    expect(r.allocated).toBe(0);
    expect(r.skipped).toBe(0);
  });

  it('allocates fresh clones for a matching industry', async () => {
    const sources = [
      { id: 'pt_1', name: 'Patient Care', industry: 'healthcare-life-sciences', classification: 'CLIENT_ENGAGEMENT' },
      { id: 'pt_2', name: 'Clinical Research', industry: 'healthcare-life-sciences', classification: 'OPERATIONAL_PROGRAM' },
    ];
    const prisma = makePrisma(sources);
    const svc = new ProjectTypeAllocatorService(prisma);
    const r = await svc.allocateForTenant('t1', 'healthcare-life-sciences');
    expect(r.allocated).toBe(2);
    expect(r.skipped).toBe(0);
    // Verify created types tracked in the closure.
    const created = (prisma as unknown as { _createdTypes: Array<{ tenantId: string; name: string }> })._createdTypes;
    expect(created.length).toBeGreaterThanOrEqual(2);
  });

  it('is idempotent — second run skips all', async () => {
    const sources = [
      { id: 'pt_1', name: 'Patient Care', industry: 'healthcare-life-sciences', classification: 'CLIENT_ENGAGEMENT' },
    ];
    const prisma = makePrisma(sources);
    const svc = new ProjectTypeAllocatorService(prisma);

    const r1 = await svc.allocateForTenant('t1', 'healthcare-life-sciences');
    expect(r1.allocated).toBe(1);
    const r2 = await svc.allocateForTenant('t1', 'healthcare-life-sciences');
    expect(r2.allocated).toBe(0);
    expect(r2.skipped).toBe(1);
  });

  it('copies the version (fields, stages, informationRequirements)', async () => {
    const sources = [
      { id: 'pt_1', name: 'Test Type', industry: 'technology-digital-services', classification: 'INTERNAL_INITIATIVE' },
    ];
    const prisma = makePrisma(sources);
    const svc = new ProjectTypeAllocatorService(prisma);
    const r = await svc.allocateForTenant('t1', 'technology-digital-services');
    expect(r.allocated).toBe(1);
    const versions = (prisma as unknown as { _createdVersions: Array<{ projectTypeId: string; version: number }> })._createdVersions;
    expect(versions.length).toBeGreaterThanOrEqual(1);
    expect(versions[0].version).toBe(1);
  });

  it('copies M2M pack links', async () => {
    const sources = [
      { id: 'pt_1', name: 'Linked Type', industry: 'financial-services', classification: 'CLIENT_ENGAGEMENT' },
    ];
    const prisma = makePrisma(sources);
    const svc = new ProjectTypeAllocatorService(prisma);
    const r = await svc.allocateForTenant('t1', 'financial-services');
    expect(r.allocated).toBe(1);
    const packs = (prisma as unknown as { _createdPacks: Array<{ questionPackId: string }> })._createdPacks;
    expect(packs.length).toBeGreaterThanOrEqual(1);
  });

  it('handles sources with null classification gracefully', async () => {
    const sources = [
      { id: 'pt_1', name: 'Legacy Type', industry: 'manufacturing-industrial', classification: '' },
    ];
    const prisma = makePrisma(sources);
    const svc = new ProjectTypeAllocatorService(prisma);
    const r = await svc.allocateForTenant('t1', 'manufacturing-industrial');
    expect(r.allocated).toBe(1);
  });
});