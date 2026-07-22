import { Injectable } from '@nestjs/common';
import { TemplateType } from '@prisma/client';
import { z } from 'zod';
import { TemplateValidator } from './template-validator.interface';

const departmentConfigSchema = z.object({
  departments: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        roles: z.array(z.string().min(1).max(100)).min(1).max(50),
      }),
    )
    .min(1)
    .max(20),
});

@Injectable()
export class DepartmentValidator implements TemplateValidator {
  readonly templateType: TemplateType = 'DEPARTMENT_DEFAULT';

  validate(config: unknown): { valid: boolean; errors: string[] } {
    const result = departmentConfigSchema.safeParse(config);
    if (result.success) return { valid: true, errors: [] };
    return {
      valid: false,
      errors: result.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`,
      ),
    };
  }
}
