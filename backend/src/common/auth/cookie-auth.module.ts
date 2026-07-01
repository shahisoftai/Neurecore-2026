import { Global, Module } from '@nestjs/common';
import { CookieAuthService } from './cookie-auth.service';

/**
 * CookieAuthModule — Phase 9 (Auth Hardening)
 *
 * Provides `CookieAuthService` globally so any module can read/write
 * auth cookies without re-registering.
 */
@Global()
@Module({
  providers: [CookieAuthService],
  exports: [CookieAuthService],
})
export class CookieAuthModule {}