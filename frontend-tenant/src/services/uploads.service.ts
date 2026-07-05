// services/uploads.service.ts — Tenant logo (and future asset) uploads.
// Uses raw axios because we need to send multipart/form-data with a real
// progress event chain — the standard api wrapper (services/api.ts) does
// JSON-only.

import axios from 'axios';
import { tokenManager } from '@/core/infrastructure/auth/TokenManager';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export interface UploadLogoResult {
  url: string;
  key: string;
  size: number;
}

export const LOGO_UPLOAD = {
  maxBytes: 5 * 1024 * 1024,
  allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const,
} as const;

export const uploadsService = {
  async uploadLogo(file: File): Promise<UploadLogoResult> {
    if (file.size > LOGO_UPLOAD.maxBytes) {
      throw new Error(
        `Logo exceeds ${LOGO_UPLOAD.maxBytes / (1024 * 1024)} MB limit`,
      );
    }
    if (!(LOGO_UPLOAD.allowedTypes as readonly string[]).includes(file.type)) {
      throw new Error(`Unsupported image type: ${file.type || 'unknown'}`);
    }

    const form = new FormData();
    form.append('file', file);

    const token = tokenManager.getAccessToken();
    const res = await axios.post<{ data: UploadLogoResult }>(
      `${API_URL}/uploads/logo`,
      form,
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return res.data.data;
  },

  async deleteLogo(key: string): Promise<void> {
    await axios.delete(`${API_URL}/uploads/logo/${encodeURIComponent(key)}`, {
      headers: {
        Authorization: `Bearer ${tokenManager.getAccessToken() ?? ''}`,
      },
    });
  },
};