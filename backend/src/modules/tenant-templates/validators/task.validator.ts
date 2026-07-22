import { Injectable } from '@nestjs/common';
import { TemplateType } from '@prisma/client';
import { z } from 'zod';
import { TemplateValidator } from './template-validator.interface';

const taskConfigSchema = z.object({
  description: z.string().min(1).max(2000),
  estimatedDuration: z.string().min(1).max(100).optional(),
  assignToRole: z.string().min(1).max(100).optional(),
  subtasks: z.array(z.string().min(1).max(500)).min(0).max(50),
});

@Injectable()
export class TaskValidator implements TemplateValidator {
  readonly templateType: TemplateType = 'TASK_TEMPLATE';

  validate(config: unknown): { valid: boolean; errors: string[] } {
    const result = taskConfigSchema.safeParse(config);
    if (result.success) return { valid: true, errors: [] };
    return {
      valid: false,
      errors: result.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`,
      ),
    };
  }
}
