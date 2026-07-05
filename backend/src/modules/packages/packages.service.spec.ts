/**
 * PackagesService — unit tests for the WHERE builder (composition + preview
 * require DB, so we only test the static builder here to keep fast).
 */

import { PackagesService } from './packages.service';
import { PackageDeploymentService } from './services/package-deployment.service';

describe('PackagesService — Phase 10 Package Pool', () => {
  let service: PackagesService;

  beforeEach(() => {
    service = new PackagesService({} as never);
  });

  it('exposes the composition contract', () => {
    expect(typeof service.list).toBe('function');
    expect(typeof service.getById).toBe('function');
    expect(typeof service.getBySlug).toBe('function');
    expect(typeof service.create).toBe('function');
    expect(typeof service.update).toBe('function');
    expect(typeof service.remove).toBe('function');
    expect(typeof service.updateComposition).toBe('function');
    expect(typeof service.preview).toBe('function');
  });

  it('builds a WhereInput that ignores unknown statuses (forward-compat)', () => {
    const where = (
      service as unknown as { buildWhere: (o: unknown) => unknown }
    ).buildWhere({
      status: 'INVALID',
    });
    expect(where).toEqual({});
  });

  it('builds a WhereInput with OR search', () => {
    const where = (
      service as unknown as { buildWhere: (o: unknown) => unknown }
    ).buildWhere({
      search: 'hospital',
    });
    expect(where).toHaveProperty('OR');
  });

  it('accepts DRAFT/PUBLISHED/ARCHIVED statuses', () => {
    for (const status of ['DRAFT', 'PUBLISHED', 'ARCHIVED']) {
      const where = (
        service as unknown as { buildWhere: (o: unknown) => unknown }
      ).buildWhere({
        status,
      });
      expect((where as { status: string }).status).toBe(status);
    }
  });
});

describe('PackageDeploymentService — surface contract', () => {
  it('exposes the deploy + preview contract', () => {
    const svc = new PackageDeploymentService({} as never, {} as never);
    expect(typeof svc.preview).toBe('function');
    expect(typeof svc.deploy).toBe('function');
  });
});
