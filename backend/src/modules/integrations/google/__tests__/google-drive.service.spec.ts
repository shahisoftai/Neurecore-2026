/**
 * GoogleDriveService — unit tests for G5 and G6 fixes.
 *
 *  - G5: createFolder requests `webViewLink` in the Drive fields param.
 *  - G6: searchFiles uses `name contains` for mode='name' (default) and
 *        `fullText contains` for mode='fulltext'; mimeType filter is appended.
 */

import { GoogleDriveService } from '../google-drive.service';
import type { GoogleAuthClient } from '../google-auth.client';
import type { ConfigService } from '@nestjs/config';

// Minimal mock for the Prisma client inside GoogleDriveService. Only fields
// actually touched by the code under test are stubbed.
const prismaStub = {
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
};

class FakePrisma {
  tenant = prismaStub.tenant;
  agent = prismaStub.agent;
  integrationCredential = { findMany: jest.fn() };
  $disconnect = jest.fn();
}

const authClient = {
  getAccessToken: jest.fn().mockResolvedValue('fake-access-token'),
} as unknown as GoogleAuthClient;

const config = {
  get: jest.fn((key: string) => {
    if (key === 'DRIVE_CLEANUP_INTERVAL_MS') return 86_400_000;
    return undefined;
  }),
} as unknown as ConfigService;

function makeService(): GoogleDriveService {
  // Direct construction; we override prisma after to avoid importing PrismaClient
  // into the test graph (its constructor would require DATABASE_URL).
  const svc = new GoogleDriveService(authClient, config);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (svc as unknown as { prisma: FakePrisma }).prisma = new FakePrisma();
  return svc;
}

interface FetchCall {
  url: string;
  init: RequestInit;
}

let fetchSpy: jest.SpyInstance;

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
      json: () => Promise.resolve({ files: [] }),
    } as Response),
  );
});

afterEach(() => {
  fetchSpy.mockRestore();
  prismaStub.tenant.findUnique.mockReset();
  prismaStub.tenant.update.mockReset();
  prismaStub.agent.findUnique.mockReset();
  prismaStub.agent.findMany.mockReset();
  prismaStub.agent.update.mockReset();
  (authClient.getAccessToken as jest.Mock).mockReset();
  (authClient.getAccessToken as jest.Mock).mockResolvedValue('fake-access-token');
});

describe('GoogleDriveService — G5 webViewLink on createFolder', () => {
  it('requests webViewLink in the fields parameter when creating a folder', async () => {
    const svc = makeService();
    prismaStub.tenant.findUnique.mockResolvedValue({ googleDriveRootFolderId: 'root-id' });
    fetchSpy.mockImplementation((url: string | URL | Request) =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({
            id: 'new-folder-id',
            name: 'Test',
            mimeType: 'application/vnd.google-apps.folder',
            webViewLink: 'https://drive.google.com/folders/new-folder-id',
          }),
      } as Response),
    );

    const result = await svc.createFolder('tenant-1', { name: 'Test', parentId: 'root-id' });

    const { url } = lastCall();
    expect(url).toContain('/drive/v3/files');
    expect(url).toContain('fields=');
    expect(decodeURIComponent(url)).toContain('webViewLink');

    expect(result.id).toBe('new-folder-id');
    expect(result.webViewLink).toBe('https://drive.google.com/folders/new-folder-id');
  });

  it('returns existing folder when one with the same name+parent is found, without calling POST', async () => {
    const svc = makeService();
    const existing = {
      id: 'existing-id',
      name: 'Test',
      mimeType: 'application/vnd.google-apps.folder',
      webViewLink: 'https://drive.google.com/folders/existing-id',
    };
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [existing] }),
        text: () => Promise.resolve(''),
      } as Response),
    );

    const result = await svc.createFolder('tenant-1', { name: 'Test', parentId: 'root-id' });

    expect(result).toEqual(existing);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const { url } = lastCall();
    expect(url).toContain('q=');
    // The POST endpoint must NOT have been called for the no-create path.
    expect(url).not.toContain('uploadType=multipart');
  });
});

describe('GoogleDriveService — G6 searchFiles mode', () => {
  it("uses `name contains` when mode='name' (default)", async () => {
    const svc = makeService();
    await svc.searchFiles('tenant-1', 'budget');

    const { url } = lastCall();
    expect(url).toContain('name+contains');
    expect(url).toContain('budget');
    expect(url).not.toContain('fullText');
  });

  it("uses `fullText contains` when mode='fulltext'", async () => {
    const svc = makeService();
    await svc.searchFiles('tenant-1', 'quarterly', { mode: 'fulltext' });

    const { url } = lastCall();
    expect(url).toContain('fullText+contains');
    expect(url).not.toContain('name+contains');
  });

  it('appends mimeType filter when provided', async () => {
    const svc = makeService();
    await svc.searchFiles('tenant-1', 'Q3', {
      mode: 'name',
      mimeType: 'application/vnd.google-apps.spreadsheet',
    });

    const { url } = lastCall();
    expect(url).toContain('name+contains');
    expect(url).toContain('application%2Fvnd.google-apps.spreadsheet');
  });
});
