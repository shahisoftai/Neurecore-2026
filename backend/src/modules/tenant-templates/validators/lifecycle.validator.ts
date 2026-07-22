import { Injectable } from '@nestjs/common';
import { TemplateType } from '@prisma/client';
import { z } from 'zod';
import { TemplateValidator } from './template-validator.interface';

const lifecycleConfigSchema = z.object({
  stages: z
    .array(
      z.object({
        key: z.string().min(1).max(50),
        label: z.string().min(1).max(100),
        order: z.number().int().min(1),
      }),
    )
    .min(1)
    .max(20),
  defaultStage: z.string().min(1).max(50),
  customerFieldDefinitions: z
    .array(
      z.object({
        key: z.string().min(1).max(50),
        label: z.string().min(1).max(100),
        type: z.enum([
          'text',
          'number',
          'enum',
          'date',
          'encrypted',
          'boolean',
        ]),
        options: z.array(z.string()).optional(),
      }),
    )
    .optional()
    .default([]),
});

@Injectable()
export class LifecycleValidator implements TemplateValidator {
  readonly templateType: TemplateType = 'CUSTOMER_LIFECYCLE';

  validate(config: unknown): { valid: boolean; errors: string[] } {
    const result = lifecycleConfigSchema.safeParse(config);
    if (result.success) return { valid: true, errors: [] };
    return {
      valid: false,
      errors: result.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`,
      ),
    };
  }
}
