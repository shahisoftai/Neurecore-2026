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
}

export class ConnectBrevoDto {
  @IsString()
  apiKey: string;
}
