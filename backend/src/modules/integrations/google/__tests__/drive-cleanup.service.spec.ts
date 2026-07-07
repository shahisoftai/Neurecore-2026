import { DriveCleanupService } from '../drive-cleanup.service';
import type { PrismaService } from '../../../../infrastructure/database/prisma.service';
import type { GoogleDriveService } from '../google-drive.service';
import type { NotificationsService } from '../../../notifications/services/notifications.service';
import type { NotificationType } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;
const REF_TIME = 1751875200000;

function daysAgo(days: number): Date {
  return new Date(REF_TIME - days * DAY_MS);
}

let prisma: {
  tenant: { findMany: jest.Mock };
  agent: { findMany: jest.Mock; update: jest.Mock };
  notification: { findFirst: jest.Mock };
  user: { findMany: jest.Mock };
};
let drive: { listFiles: jest.Mock; deleteFile: jest.Mock };
let notifications: { create: jest.Mock };
let service: DriveCleanupService;

beforeEach(() => {
  prisma = {
    tenant: { findMany: jest.fn() },
    agent: { findMany: jest.fn(), update: jest.fn() },
    notification: { findFirst: jest.fn() },
    user: { findMany: jest.fn() },
  };

  drive = {
    listFiles: jest.fn(),
    deleteFile: jest.fn(),
  };

  notifications = {
    create: jest.fn(),
  };

  service = new DriveCleanupService(
    prisma as unknown as PrismaService,
    drive as unknown as GoogleDriveService,
    notifications as unknown as NotificationsService,
  );
});

describe('DriveCleanupService', () => {
  describe('runCleanup', () => {
    it('returns zero counts when no tenants have Drive configured', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);

      const result = await service.runCleanup();

      expect(result).toEqual({ notified: 0, deleted: 0, skipped: 0 });
    });

    it('returns zero counts when no terminated agents found', async () => {
      prisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-1', retentionDays: 90 },
      ]);
      prisma.agent.findMany.mockResolvedValue([]);

      const result = await service.runCleanup();

      expect(result).toEqual({ notified: 0, deleted: 0, skipped: 0 });
    });

    it('sends notification for agents within 7-day window (not yet due for deletion)', async () => {
      jest.spyOn(Date, 'now').mockReturnValueOnce(REF_TIME).mockReturnValueOnce(REF_TIME - 15 * DAY_MS);

      const agentDate = daysAgo(94);
      prisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-1', retentionDays: 90 },
      ]);
      prisma.agent.findMany.mockResolvedValue([
        {
          id: 'agent-1',
          name: 'Test Agent',
          googleDriveFolderId: 'folder-1',
          updatedAt: agentDate,
        },
      ]);
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([{ id: 'user-1' }]);
      notifications.create.mockResolvedValue(undefined);

      const result = await service.runCleanup();

      expect(result.notified).toBe(1);
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          title: expect.stringContaining('Test Agent'),
          payload: { driveCleanupAgentId: 'agent-1' },
        }),
      );
    });

    it('skips sending notification when one already exists for this agent', async () => {
      jest.spyOn(Date, 'now').mockReturnValueOnce(REF_TIME).mockReturnValueOnce(REF_TIME - 15 * DAY_MS);

      const agentDate = daysAgo(94);
      prisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-1', retentionDays: 90 },
      ]);
      prisma.agent.findMany.mockResolvedValue([
        {
          id: 'agent-1',
          name: 'Test Agent',
          googleDriveFolderId: 'folder-1',
          updatedAt: agentDate,
        },
      ]);
      prisma.notification.findFirst.mockResolvedValue({ id: 'notif-1' });

      const result = await service.runCleanup();

      expect(result.notified).toBe(0);
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('deletes empty folder and clears agent.googleDriveFolderId for past-retention agents', async () => {
      const agentDate = daysAgo(100);
      prisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-1', retentionDays: 90 },
      ]);
      prisma.agent.findMany.mockResolvedValue([
        {
          id: 'agent-1',
          name: 'Old Agent',
          googleDriveFolderId: 'folder-1',
          updatedAt: agentDate,
        },
      ]);
      drive.listFiles.mockResolvedValue([]);
      drive.deleteFile.mockResolvedValue(undefined);
      prisma.agent.update.mockResolvedValue({});

      const result = await service.runCleanup();

      expect(result.deleted).toBe(1);
      expect(drive.listFiles).toHaveBeenCalledWith('tenant-1', 'folder-1', { pageSize: 100 });
      expect(drive.deleteFile).toHaveBeenCalledWith('tenant-1', 'folder-1');
      expect(prisma.agent.update).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        data: { googleDriveFolderId: null },
      });
    });

    it('skips non-empty folders (children.length > 0) for deletion, increments skipped count', async () => {
      const agentDate = daysAgo(100);
      prisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-1', retentionDays: 90 },
      ]);
      prisma.agent.findMany.mockResolvedValue([
        {
          id: 'agent-1',
          name: 'Old Agent',
          googleDriveFolderId: 'folder-1',
          updatedAt: agentDate,
        },
      ]);
      drive.listFiles.mockResolvedValue([{ id: 'child-1', name: 'file.txt' }]);

      const result = await service.runCleanup();

      expect(result.skipped).toBe(1);
      expect(drive.deleteFile).not.toHaveBeenCalled();
      expect(prisma.agent.update).not.toHaveBeenCalled();
    });
  });
});
