import { IsInt, Min, Max, IsOptional } from 'class-validator';

export class IssueTokenDto {
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(86400)
  ttlSeconds?: number; // default 3600 (1 hour), max 24 hours
}