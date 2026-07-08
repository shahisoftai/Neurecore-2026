// ─── impl/SingleFlightRefreshCoordinator.ts ───────────────────────────────────
// SRP: Dedup parallel /auth/refresh calls into one in-flight HTTP request.
// On success: tokens already rotated by the server via Set-Cookie (no client work needed).
// On failure: caller decides (AuthService.reportAuthFailure).

import { authHttpClient, REFRESH_URL } from '../transport/authHttpClient';
import type { IRefreshCoordinator, IAuthApi, ITokenRepository, ApiResponse } from '../core/interfaces';
import type { AxiosResponse } from 'axios';

type RefreshTokens = { accessToken: string; refreshToken: string; csrfToken: string };

function isOk<T>(r: ApiResponse<T>): r is { ok: true; status: number; data: T } {
  return r.ok;
}

export class SingleFlightRefreshCoordinator implements IRefreshCoordinator {
  private inflight: Promise<RefreshTokens> | null = null;

  constructor(
    private readonly authApi: IAuthApi,
    private readonly tokenRepository: ITokenRepository,
  ) {}

  async refreshOnce(): Promise<RefreshTokens> {
    if (this.inflight) return this.inflight;
    this.inflight = this.doRefresh().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async doRefresh(): Promise<RefreshTokens> {
    const csrf = this.tokenRepository.getCsrfToken();
    try {
      const res = await authHttpClient.post<unknown>(
        REFRESH_URL,
        {},
        {
          withCredentials: false,
          headers: csrf ? { 'X-CSRF-Token': csrf } : {},
          timeout: 5_000,
        },
      );
      // The server returns a {status, data:{accessToken,refreshToken,csrfToken}} envelope.
      const body = res.data as { data?: RefreshTokens } | undefined;
      const tokens = body?.data;
      if (tokens?.accessToken) return tokens;
    } catch {
      /* fall through to the IAuthApi path below */
    }

    // Belt-and-suspenders: also try via the typed API.
    const typed = await this.authApi.refresh();
    if (isOk(typed)) return typed.data;
    throw new Error('refresh_failed');
  }
}
