import { Injectable } from '@nestjs/common';
import { TemplateType } from '@prisma/client';
import { z } from 'zod';
import { TemplateValidator } from './template-validator.interface';

const routineConfigSchema = z.object({
  trigger: z.string().min(1).max(500),
  action: z.string().min(1).max(2000),
  channels: z.array(z.string().min(1).max(50)).min(1).max(10),
});

@Injectable()
export class RoutineValidator implements TemplateValidator {
  readonly templateType: TemplateType = 'ROUTINE';

  validate(config: unknown): { valid: boolean; errors: string[] } {
    const result = routineConfigSchema.safeParse(config);
    if (result.success) return { valid: true, errors: [] };
    return {
      valid: false,
      errors: result.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`,
      ),
    };
  }
}
