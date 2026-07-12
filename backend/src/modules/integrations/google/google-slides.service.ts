import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { GoogleAuthClient } from './google-auth.client';

export interface GoogleSlide {
  presentationId: string;
  title: string;
  url: string;
}

export interface CreatePresentationInput {
  title: string;
  slides?: { title: string; body?: string }[];
  parentId?: string;
}

@Injectable()
export class GoogleSlidesService {
  private readonly logger = new Logger(GoogleSlidesService.name);
  private readonly DRIVE_API = 'https://www.googleapis.com/drive/v3';
  private readonly SLIDES_API = 'https://slides.googleapis.com/v1';

  constructor(private readonly authClient: GoogleAuthClient) {}

  private async authFetch(url: string, options: RequestInit = {}, tenantId: string): Promise<Response> {
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

  async createPresentation(tenantId: string, input: CreatePresentationInput): Promise<GoogleSlide> {
    const body: Record<string, unknown> = {
      name: input.title,
      mimeType: 'application/vnd.google-apps.presentation',
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
      this.logger.error(`Slides create failed: ${res.status} ${err}`);
      throw new BadRequestException('Failed to create Google Slides presentation');
    }

    const file = (await res.json()) as { id: string; name: string; mimeType: string; webViewLink?: string };

    if (input.slides?.length) {
      await this.addSlides(tenantId, file.id, input.slides);
    }

    this.logger.log(`Google Slides "${input.title}" created (id=${file.id}) for tenant ${tenantId}`);
    return {
      presentationId: file.id,
      title: file.name,
      url: file.webViewLink ?? `https://docs.google.com/presentation/d/${file.id}/edit`,
    };
  }

  private async addSlides(
    tenantId: string,
    presentationId: string,
    slides: { title: string; body?: string }[],
  ): Promise<void> {
    const requests: Record<string, unknown>[] = [];

    for (let i = 1; i < slides.length; i++) {
      requests.push({
        createSlide: {
          objectId: `slide_${i}`,
          slideLayoutReference: { predefinedLayout: 'BLANK' },
          placeholderIdMappings: [],
        },
      });
    }

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const slideId = i === 0 ? 'p' : `slide_${i}`;

      if (slide.title) {
        requests.push({
          createShape: {
            objectId: `title_${i}`,
            shapeType: 'TEXT_BOX',
            elementProperties: {
              pageObjectId: slideId,
              size: { width: { magnitude: 7200, unit: 'EMU' }, height: { magnitude: 750, unit: 'EMU' } },
              transform: { scaleX: 1, scaleY: 1, translateX: 450, translateY: 300, unit: 'EMU' },
            },
          },
        });
        requests.push({
          insertText: {
            objectId: `title_${i}`,
            text: slide.title,
          },
        });
      }

      if (slide.body) {
        const bodyId = `body_${i}`;
        requests.push({
          createShape: {
            objectId: bodyId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
              pageObjectId: slideId,
              size: { width: { magnitude: 7200, unit: 'EMU' }, height: { magnitude: 3750, unit: 'EMU' } },
              transform: { scaleX: 1, scaleY: 1, translateX: 450, translateY: 1200, unit: 'EMU' },
            },
          },
        });
        requests.push({
          insertText: {
            objectId: bodyId,
            text: slide.body,
          },
        });
      }
    }

    if (requests.length === 0) return;

    const res = await this.authFetch(
      `${this.SLIDES_API}/presentations/${presentationId}:batchUpdate`,
      { method: 'POST', body: JSON.stringify({ requests }) },
      tenantId,
    );

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.warn(`Slides addSlides failed for ${presentationId}: ${res.status} ${err}`);
    }
  }

  async getPresentation(tenantId: string, presentationId: string): Promise<Record<string, unknown>> {
    const res = await this.authFetch(
      `${this.SLIDES_API}/presentations/${presentationId}`,
      {},
      tenantId,
    );
    if (!res.ok) {
      throw new BadRequestException('Failed to fetch Google Slides presentation');
    }
    return res.json() as Promise<Record<string, unknown>>;
  }
}
