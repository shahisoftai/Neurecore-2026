import { IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { TaskPriority } from '@prisma/client';

export class DispatchTaskDto {
  @IsString()
  taskId!: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsObject()
  inputOverride?: Record<string, unknown>;
}
