import { IsIn, IsOptional, IsString } from 'class-validator';

export class ConnectGoogleDto {
  @IsOptional()
  @IsString()
  redirectUri?: string;

  @IsOptional()
  @IsString()
  scopes?: string;

  @IsOptional()
  @IsIn(['tenant', 'admin'])
  audience?: 'tenant' | 'admin';

  /**
   * Where to send the user after the OAuth callback completes.
   * - 'settings' (default): tenant settings/integrations page
   * - 'onboarding': return to the Initial Onboarding wizard
   * Used by the callback handler to route the user back.
   */
  @IsOptional()
  @IsIn(['settings', 'onboarding'])
  origin?: 'settings' | 'onboarding';
}

export class ConnectBrevoDto {
  @IsString()
  apiKey: string;
}
