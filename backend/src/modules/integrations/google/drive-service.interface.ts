import type {
  DriveFile,
  CreateFolderInput,
  CreateFileInput,
} from './google-drive.service';

export interface ShareFileInput {
  role: 'reader' | 'writer' | 'commenter';
  type: 'user' | 'group' | 'domain' | 'anyone';
  emailAddress?: string;
  domain?: string;
  sendNotification?: boolean;
  emailMessage?: string;
}

export interface DrivePermission {
  id: string;
  role: string;
  type: string;
  emailAddress?: string;
  domain?: string;
}

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
    agents: {
      agentId: string;
      agentName: string;
      folderId: string;
      folderLink?: string;
    }[];
  }>;
  listRootTree(tenantId: string): Promise<{
    rootFolderId: string | null;
    children: {
      id: string;
      name: string;
      mimeType: string;
      webViewLink?: string;
      children: DriveFile[];
    }[];
  }>;
  findFolderByName(
    tenantId: string,
    name: string,
    parentId?: string,
  ): Promise<DriveFile | null>;
  ensureRootFolder(tenantId: string): Promise<DriveFile>;
  setupAgentFolders(
    tenantId: string,
    agentId: string,
    agentName: string,
  ): Promise<{
    folderId: string;
    subfolders: Record<string, string>;
  }>;
  searchFiles(
    tenantId: string,
    query: string,
    options?: {
      pageSize?: number;
      mimeType?: string;
      mode?: 'name' | 'fulltext';
      folderId?: string;
    },
  ): Promise<DriveFile[]>;
  shareFile(
    tenantId: string,
    fileId: string,
    input: ShareFileInput,
  ): Promise<DrivePermission>;
  listFilePermissions(
    tenantId: string,
    fileId: string,
  ): Promise<DrivePermission[]>;
  revokeFilePermission(
    tenantId: string,
    fileId: string,
    permissionId: string,
  ): Promise<void>;
  getAccessToken(tenantId: string): Promise<string | null>;
}

export const DRIVE_SERVICE = Symbol('DRIVE_SERVICE');
