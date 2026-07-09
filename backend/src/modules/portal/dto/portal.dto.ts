import { Type } from 'class-transformer';
import { IsString, IsEmail, IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DOCUMENT_VISIBILITY } from '../interfaces/portal.interface';

export class RequestPortalAccessDto {
  @ApiProperty({ description: 'Project ID the client wants to access' })
  @IsString()
  projectId: string;

  @ApiProperty({ description: 'Contact email for the client' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}

export class ValidatePortalTokenDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty()
  @IsString()
  projectId: string;
}

export class RefreshPortalTokenDto {
  @ApiProperty({ description: 'Currently valid portal token' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'Project the token is scoped to' })
  @IsString()
  projectId: string;
}

export class UploadProjectDocumentDto {
  @ApiProperty({ description: 'Display name of the file' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'CLIENT or INTERNAL',
    enum: ['CLIENT', 'INTERNAL'],
    default: 'CLIENT',
  })
  @IsOptional()
  @IsIn(['CLIENT', 'INTERNAL'])
  visibility?: 'CLIENT' | 'INTERNAL';
}

export class ListProjectDocumentsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by visibility', enum: ['CLIENT', 'INTERNAL'] })
  @IsOptional()
  @IsIn(['CLIENT', 'INTERNAL'])
  visibility?: 'CLIENT' | 'INTERNAL';
}

export class ApproveDeliverableDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PortalResponseDto {
  ok: boolean;
  message?: string;
  data?: unknown;
}
