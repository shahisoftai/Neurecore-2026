import { IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { ApprovalWorkflowType, UserRole } from '@prisma/client';

export class CreateApprovalWorkflowDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ApprovalWorkflowType)
  workflowType!: ApprovalWorkflowType;

  @IsObject()
  context!: Record<string, unknown>;

  steps!: CreateStepDto[];

  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsString()
  routineRunId?: string;
}

export class CreateStepDto {
  approverRole!: UserRole[];
  stepOrder!: number;

  @IsOptional()
  @IsString()
  approverId?: string;
}

export class AdvanceStepDto {
  @IsString()
  decision!: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
