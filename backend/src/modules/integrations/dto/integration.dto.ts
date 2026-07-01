import { IsOptional, IsString } from 'class-validator';

export class ConnectGoogleDto {
  @IsOptional()
  @IsString()
  redirectUri?: string;

  @IsOptional()
  @IsString()
  scopes?: string;
}

export class ConnectBrevoDto {
  @IsString()
  apiKey: string;
}
