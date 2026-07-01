import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

/**
 * RefreshTokenDto — Phase 9 update.
 *
 * `refreshToken` is now OPTIONAL because the SPA can authenticate the
 * /auth/refresh call purely via the httpOnly `__Host-nc_rt` cookie
 * (no body needed). Server-to-server / CLI clients can still send a
 * body for backwards compatibility.
 */
export class RefreshTokenDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  refreshToken?: string;
}