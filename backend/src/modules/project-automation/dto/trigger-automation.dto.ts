import { IsOptional, IsString, IsEnum } from 'class-validator';
import { AutomationEventType } from '@prisma/client';

export class TriggerAutomationDto {
  @IsString()
  projectId!: string;

  @IsEnum(AutomationEventType)
  @IsOptional()
  event?: AutomationEventType;
}

export class ReplanAutomationDto {
  @IsString()
  projectId!: string;
}
