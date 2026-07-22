import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { GoogleAuthClient } from './google-auth.client';

export interface GoogleDoc {
  documentId: string;
  title: string;
  url: string;
}

export interface CreateDocInput {
  title: string;
  content?: string;
  parentId?: string;
}

@Injectable()
export class GoogleDocsService {
  private readonly logger = new Logger(GoogleDocsService.name);
  private readonly DRIVE_API = 'https://www.googleapis.com/drive/v3';
  private readonly DOCS_API = 'https://docs.googleapis.com/v1';

  constructor(private readonly authClient: GoogleAuthClient) {}

  private async authFetch(
    url: string,
    options: RequestInit = {},
    tenantId: string,
  ): Promise<Response> {
    const accessToken = await this.authClient.getAccessToken(tenantId);
    if (!accessToken) {
      throw new BadRequestException('Google is not connected for this tenant');
    }
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    };
    return fetch(url, { ...options, headers });
  }

  async createDocument(
    tenantId: string,
    input: CreateDocInput,
  ): Promise<GoogleDoc> {
    const body: Record<string, unknown> = {
      name: input.title,
      mimeType: 'application/vnd.google-apps.document',
    };
    if (input.parentId) {
      body.parents = [input.parentId];
    }

    const fields = 'id,name,mimeType,webViewLink';
    const res = await this.authFetch(
      `${this.DRIVE_API}/files?fields=${encodeURIComponent(fields)}`,
      { method: 'POST', body: JSON.stringify(body) },
      tenantId,
    );

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.error(`Docs create failed: ${res.status} ${err}`);
      throw new BadRequestException('Failed to create Google Doc');
    }

    const file = (await res.json()) as {
      id: string;
      name: string;
      mimeType: string;
      webViewLink?: string;
    };

    if (input.content) {
      await this.appendContent(tenantId, file.id, input.content);
    }

    this.logger.log(
      `Google Doc "${input.title}" created (id=${file.id}) for tenant ${tenantId}`,
    );
    return {
      documentId: file.id,
      title: file.name,
      url:
        file.webViewLink ??
        `https://docs.google.com/document/d/${file.id}/edit`,
    };
  }

  private async appendContent(
    tenantId: string,
    documentId: string,
    text: string,
  ): Promise<void> {
    const requests = [
      {
        insertText: {
          location: { index: 1 },
          text,
        },
      },
    ];

    const res = await this.authFetch(
      `${this.DOCS_API}/documents/${documentId}:batchUpdate`,
      { method: 'POST', body: JSON.stringify({ requests }) },
      tenantId,
    );

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.warn(
        `Docs appendContent failed for ${documentId}: ${res.status} ${err}`,
      );
    }
  }

  async getDocument(
    tenantId: string,
    documentId: string,
  ): Promise<Record<string, unknown>> {
    const res = await this.authFetch(
      `${this.DOCS_API}/documents/${documentId}`,
      {},
      tenantId,
    );
    if (!res.ok) {
      throw new BadRequestException('Failed to fetch Google Doc');
    }
    return res.json() as Promise<Record<string, unknown>>;
  }
}
