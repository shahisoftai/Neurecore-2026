/**
 * IntegrationsService — G7 adminDisconnectGoogle tests.
 *
 * Verifies the service-level behaviour: NotFound when no cred exists,
 * happy-path returns `{ revoked: true, hadCalendar }`, and that the
 * underlying `disconnectGoogle` (Prisma update + credential delete)
 * is invoked. The controller's audit logging is exercised in the e2e
 * integration test, not here.
 */

import { NotFoundException } from '@nestjs/common';
import { IntegrationsService } from '../integrations.service';
import { PrismaIntegrationCredentialStore } from '../services/integration-credential.store';
import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { ConfigService } from '@nestjs/config';

const credentialStore = {
  exists: jest.fn(),
  delete: jest.fn().mockResolvedValue(undefined),
} as unknown as PrismaIntegrationCredentialStore;

const tenant = {
  findUnique: jest.fn(),
  update: jest.fn().mockResolvedValue(undefined),
};

const agent = {
  findUnique: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
};

const prisma = {
  tenant,
  agent,
  integrationCredential: { findMany: jest.fn() },
} as unknown as PrismaService;

const config = {
  get: jest.fn(() => undefined),
} as unknown as ConfigService;

function makeService(): IntegrationsService {
  return new IntegrationsService(
    credentialStore,
    config,
    prisma,
  );
}

beforeEach(() => {
  (credentialStore.exists as jest.Mock).mockReset();
  (credentialStore.delete as jest.Mock).mockReset();
  tenant.findUnique.mockReset();
  tenant.update.mockReset();
  // Default: tenant findUnique returns no calendarId; update returns an
  // empty record (the service chains `.catch()` on the returned promise so
  // it must resolve successfully).
  tenant.findUnique.mockResolvedValue({ googleCalendarId: null, name: 't' });
  tenant.update.mockResolvedValue({} as never);
});

describe('IntegrationsService — G7 adminDisconnectGoogle', () => {
  it('throws NotFoundException when no Google credential exists', async () => {
    const svc = makeService();
    (credentialStore.exists as jest.Mock).mockResolvedValue(false);
    await expect(svc.adminDisconnectGoogle('tenant-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(credentialStore.delete as jest.Mock).not.toHaveBeenCalled();
  });

  it('returns hadCalendar=false when tenant had no calendarId', async () => {
    const svc = makeService();
    (credentialStore.exists as jest.Mock).mockResolvedValue(true);
    tenant.findUnique.mockResolvedValue({ googleCalendarId: null, name: 't' });

    const result = await svc.adminDisconnectGoogle('tenant-x');
    expect(result).toEqual({ tenantId: 'tenant-x', revoked: true, hadCalendar: false });
    expect(credentialStore.delete as jest.Mock).toHaveBeenCalledTimes(1);
  });

  it('returns hadCalendar=true when tenant had a calendarId', async () => {
    const svc = makeService();
    (credentialStore.exists as jest.Mock).mockResolvedValue(true);
    tenant.findUnique.mockResolvedValue({ googleCalendarId: 'cal-123', name: 't' });

    const result = await svc.adminDisconnectGoogle('tenant-y');
    expect(result.hadCalendar).toBe(true);
  });

  it('invokes the credential store delete and tenant update', async () => {
    const svc = makeService();
    (credentialStore.exists as jest.Mock).mockResolvedValue(true);
    tenant.update.mockResolvedValue({ id: 'tenant-z', googleDriveRootFolderId: null, googleCalendarId: null });

    await svc.adminDisconnectGoogle('tenant-z');

    expect(credentialStore.delete as jest.Mock).toHaveBeenCalledWith(
      'tenant-z',
      'GOOGLE',
    );
    // Two tenant.update calls: one for credential delete (none), one for clear
    // (yes — googleDriveRootFolderId/googleCalendarId = null).
    expect(tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-z' },
      data: { googleDriveRootFolderId: null, googleCalendarId: null },
    });
  });
});
