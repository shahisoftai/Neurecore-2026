/**
 * GoogleDriveService — G8 share/permissions tests.
 */

import { GoogleDriveService } from '../google-drive.service';
import type { GoogleAuthClient } from '../google-auth.client';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../../../infrastructure/database/prisma.service';

const fakePrisma = {
  tenant: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  agent: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  integrationCredential: { findMany: jest.fn() },
  $disconnect: jest.fn(),
} as unknown as PrismaService;

const authClient = {
  getAccessToken: jest.fn().mockResolvedValue('fake-access-token'),
} as unknown as GoogleAuthClient;

const config = {
  get: jest.fn(() => undefined),
} as unknown as ConfigService;

function makeService(): GoogleDriveService {
  return new GoogleDriveService(authClient, config, fakePrisma);
}

let fetchSpy: jest.SpyInstance;

interface FetchCall {
  url: string;
  init: RequestInit;
}

function lastCall(): FetchCall {
  const call = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
  return { url: call[0] as string, init: (call[1] ?? {}) as RequestInit };
}

beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
      json: () =>
        Promise.resolve({
          id: 'perm-1',
          role: 'reader',
          type: 'user',
        }),
    } as Response),
  );
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('GoogleDriveService — G8 shareFile', () => {
  it('throws BadRequestException when type=user but no emailAddress', async () => {
    const svc = makeService();
    await expect(
      svc.shareFile('tenant-1', 'file-1', {
        role: 'reader',
        type: 'user',
      }),
    ).rejects.toThrow(/emailAddress is required/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when type=domain but no domain', async () => {
    const svc = makeService();
    await expect(
      svc.shareFile('tenant-1', 'file-1', {
        role: 'reader',
        type: 'domain',
      }),
    ).rejects.toThrow(/domain is required/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('POSTs to /drive/v3/files/{id}/permissions with role + emailAddress', async () => {
    const svc = makeService();
    const result = await svc.shareFile('tenant-1', 'file-1', {
      role: 'writer',
      type: 'user',
      emailAddress: 'alice@example.com',
    });

    const { url, init } = lastCall();
    expect(url).toContain('/drive/v3/files/file-1/permissions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      role: 'writer',
      type: 'user',
      emailAddress: 'alice@example.com',
    });

    expect(result).toEqual({ id: 'perm-1', role: 'reader', type: 'user' });
  });

  it('adds sendNotificationEmail=false query param when caller opts out', async () => {
    const svc = makeService();
    await svc.shareFile('tenant-1', 'file-1', {
      role: 'commenter',
      type: 'user',
      emailAddress: 'bob@example.com',
      sendNotification: false,
      emailMessage: 'Read me please.',
    });

    const { url } = lastCall();
    expect(url).toContain('sendNotificationEmail=false');
    expect(url).toContain('emailMessage=Read');
  });

  it('does not add sendNotificationEmail when caller accepts default true', async () => {
    const svc = makeService();
    await svc.shareFile('tenant-1', 'file-1', {
      role: 'reader',
      type: 'anyone',
    });

    const { url } = lastCall();
    expect(url).not.toContain('sendNotificationEmail');
  });

  it('throws BadRequestException when Drive API returns non-2xx', async () => {
    const svc = makeService();
    fetchSpy.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 403,
        text: () => Promise.resolve('forbidden'),
        json: () => Promise.resolve({}),
      } as Response),
    );

    await expect(
      svc.shareFile('tenant-1', 'file-1', {
        role: 'reader',
        type: 'user',
        emailAddress: 'x@y.com',
      }),
    ).rejects.toThrow(/Failed to share/);
  });
});

describe('GoogleDriveService — G8 listFilePermissions + revokeFilePermission', () => {
  it('lists permissions', async () => {
    const svc = makeService();
    fetchSpy.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            permissions: [
              {
                id: 'p1',
                role: 'reader',
                type: 'user',
                emailAddress: 'a@b.com',
              },
              { id: 'p2', role: 'writer', type: 'anyone' },
            ],
          }),
        text: () => Promise.resolve(''),
      } as Response),
    );

    const perms = await svc.listFilePermissions('tenant-1', 'file-1');
    expect(perms).toHaveLength(2);
    expect(perms[0].emailAddress).toBe('a@b.com');
    const { url } = lastCall();
    expect(url).toContain('/drive/v3/files/file-1/permissions');
    expect(url).toContain('supportsAllDrives=true');
  });

  it('DELETEs the specific permission', async () => {
    const svc = makeService();
    await svc.revokeFilePermission('tenant-1', 'file-1', 'perm-42');

    const { url, init } = lastCall();
    expect(url).toContain('/drive/v3/files/file-1/permissions/perm-42');
    expect(init.method).toBe('DELETE');
  });

  it('swallows 404 on revoke (idempotent)', async () => {
    const svc = makeService();
    fetchSpy.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
      } as Response),
    );
    await expect(
      svc.revokeFilePermission('tenant-1', 'file-1', 'perm-missing'),
    ).resolves.toBeUndefined();
  });

  it('throws on non-404 errors during revoke', async () => {
    const svc = makeService();
    fetchSpy.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve('boom'),
        json: () => Promise.resolve({}),
      } as Response),
    );
    await expect(
      svc.revokeFilePermission('tenant-1', 'file-1', 'perm-42'),
    ).rejects.toThrow(/Failed to revoke/);
  });
});
