import { IsString, IsOptional } from 'class-validator';

export class SessionContextDto {
  @IsString()
  sessionId!: string;

  @IsString()
  @IsOptional()
  threadId?: string;

  @IsString()
  @IsOptional()
  workspaceId?: string;
}
