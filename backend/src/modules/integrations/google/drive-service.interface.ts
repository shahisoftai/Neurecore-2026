import type { DriveFile, CreateFolderInput, CreateFileInput } from './google-drive.service';

/**
 * WS-4.2: Drive service abstraction (Interface Segregation + DIP).
 *
 * Tools that read/write Drive depend on this interface, not on GoogleDriveService.
 * Allows swapping the implementation (e.g., Dropbox, OneDrive) without consumer changes.
 */
export interface IDriveService {
  createFolder(tenantId: string, input: CreateFolderInput): Promise<DriveFile>;
  createFile(tenantId: string, input: CreateFileInput): Promise<DriveFile>;
  listFiles(
    tenantId: string,
    folderId: string,
    options?: { pageSize?: number },
  ): Promise<DriveFile[]>;
  deleteFile(tenantId: string, fileId: string): Promise<void>;
  listAgentFolders(tenantId: string): Promise<{
    rootFolderId: string;
    agents: { agentId: string; agentName: string; folderId: string; folderLink?: string }[];
  }>;
  listRootTree(tenantId: string): Promise<{
    rootFolderId: string | null;
    children: { id: string; name: string; mimeType: string; webViewLink?: string; children: DriveFile[] }[];
  }>;
}

export const DRIVE_SERVICE = Symbol('DRIVE_SERVICE');
